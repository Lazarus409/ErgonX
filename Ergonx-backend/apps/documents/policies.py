"""Workplace policies and employee acknowledgements.

A published policy applies to every active employee whose current employment
type it covers. When it requires acknowledgement, each of those employees signs
the current version by typing their name. Publishing a new version asks
everyone to acknowledge again.

An employee's status for a policy is:

* ``ACKNOWLEDGED`` - signed the current version;
* ``PENDING``      - not yet signed, still within the acknowledgement window;
* ``OVERDUE``      - not signed and the window has passed;
* ``READ_ONLY``    - the policy is for information and needs no signature.

The window starts at the later of the version's publication and the
employee's start date, so new hires get the full period.
"""

import re
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.context import get_audit_request_context
from apps.audit.services import record_audit_event
from apps.documents.models import Policy, PolicyAcknowledgement
from apps.employees.models import Employee, Employment

ACKNOWLEDGED = "ACKNOWLEDGED"
PENDING = "PENDING"
OVERDUE = "OVERDUE"
READ_ONLY = "READ_ONLY"
ACTIVE_EMPLOYEE_STATUSES = (Employee.Status.ACTIVE, Employee.Status.SUSPENDED)


def _normalise(name):
    return re.sub(r"\s+", " ", name or "").strip().casefold()


def accepted_signatures(employee):
    """Names an employee may sign with: their full or short legal name, or preferred first name."""
    names = {employee.full_name, f"{employee.first_name} {employee.last_name}"}
    if employee.preferred_name:
        names.add(f"{employee.preferred_name} {employee.last_name}")
    return {_normalise(name) for name in names if name.strip()}


def _current_employment(employee_ids):
    rows = Employment.objects.filter(employee_id__in=employee_ids, is_current=True).values_list("employee_id", "employment_type", "start_date")
    return {employee_id: (employment_type, start_date) for employee_id, employment_type, start_date in rows}


def _due_date(policy, start_date):
    published = timezone.localdate(policy.published_at) if policy.published_at else timezone.localdate()
    begins = max(published, start_date) if start_date else published
    return begins + timedelta(days=policy.acknowledge_within_days)


def _status(policy, acknowledgement, due, today):
    if not policy.requires_acknowledgement:
        return READ_ONLY
    if acknowledgement is not None:
        return ACKNOWLEDGED
    return OVERDUE if due < today else PENDING


def published_policies(institution):
    return Policy.objects.for_institution(institution).filter(status=Policy.Status.PUBLISHED).select_related("document")


def policies_for_employee(institution, employee, *, today=None):
    """``[(policy, status, due_date, acknowledgement)]`` for the published policies that apply to the employee."""
    today = today or timezone.localdate()
    employment_type, start_date = _current_employment([employee.id]).get(employee.id, (None, employee.hire_date))
    policies = [policy for policy in published_policies(institution) if policy.applies_to(employment_type)]
    acknowledgements = {
        (row.policy_id, row.version): row
        for row in PolicyAcknowledgement.objects.filter(employee=employee, policy__in=policies)
    }
    rows = []
    for policy in policies:
        acknowledgement = acknowledgements.get((policy.id, policy.version))
        due = _due_date(policy, start_date)
        rows.append((policy, _status(policy, acknowledgement, due, today), due, acknowledgement))
    return rows


def policy_compliance(institution, policy, employees, *, today=None):
    """Per-employee status for one policy across ``employees`` (those it does not apply to are left out)."""
    today = today or timezone.localdate()
    employees = list(employees)
    employment = _current_employment([employee.id for employee in employees])
    acknowledgements = {row.employee_id: row for row in PolicyAcknowledgement.objects.filter(policy=policy, version=policy.version)}
    rows = []
    for employee in employees:
        employment_type, start_date = employment.get(employee.id, (None, employee.hire_date))
        if not policy.applies_to(employment_type):
            continue
        acknowledgement = acknowledgements.get(employee.id)
        due = _due_date(policy, start_date)
        rows.append({"employee": employee, "status": _status(policy, acknowledgement, due, today), "due_date": due, "acknowledgement": acknowledgement})
    return rows


def summarize(statuses):
    statuses = [status for status in statuses if status != READ_ONLY]
    acknowledged = sum(1 for status in statuses if status == ACKNOWLEDGED)
    return {
        "applicable": len(statuses),
        "acknowledged": acknowledged,
        "pending": sum(1 for status in statuses if status == PENDING),
        "overdue": sum(1 for status in statuses if status == OVERDUE),
        "rate": round(acknowledged * 100 / len(statuses), 1) if statuses else 100.0,
    }


def active_employees(institution):
    return Employee.objects.for_institution(institution).filter(status__in=ACTIVE_EMPLOYEE_STATUSES)


# ------------------------------------------------------------------ lifecycle


