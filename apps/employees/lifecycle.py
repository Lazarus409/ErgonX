"""Onboarding and offboarding checklists.

Each institution keeps a list of ``LifecycleTaskTemplate`` items per process. When
an onboarding or offboarding record starts, the active templates are copied onto
it as ``LifecycleTask`` rows, so later template edits never rewrite a checklist
already in progress. A record cannot complete while a required task is open.
"""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.employees.models import (
    EmployeeOffboarding,
    EmployeeOnboarding,
    Employment,
    LifecycleProcess,
    LifecycleTask,
    LifecycleTaskCategory as Category,
    LifecycleTaskOwner as Owner,
    LifecycleTaskTemplate,
)

# (title, description, category, owner, due offset in days, required)
STANDARD_CHECKLISTS = {
    LifecycleProcess.ONBOARDING: (
        ("Sign employment contract", "Signed contract or appointment letter is on file.", Category.DOCUMENTS, Owner.HR, 0, True),
        ("Collect statutory details", "Ghana Card, SSNIT number, TIN and bank account details are captured.", Category.DOCUMENTS, Owner.HR, 0, True),
        ("Create email and system accounts", "Work email, ErgonX access and any other systems the role needs.", Category.IT_ACCESS, Owner.IT, 0, True),
        ("Issue laptop, ID card and equipment", "Record asset tags for anything issued.", Category.EQUIPMENT, Owner.IT, 0, True),
        ("Acknowledge code of conduct and HR policies", "The employee has read and accepted the staff handbook and key policies.", Category.POLICY, Owner.EMPLOYEE, 7, True),
        ("Department orientation and introductions", "Walk-through of the team, workplace, safety and reporting lines.", Category.ORIENTATION, Owner.MANAGER, 5, True),
        ("Agree probation objectives", "Objectives and expectations for the probation period are written down.", Category.PROBATION, Owner.MANAGER, 14, False),
        ("Probation review and confirmation decision", "Confirm, extend or end probation before it lapses.", Category.PROBATION, Owner.HR, 90, False),
    ),
    LifecycleProcess.OFFBOARDING: (
        ("Confirm resignation or termination letter", "Letter and last working day are on file.", Category.DOCUMENTS, Owner.HR, -10, True),
        ("Hand over work and knowledge", "Open work, files and contacts are handed to a named colleague.", Category.HANDOVER, Owner.MANAGER, -1, True),
        ("Return laptop, ID card, keys and equipment", "Check returned items against the assets issued.", Category.ASSET_RETURN, Owner.IT, 0, True),
        ("Finance clearance", "Outstanding loans, salary advances and imprest are settled or scheduled for deduction.", Category.CLEARANCE, Owner.FINANCE, 0, True),
        ("Exit interview", "Record the main reasons for leaving and any feedback.", Category.EXIT_INTERVIEW, Owner.HR, -2, False),
        ("Disable email and external system access", "ErgonX access ends automatically when offboarding completes; this covers other systems.", Category.ACCESS_REVOCATION, Owner.IT, 0, True),
        ("Final pay", "Salary to the last working day, unused leave and deductions are agreed for the final payroll.", Category.FINAL_PAY, Owner.FINANCE, 7, False),
        ("Issue certificate of service", "", Category.DOCUMENTS, Owner.HR, 7, False),
    ),
}

CLOSED_RECORD_STATUSES = ("COMPLETED", "CANCELLED")


def _parent_field(record):
    return "onboarding" if isinstance(record, EmployeeOnboarding) else "offboarding"


def _process_for(record):
    return LifecycleProcess.ONBOARDING if isinstance(record, EmployeeOnboarding) else LifecycleProcess.OFFBOARDING


def _base_date(record):
    if isinstance(record, EmployeeOffboarding):
        return record.last_working_day or timezone.localdate()
    current = Employment.objects.filter(employee=record.employee, is_current=True).order_by("-start_date").first()
    return (current.start_date if current else None) or record.employee.hire_date or timezone.localdate()


def generate_lifecycle_tasks(record):
    """Copies the active templates onto a record that has no checklist yet."""
    parent = _parent_field(record)
    if LifecycleTask.objects.filter(**{parent: record}).exists():
        return []
    base = _base_date(record)
    templates = LifecycleTaskTemplate.objects.for_institution(record.institution).filter(process=_process_for(record), is_active=True)
    tasks = []
    for template in templates:
        task = LifecycleTask(
            institution=record.institution, employee=record.employee, template=template, title=template.title,
            description=template.description, category=template.category, owner=template.owner,
            is_required=template.is_required, sort_order=template.sort_order,
            due_date=base + timedelta(days=template.due_offset_days), **{parent: record},
        )
        task.save()
        tasks.append(task)
    return tasks


def reschedule_offboarding_tasks(offboarding):
    """Moves open template-based due dates when the last working day changes."""
    if not offboarding.last_working_day:
        return
    for task in offboarding.tasks.filter(status=LifecycleTask.Status.OPEN, template__isnull=False).select_related("template"):
        due = offboarding.last_working_day + timedelta(days=task.template.due_offset_days)
        if task.due_date != due:
            task.due_date = due
            task.save(update_fields=("due_date", "updated_at"))


