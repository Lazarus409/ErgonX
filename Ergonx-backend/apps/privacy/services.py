"""Retention runs, anonymisation, legal holds and data subject requests.

What retention never touches: payroll, tax, pension and accounting records, and
the audit trail. Ghana's tax and social security rules require them to be kept,
so the former-employee rule clears only personal contact details and emergency
contacts, and the attendance and audit rules only report what is due.
"""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max, Q
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.privacy.models import DataSubjectRequest, LegalHold, RetentionRule

DSR_DAYS = 30
ANONYMISED = "Removed"


def _months_ago(months):
    return timezone.now() - timedelta(days=round(months * 30.44))


def held_employee_ids(institution):
    return set(LegalHold.objects.filter(institution=institution, released_at__isnull=True).values_list("employees__id", flat=True)) - {None}


def held_candidate_ids(institution):
    return set(LegalHold.objects.filter(institution=institution, released_at__isnull=True).values_list("candidates__id", flat=True)) - {None}


# ------------------------------------------------------------------ retention


def due_candidates(institution, rule):
    """Candidates with no open application, whose last application closed before the retention period."""
    from apps.recruitment.models import Application, Candidate

    cutoff = _months_ago(rule.keep_months)
    open_statuses = (Application.Status.DRAFT, Application.Status.ACTIVE, Application.Status.OFFERED, Application.Status.HIRED)
    candidates = (
        Candidate.objects.for_institution(institution)
        .exclude(first_name=ANONYMISED)
        .exclude(applications__status__in=open_statuses)
        .annotate(last_activity=Max("applications__updated_at"))
        .filter(Q(last_activity__lt=cutoff) | Q(last_activity__isnull=True, updated_at__lt=cutoff))
        .exclude(id__in=held_candidate_ids(institution))
    )
    return candidates


def due_former_employees(institution, rule):
    """Terminated employees whose employment ended before the retention period and who still hold contact details."""
    from apps.employees.models import Employee, Employment

    cutoff = _months_ago(rule.keep_months).date()
    ended = Employment.objects.filter(institution=institution, status=Employment.Status.ENDED).values("employee_id").annotate(last_end=Max("end_date")).filter(last_end__lt=cutoff).values("employee_id")
    return (
        Employee.objects.for_institution(institution)
        .filter(status=Employee.Status.TERMINATED, id__in=ended)
        .exclude(Q(personal_email="") & Q(phone="") & Q(mobile_phone="") & Q(emergency_contacts__isnull=True))
        .exclude(id__in=held_employee_ids(institution))
        .distinct()
    )


def retention_report(institution):
    """What each active rule would act on now."""
    from apps.attendance.models import AttendanceRecord
    from apps.audit.models import AuditLog

    rows = []
    for rule in RetentionRule.objects.for_institution(institution).filter(is_active=True):
        if rule.category == RetentionRule.Category.CANDIDATES:
            due = due_candidates(institution, rule)
            sample = [{"id": str(row.id), "name": row.full_name} for row in due[:20]]
            count = due.count()
        elif rule.category == RetentionRule.Category.FORMER_EMPLOYEES:
            due = due_former_employees(institution, rule)
            sample = [{"id": str(row.id), "name": row.full_name} for row in due[:20]]
            count = due.count()
        elif rule.category == RetentionRule.Category.ATTENDANCE:
            count = AttendanceRecord.objects.filter(institution=institution, attendance_date__lt=_months_ago(rule.keep_months).date()).count()
            sample = []
        else:
            count = AuditLog.objects.filter(institution=institution, created_at__lt=_months_ago(rule.keep_months)).count()
            sample = []
        rows.append({"rule_id": str(rule.id), "category": rule.category, "category_label": rule.get_category_display(), "keep_months": rule.keep_months, "action": rule.action, "due": count, "sample": sample, "last_run_at": rule.last_run_at})
    return {"rules": rows, "legal_holds": LegalHold.objects.filter(institution=institution, released_at__isnull=True).count()}


