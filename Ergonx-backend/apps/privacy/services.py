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


def _text(value):
    return "" if value is None else (value.isoformat() if hasattr(value, "isoformat") else str(value))


def _employee_export(employee):
    """Everything ErgonX holds about an employee, for a request for a copy of their data."""
    from apps.accounting.models import Expense
    from apps.complaints.models import Complaint
    from apps.compensation.models import EmployeeCompensation, EmployeePayComponent
    from apps.documents.models import EMPLOYEE_ENTITY_TYPE, Document, PolicyAcknowledgement
    from apps.leave.models import LeaveRequest
    from apps.payroll.models import EmployeePayrollProfile, EmployeeTaxReliefClaim, Payslip
    from apps.performance.models import PerformanceReview
    from apps.training.models import TrainingEnrollment

    profile = EmployeePayrollProfile.objects.filter(employee=employee).first()
    compensation = list(EmployeeCompensation.objects.filter(employee=employee).order_by("effective_from"))
    components = {}
    for item in EmployeePayComponent.objects.filter(employee_compensation__in=compensation).select_related("pay_component"):
        components.setdefault(item.employee_compensation_id, []).append({"component": item.pay_component.name, "amount": _text(item.amount), "percentage": _text(item.percentage)})
    return {
        "generated_at": timezone.now().isoformat(),
        "subject": "employee",
        "profile": {field: _text(getattr(employee, field)) for field in ("employee_number", "first_name", "middle_name", "last_name", "preferred_name", "work_email", "personal_email", "phone", "mobile_phone", "office_location", "linkedin_url", "date_of_birth", "gender", "hire_date", "status", "share_birthday", "share_work_anniversary")},
        "employment_history": [
            {"start_date": _text(row.start_date), "end_date": _text(row.end_date), "department": row.department.name if row.department_id else "", "position": row.position.title if row.position_id else "", "employment_type": row.employment_type, "status": row.status}
            for row in employee.employments.select_related("department", "position").order_by("start_date")
        ],
        "emergency_contacts": [{"name": row.full_name, "relationship": row.relationship, "phone": row.phone, "alternate_phone": row.alternate_phone, "email": row.email, "address": row.address} for row in employee.emergency_contacts.all()],
        "pay_and_tax_details": None if profile is None else {
            field: _text(getattr(profile, field)) for field in ("tax_residency", "tax_identification_number", "social_security_number", "payment_method", "bank_name", "bank_branch", "bank_sort_code", "account_name", "account_number", "mobile_money_network", "mobile_money_number", "pension_exempt", "pension_exemption_reason")
        },
        "compensation": [
            {"base_salary": _text(row.base_salary), "currency": row.currency, "pay_basis": row.pay_basis, "effective_from": _text(row.effective_from), "effective_to": _text(row.effective_to), "components": components.get(row.id, [])}
            for row in compensation
        ],
        "payslips": [
            {"period": row.payroll_record.payroll_run.payroll_period.name, "gross_pay": _text(row.payroll_record.gross_pay), "total_deductions": _text(row.payroll_record.total_deductions), "net_pay": _text(row.payroll_record.net_pay), "currency": row.payroll_record.currency, "generated_at": _text(row.generated_at)}
            for row in Payslip.objects.filter(payroll_record__employee=employee).select_related("payroll_record__payroll_run__payroll_period").order_by("generated_at")
        ],
        "tax_relief_claims": [{"relief": row.relief_definition.name, "tax_year": row.tax_year, "claimed": _text(row.claimed_amount), "approved": _text(row.approved_amount), "status": row.status} for row in EmployeeTaxReliefClaim.objects.filter(employee=employee).select_related("relief_definition")],
        "leave_requests": [{"type": row.leave_type.name, "start_date": _text(row.start_date), "end_date": _text(row.end_date), "days": _text(row.requested_days), "reason": row.reason, "status": row.status} for row in LeaveRequest.objects.filter(employee=employee).select_related("leave_type").order_by("start_date")],
        "attendance": [
            {"date": _text(row.attendance_date), "status": row.status, "check_in": _text(row.check_in), "check_out": _text(row.check_out), "worked_minutes": row.worked_minutes, "source": row.source, "check_in_position": row.check_in_position, "check_out_position": row.check_out_position}
            for row in employee.attendance_records.order_by("attendance_date")
        ],
        "performance_reviews": [
            {"cycle": row.cycle.name, "status": row.status, "self_summary": row.self_summary, "manager_summary": row.manager_summary, "development_plan": row.development_plan, "overall_rating": row.overall_rating, "calibrated_rating": row.calibrated_rating}
            for row in PerformanceReview.objects.filter(employee=employee).select_related("cycle").order_by("cycle__period_start")
        ],
        "training": [{"course": row.course.title, "status": row.status, "completed_on": _text(row.completed_on), "score": _text(row.score), "certificate_number": row.certificate_number, "certificate_expires_on": _text(row.certificate_expires_on)} for row in TrainingEnrollment.objects.filter(employee=employee).select_related("course")],
        "expense_claims": [{"date": _text(row.expense_date), "amount": _text(row.amount), "currency": row.currency, "description": row.description, "status": row.status} for row in Expense.objects.filter(claimant=employee).order_by("expense_date")],
        # Complaints the employee raised. Complaints naming them are withheld where disclosure would affect others.
        "complaints_raised": [{"reference": row.code, "subject": row.subject, "category": row.category, "description": row.description, "status": row.status, "resolution": row.resolution} for row in Complaint.objects.filter(complainant=employee)],
        "documents": [{"name": row.original_filename, "category": row.category, "classification": row.classification, "uploaded_at": row.created_at.isoformat()} for row in Document.objects.filter(entity_type=EMPLOYEE_ENTITY_TYPE, entity_id=employee.id, is_active=True)],
        "policy_acknowledgements": [{"policy": row.policy.title, "version": row.version, "signed_name": row.signed_name, "acknowledged_at": row.acknowledged_at.isoformat()} for row in PolicyAcknowledgement.objects.filter(employee=employee).select_related("policy")],
        "note": "Copies of documents and payslip PDFs are available from HR or My Payslips. Complaints that name you are withheld where disclosing them would affect other people's rights.",
    }