def open_required_tasks(record):
    return list(LifecycleTask.objects.filter(**{_parent_field(record): record}, is_required=True, status=LifecycleTask.Status.OPEN).order_by("sort_order", "created_at"))


def checklist_blocker(record):
    """A human-readable reason the record cannot complete, or ``""``."""
    pending = open_required_tasks(record)
    if not pending:
        return ""
    titles = ", ".join(task.title for task in pending[:3])
    more = f" and {len(pending) - 3} more" if len(pending) > 3 else ""
    noun = "item is" if len(pending) == 1 else "items are"
    return f"{len(pending)} required checklist {noun} still open: {titles}{more}."


def _ensure_record_open(record):
    if record.status in CLOSED_RECORD_STATUSES:
        raise ValidationError({"task": f"This {_process_for(record).label.lower()} is {record.get_status_display().lower()}; its checklist can no longer change."})


@transaction.atomic
def update_lifecycle_task(*, institution, task, actor, **changes):
    task = LifecycleTask.objects.select_for_update().select_related("onboarding", "offboarding").get(pk=task.pk, institution=institution)
    record = task.onboarding or task.offboarding
    _ensure_record_open(record)
    previous_status = task.status
    for field in ("title", "description", "owner", "due_date", "note", "is_required"):
        if field in changes:
            setattr(task, field, changes[field])
    status = changes.get("status", task.status)
    if status != previous_status:
        task.status = status
        if status == LifecycleTask.Status.OPEN:
            task.completed_at = None
            task.completed_by = None
        else:
            task.completed_at = timezone.now()
            task.completed_by = actor
    task.save()
    if status != previous_status:
        record_audit_event(
            actor=actor, institution=institution, entity=task, action="employee.lifecycle_task.status_changed",
            metadata={"employee_id": str(task.employee_id), "process": task.process, "title": task.title, "changes": {"status": [previous_status, status]}},
        )
    return task


@transaction.atomic
def add_lifecycle_task(*, institution, record, actor, title, description="", category=Category.OTHER, owner=Owner.HR, due_date=None, is_required=True):
    _ensure_record_open(record)
    last = LifecycleTask.objects.filter(**{_parent_field(record): record}).order_by("-sort_order").values_list("sort_order", flat=True).first()
    task = LifecycleTask(
        institution=institution, employee=record.employee, title=title, description=description, category=category,
        owner=owner, due_date=due_date, is_required=is_required, sort_order=(last or 0) + 1, **{_parent_field(record): record},
    )
    task.save()
    record_audit_event(actor=actor, institution=institution, entity=task, action="employee.lifecycle_task.added", metadata={"employee_id": str(record.employee_id), "process": task.process, "title": title})
    return task


@transaction.atomic
def delete_lifecycle_task(*, institution, task, actor):
    """Removes an ad-hoc item. Template items are marked not applicable instead, so the record shows they were considered."""
    task = LifecycleTask.objects.select_for_update().select_related("onboarding", "offboarding").get(pk=task.pk, institution=institution)
    _ensure_record_open(task.onboarding or task.offboarding)
    if task.template_id:
        raise ValidationError({"task": "Standard checklist items cannot be removed; mark them not applicable with a reason."})
    record_audit_event(actor=actor, institution=institution, entity=task, action="employee.lifecycle_task.removed", metadata={"employee_id": str(task.employee_id), "process": task.process, "title": task.title})
    task.delete()


@transaction.atomic
def install_standard_checklists(*, institution, actor):
    """Adds the standard checklist for each process that has no templates yet."""
    created = {}
    for process, items in STANDARD_CHECKLISTS.items():
        if LifecycleTaskTemplate.objects.for_institution(institution).filter(process=process).exists():
            created[process] = 0
            continue
        for order, (title, description, category, owner, offset, required) in enumerate(items, start=1):
            LifecycleTaskTemplate(
                institution=institution, process=process, title=title, description=description, category=category,
                owner=owner, due_offset_days=offset, is_required=required, sort_order=order,
            ).save()
        created[process] = len(items)
    if any(created.values()):
        record_audit_event(actor=actor, institution=institution, entity=institution, action="employee.lifecycle_templates.installed", metadata={"created": created})
    return created


def policy_items_are_automatic(institution, employee):
    """True when a required policy applies to the employee, so policy items tick themselves off."""
    from apps.documents.policies import READ_ONLY, policies_for_employee

    return any(status != READ_ONLY for _, status, _, _ in policies_for_employee(institution, employee))


def employee_can_complete(task, *, policy_automatic):
    record = task.onboarding or task.offboarding
    return (
        task.owner == Owner.EMPLOYEE
        and task.status != LifecycleTask.Status.NOT_APPLICABLE
        and record.status not in CLOSED_RECORD_STATUSES
        and not (task.category == Category.POLICY and policy_automatic)
    )


def self_update_lifecycle_task(*, institution, task, employee, user, status):
    """An employee ticks off (or reopens) an item they are responsible for."""
    if status not in (LifecycleTask.Status.OPEN, LifecycleTask.Status.DONE):
        raise ValidationError({"status": "Mark the item done or open."})
    if task.employee_id != employee.id or not employee_can_complete(task, policy_automatic=policy_items_are_automatic(institution, employee)):
        raise ValidationError({"task": "HR completes this item."})
    return update_lifecycle_task(institution=institution, task=task, actor=user, status=status)