@transaction.atomic
def anonymise_candidate(candidate, *, actor, reason):
    from apps.documents.models import Document

    if candidate.id in held_candidate_ids(candidate.institution):
        raise ValidationError({"candidate": "This candidate is under a legal hold."})
    documents = Document.objects.filter(institution=candidate.institution, entity_type="recruitment.Candidate", entity_id=candidate.id)
    for document in documents:
        if document.stored_file:
            document.stored_file.delete(save=False)
    documents.update(is_active=False, stored_file="", original_filename="removed")
    candidate.first_name, candidate.middle_name, candidate.last_name = ANONYMISED, "", "Candidate"
    candidate.email = f"removed-{candidate.id}@invalid.example"
    for field in ("phone", "location", "linkedin_url", "current_employer", "current_title", "field_of_study", "education_institution", "skills", "notes"):
        setattr(candidate, field, "")
    candidate.save()
    candidate.applications.update(cover_letter="", applicant_details={}, notes="")
    from apps.recruitment.models import CandidateAccessToken

    CandidateAccessToken.objects.filter(application__candidate=candidate).delete()
    record_audit_event(actor=actor, institution=candidate.institution, entity=candidate, action="privacy.candidate.anonymised", metadata={"reason": reason})


@transaction.atomic
def clear_former_employee_contacts(employee, *, actor, reason):
    if employee.id in held_employee_ids(employee.institution):
        raise ValidationError({"employee": "This employee is under a legal hold."})
    employee.personal_email, employee.phone, employee.mobile_phone, employee.linkedin_url = "", "", "", ""
    employee.save(update_fields=("personal_email", "phone", "mobile_phone", "linkedin_url", "updated_at"))
    removed = employee.emergency_contacts.count()
    employee.emergency_contacts.all().delete()
    record_audit_event(actor=actor, institution=employee.institution, entity=employee, action="privacy.employee.contacts_cleared", metadata={"reason": reason, "emergency_contacts_removed": removed})


def run_retention(*, institution, actor, rule):
    """Applies one rule. Only ANONYMISE rules for candidates and former employees change data."""
    if rule.action != RetentionRule.Action.ANONYMISE:
        raise ValidationError({"rule": "This rule only lists records for review."})
    reason = f"Retention rule: {rule.get_category_display()} after {rule.keep_months} months"
    done = 0
    if rule.category == RetentionRule.Category.CANDIDATES:
        for candidate in list(due_candidates(institution, rule)):
            anonymise_candidate(candidate, actor=actor, reason=reason)
            done += 1
    elif rule.category == RetentionRule.Category.FORMER_EMPLOYEES:
        for employee in list(due_former_employees(institution, rule)):
            clear_former_employee_contacts(employee, actor=actor, reason=reason)
            done += 1
    rule.last_run_at = timezone.now()
    rule.save(update_fields=("last_run_at", "updated_at"))
    record_audit_event(actor=actor, institution=institution, entity=rule, action="privacy.retention.run", metadata={"category": rule.category, "records": done})
    return done


# --------------------------------------------------------- data subject requests


@transaction.atomic
def create_request(*, institution, actor, request_type, requester_name, requester_email="", details="", employee=None, candidate=None, received_at=None):
    received_at = received_at or timezone.now()
    request = DataSubjectRequest(
        institution=institution, request_type=request_type, employee=employee, candidate=candidate, requester_name=requester_name.strip(),
        requester_email=(requester_email or "").strip(), details=(details or "").strip(), received_at=received_at,
        due_on=(timezone.localtime(received_at) + timedelta(days=DSR_DAYS)).date(), submitted_by=actor,
    )
    request.save()
    record_audit_event(actor=actor, institution=institution, entity=request, action="privacy.request.received", metadata={"type": request_type})
    return request


@transaction.atomic
def close_request(*, request, actor, status, outcome):
    request = DataSubjectRequest.objects.select_for_update().get(pk=request.pk)
    if request.status in (DataSubjectRequest.Status.COMPLETED, DataSubjectRequest.Status.REJECTED):
        raise ValidationError({"status": "This request is already closed."})
    if status not in (DataSubjectRequest.Status.IN_PROGRESS, DataSubjectRequest.Status.COMPLETED, DataSubjectRequest.Status.REJECTED):
        raise ValidationError({"status": "Choose in progress, completed or refused."})
    if status != DataSubjectRequest.Status.IN_PROGRESS and not (outcome or "").strip():
        raise ValidationError({"outcome": "Record what was done, or why the request was refused."})
    request.status = status
    request.outcome = (outcome or request.outcome).strip()
    request.handled_by = actor
    if status != DataSubjectRequest.Status.IN_PROGRESS:
        request.closed_at = timezone.now()
    request.save()
    record_audit_event(actor=actor, institution=request.institution, entity=request, action="privacy.request.updated", metadata={"status": status})
    return request