def _candidate_export(candidate):
    from apps.documents.models import Document
    from apps.recruitment.models import Interview, Offer

    applications = list(candidate.applications.select_related("job_posting"))
    interviews, offers = {}, {}
    for item in Interview.objects.filter(application__in=applications):
        interviews.setdefault(item.application_id, []).append({"scheduled_at": _text(item.scheduled_at), "type": item.interview_type, "status": item.status})
    for item in Offer.objects.filter(application__in=applications):
        offers.setdefault(item.application_id, []).append({"status": item.status, "base_salary": _text(item.base_salary), "currency": item.currency, "proposed_start_date": _text(item.proposed_start_date)})
    return {
        "generated_at": timezone.now().isoformat(),
        "subject": "candidate",
        "profile": {field: _text(getattr(candidate, field)) for field in ("first_name", "middle_name", "last_name", "email", "phone", "location", "linkedin_url", "current_employer", "current_title", "years_experience", "highest_qualification", "field_of_study", "education_institution", "skills", "notice_period_weeks")},
        "applications": [
            {"job": row.job_posting.title, "status": row.status, "applied_at": _text(row.applied_at), "consented_at": _text(row.consent_at), "cover_letter": row.cover_letter, "rejection_reason": row.rejection_reason,
             "interviews": interviews.get(row.id, []), "offers": offers.get(row.id, [])}
            for row in applications
        ],
        "documents": [{"name": row.original_filename, "category": row.category, "uploaded_at": row.created_at.isoformat()} for row in Document.objects.filter(entity_type="recruitment.Candidate", entity_id=candidate.id, is_active=True)],
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


# ----------------------------------------------------------- scheduled retention


def run_due_retention(*, institutions=None):
    """Apply every active anonymising rule; run daily. Returns {institution code: records changed}."""
    from apps.institutions.models import Institution

    results = {}
    for institution in institutions if institutions is not None else Institution.objects.filter(is_active=True):
        rules = RetentionRule.objects.for_institution(institution).filter(is_active=True, action=RetentionRule.Action.ANONYMISE)
        for rule in rules:
            with transaction.atomic():
                done = run_retention(institution=institution, actor=None, rule=rule)
            results[institution.code] = results.get(institution.code, 0) + done
    return results


# ------------------------------------------------- registration and compliance

REGISTRATION_WARNING_DAYS = 60


def privacy_profile(institution):
    from apps.privacy.models import PrivacyProfile

    return PrivacyProfile.objects.get_or_create(institution=institution)[0]


def compliance_summary(institution):
    """What needs attention: registration, the data protection officer, breaches not yet reported, overdue requests."""
    from apps.privacy.models import DataBreach

    profile = privacy_profile(institution)
    today = timezone.localdate()
    if not profile.registration_number:
        registration = "MISSING"
    elif profile.registration_expires_on and profile.registration_expires_on < today:
        registration = "EXPIRED"
    elif profile.registration_expires_on and profile.registration_expires_on <= today + timedelta(days=REGISTRATION_WARNING_DAYS):
        registration = "EXPIRING"
    else:
        registration = "OK"
    breaches = DataBreach.objects.for_institution(institution).exclude(status=DataBreach.Status.CLOSED)
    return {
        "registration": registration,
        "registration_expires_on": profile.registration_expires_on,
        "officer_named": bool(profile.officer_name and profile.officer_email),
        "open_breaches": breaches.count(),
        "breaches_not_reported": breaches.filter(commission_notified_at__isnull=True).count(),
        "overdue_requests": DataSubjectRequest.objects.for_institution(institution).filter(
            status__in=(DataSubjectRequest.Status.RECEIVED, DataSubjectRequest.Status.IN_PROGRESS), due_on__lt=today
        ).count(),
    }


PROFILE_FIELDS = ("registration_number", "registered_on", "registration_expires_on", "officer_name", "officer_email", "officer_phone")


@transaction.atomic
def update_privacy_profile(*, institution, actor, **values):
    profile = privacy_profile(institution)
    changed = {}
    for field in PROFILE_FIELDS:
        if field in values and getattr(profile, field) != values[field]:
            changed[field] = [_text(getattr(profile, field)), _text(values[field])]
            setattr(profile, field, values[field])
    profile.full_clean()
    profile.save()
    if changed:
        record_audit_event(actor=actor, institution=institution, entity=profile, action="privacy.profile.updated", metadata={"changes": changed})
    return profile


# ------------------------------------------------------------- breach register

BREACH_FIELDS = (
    "title", "description", "discovered_at", "occurred_at", "severity", "data_categories", "people_affected", "containment",
    "contained_at", "commission_notified_at", "commission_reference", "subjects_notified_at", "not_notifying_reason", "lessons_learned",
)


@transaction.atomic
def record_breach(*, institution, actor, **values):
    from apps.privacy.models import DataBreach

    breach = DataBreach(institution=institution, reported_by=actor, **{key: value for key, value in values.items() if key in BREACH_FIELDS})
    breach.status = DataBreach.Status.CONTAINED if breach.contained_at else DataBreach.Status.OPEN
    breach.full_clean()
    breach.save()
    record_audit_event(actor=actor, institution=institution, entity=breach, action="privacy.breach.recorded", metadata={"severity": breach.severity, "data_categories": breach.data_categories})
    return breach


@transaction.atomic
def update_breach(*, breach, actor, close=False, **values):
    from apps.privacy.models import DataBreach

    breach = DataBreach.objects.select_for_update().get(pk=breach.pk)
    if breach.status == DataBreach.Status.CLOSED:
        raise ValidationError({"status": "This breach is closed."})
    changed = []
    for field in BREACH_FIELDS:
        if field in values and getattr(breach, field) != values[field]:
            setattr(breach, field, values[field])
            changed.append(field)
    if breach.contained_at and breach.status == DataBreach.Status.OPEN:
        breach.status = DataBreach.Status.CONTAINED
    if close:
        if not breach.contained_at:
            raise ValidationError({"contained_at": "Record when the breach was contained before closing it."})
        if not breach.commission_notified_at and not breach.not_notifying_reason.strip():
            raise ValidationError({"commission_notified_at": "Record when the Data Protection Commission was notified, or why it was not."})
        if not breach.subjects_notified_at and not breach.not_notifying_reason.strip():
            raise ValidationError({"subjects_notified_at": "Record when the affected people were told, or why they were not."})
        breach.status = DataBreach.Status.CLOSED
        breach.closed_at = timezone.now()
    breach.full_clean()
    breach.save()
    record_audit_event(actor=actor, institution=breach.institution, entity=breach, action="privacy.breach.closed" if close else "privacy.breach.updated", metadata={"fields": changed, "status": breach.status})
    return breach