@transaction.atomic
def publish_policy(*, institution, policy, actor):
    policy = Policy.objects.select_for_update().get(pk=policy.pk, institution=institution)
    if policy.status != Policy.Status.DRAFT:
        raise ValidationError({"status": "Only a draft policy can be published."})
    if not policy.body.strip() and policy.document_id is None:
        raise ValidationError({"body": "Add the policy text or attach the policy document before publishing."})
    policy.status = Policy.Status.PUBLISHED
    policy.published_at = timezone.now()
    policy.published_by = actor
    policy.save()
    record_audit_event(actor=actor, institution=institution, entity=policy, action="policy.published", metadata={"title": policy.title, "version": policy.version})
    return policy


@transaction.atomic
def publish_new_version(*, institution, policy, actor, change_summary, **content):
    """Replaces a published policy's content and asks everyone to acknowledge it again."""
    policy = Policy.objects.select_for_update().get(pk=policy.pk, institution=institution)
    if policy.status != Policy.Status.PUBLISHED:
        raise ValidationError({"status": "Only a published policy can get a new version."})
    if not (change_summary or "").strip():
        raise ValidationError({"change_summary": "Say what changed in this version."})
    for field in ("title", "summary", "body", "document", "category", "employment_types", "requires_acknowledgement", "acknowledge_within_days"):
        if field in content:
            setattr(policy, field, content[field])
    if not policy.body.strip() and policy.document_id is None:
        raise ValidationError({"body": "Add the policy text or attach the policy document."})
    previous = policy.version
    policy.version = previous + 1
    policy.change_summary = change_summary.strip()
    policy.published_at = timezone.now()
    policy.published_by = actor
    policy.save()
    record_audit_event(actor=actor, institution=institution, entity=policy, action="policy.version_published", metadata={"title": policy.title, "version": [previous, policy.version], "change_summary": policy.change_summary})
    return policy


@transaction.atomic
def retire_policy(*, institution, policy, actor):
    policy = Policy.objects.select_for_update().get(pk=policy.pk, institution=institution)
    if policy.status != Policy.Status.PUBLISHED:
        raise ValidationError({"status": "Only a published policy can be retired."})
    policy.status = Policy.Status.RETIRED
    policy.save(update_fields=("status", "updated_at"))
    record_audit_event(actor=actor, institution=institution, entity=policy, action="policy.retired", metadata={"title": policy.title, "version": policy.version})
    return policy


@transaction.atomic
def acknowledge_policy(*, institution, policy, employee, user, signed_name):
    policy = Policy.objects.select_for_update().get(pk=policy.pk, institution=institution)
    if policy.status != Policy.Status.PUBLISHED:
        raise ValidationError({"policy": "This policy is not published."})
    if not policy.requires_acknowledgement:
        raise ValidationError({"policy": "This policy is for information and does not need acknowledging."})
    employment_type = _current_employment([employee.id]).get(employee.id, (None, None))[0]
    if employee.status not in ACTIVE_EMPLOYEE_STATUSES or not policy.applies_to(employment_type):
        raise ValidationError({"policy": "This policy does not apply to you."})
    if PolicyAcknowledgement.objects.filter(policy=policy, employee=employee, version=policy.version).exists():
        raise ValidationError({"policy": "You have already acknowledged this version."})
    if _normalise(signed_name) not in accepted_signatures(employee):
        raise ValidationError({"signed_name": f"Type your full name as it appears on your record ({employee.first_name} {employee.last_name})."})
    context = get_audit_request_context()
    acknowledgement = PolicyAcknowledgement(
        institution=institution, policy=policy, employee=employee, user=user, version=policy.version,
        signed_name=re.sub(r"\s+", " ", signed_name).strip(), acknowledged_at=timezone.now(),
        ip_address=context["ip"], user_agent=(context["user_agent"] or "")[:500],
    )
    acknowledgement.save()
    record_audit_event(actor=user, institution=institution, entity=acknowledgement, action="policy.acknowledged", metadata={"policy_id": str(policy.id), "title": policy.title, "version": policy.version, "employee_id": str(employee.id)})
    sync_policy_tasks(institution=institution, employee=employee, actor=user)
    return acknowledgement


def sync_policy_tasks(*, institution, employee, actor):
    """Ticks off open onboarding policy items once every required policy is acknowledged.

    Nothing happens when no required policy applies: the item then stays a manual one.
    """
    from apps.employees.lifecycle import update_lifecycle_task
    from apps.employees.models import EmployeeOnboarding, LifecycleTask, LifecycleTaskCategory

    tasks = list(LifecycleTask.objects.filter(
        institution=institution, employee=employee, onboarding__isnull=False, category=LifecycleTaskCategory.POLICY,
        status=LifecycleTask.Status.OPEN,
    ).exclude(onboarding__status__in=(EmployeeOnboarding.Status.COMPLETED, EmployeeOnboarding.Status.CANCELLED)))
    if not tasks:
        return []
    statuses = [status for _, status, _, _ in policies_for_employee(institution, employee) if status != READ_ONLY]
    if not statuses or any(status != ACKNOWLEDGED for status in statuses):
        return []
    note = f"All {len(statuses)} required {'policy' if len(statuses) == 1 else 'policies'} acknowledged."
    return [update_lifecycle_task(institution=institution, task=task, actor=actor, status=LifecycleTask.Status.DONE, note=note) for task in tasks]