def export_personal_data(*, request):
    """A machine-readable copy of what ErgonX holds about the request's subject."""
    if request.employee_id:
        return _employee_export(request.employee)
    if request.candidate_id:
        return _candidate_export(request.candidate)
    raise ValidationError({"request": "Link the request to an employee or candidate first."})


def _employee_export(employee):
    from apps.documents.models import EMPLOYEE_ENTITY_TYPE, Document, PolicyAcknowledgement
    from apps.leave.models import LeaveRequest

    return {
        "generated_at": timezone.now().isoformat(),
        "subject": "employee",
        "profile": {field: str(getattr(employee, field) or "") for field in ("employee_number", "first_name", "middle_name", "last_name", "preferred_name", "work_email", "personal_email", "phone", "mobile_phone", "date_of_birth", "gender", "hire_date", "status")},
        "employment_history": [
            {"start_date": str(row.start_date), "end_date": str(row.end_date or ""), "department": row.department.name if row.department_id else "", "position": row.position.title if row.position_id else "", "employment_type": row.employment_type, "status": row.status}
            for row in employee.employments.select_related("department", "position").order_by("start_date")
        ],
        "emergency_contacts": [{"name": row.full_name, "relationship": row.relationship, "phone": row.phone, "email": row.email} for row in employee.emergency_contacts.all()],
        "leave_requests": [{"type": row.leave_type.name, "start_date": str(row.start_date), "end_date": str(row.end_date), "days": str(row.requested_days), "status": row.status} for row in LeaveRequest.objects.filter(employee=employee).select_related("leave_type").order_by("start_date")],
        "attendance_days_recorded": employee.attendance_records.count(),
        "documents": [{"name": row.original_filename, "category": row.category, "uploaded_at": row.created_at.isoformat()} for row in Document.objects.filter(entity_type=EMPLOYEE_ENTITY_TYPE, entity_id=employee.id, is_active=True)],
        "policy_acknowledgements": [{"policy": row.policy.title, "version": row.version, "signed_name": row.signed_name, "acknowledged_at": row.acknowledged_at.isoformat()} for row in PolicyAcknowledgement.objects.filter(employee=employee).select_related("policy")],
        "note": "Payslips are available under My Payslips. Ask HR for copies of any document listed here.",
    }


def _candidate_export(candidate):
    return {
        "generated_at": timezone.now().isoformat(),
        "subject": "candidate",
        "profile": {field: str(getattr(candidate, field) or "") for field in ("first_name", "middle_name", "last_name", "email", "phone", "location", "linkedin_url", "current_employer", "current_title", "years_experience", "highest_qualification")},
        "applications": [{"job": row.job_posting.title, "status": row.status, "applied_at": row.applied_at.isoformat() if row.applied_at else "", "consented_at": row.consent_at.isoformat() if row.consent_at else ""} for row in candidate.applications.select_related("job_posting")],
    }


def consent_register(institution, *, limit=500):
    """Consents and acknowledgements on record: careers-site data consent and policy signatures."""
    from apps.documents.models import PolicyAcknowledgement
    from apps.recruitment.models import Application

    rows = [
        {"kind": "CAREERS_DATA_USE", "subject": row.candidate.full_name, "detail": row.job_posting.title, "given_at": row.consent_at}
        for row in Application.objects.filter(institution=institution, consent_at__isnull=False).select_related("candidate", "job_posting").order_by("-consent_at")[:limit]
    ]
    rows += [
        {"kind": "POLICY_ACKNOWLEDGEMENT", "subject": row.employee.full_name, "detail": f"{row.policy.title} v{row.version}", "given_at": row.acknowledged_at}
        for row in PolicyAcknowledgement.objects.filter(institution=institution).select_related("employee", "policy").order_by("-acknowledged_at")[:limit]
    ]
    return sorted(rows, key=lambda row: row["given_at"], reverse=True)[:limit]
