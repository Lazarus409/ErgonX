from datetime import datetime

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.compensation.models import EmployeeCompensation
from apps.employees.models import Employee, EmployeeOnboarding, Employment
from apps.notifications.models import Notification
from apps.recruitment.models import (
    Application,
    ApplicationStageHistory,
    Candidate,
    CandidateEvaluation,
    Interview,
    JobPosting,
    Offer,
    RecruitmentStage,
)


def _active_member(actor, institution):
    if actor is None or not actor.memberships.filter(institution=institution, status="ACTIVE").exists():
        raise ValidationError({"actor": "Actor must be an active institution member."})


def _notify(user, instance, notification_type, title, message):
    if user is None:
        return
    Notification.objects.create(
        institution=instance.institution,
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        channel=Notification.Channel.IN_APP,
        metadata={"entity_type": instance._meta.label, "entity_id": str(instance.pk)},
    )


@transaction.atomic
def publish_job_posting(*, job_posting, actor):
    posting = JobPosting.objects.select_for_update().get(pk=job_posting.pk)
    _active_member(actor, posting.institution)
    if posting.status == JobPosting.Status.OPEN:
        return posting
    if posting.status != JobPosting.Status.DRAFT:
        raise ValidationError({"status": "Only draft job postings can be published."})
    posting.status = JobPosting.Status.OPEN
    if posting.opens_on is None:
        posting.opens_on = timezone.localdate()
    posting.full_clean()
    posting.save(update_fields=("status", "opens_on", "updated_at"))
    record_audit_event(actor=actor, institution=posting.institution, entity=posting, action="recruitment.job_posting.published")
    _notify(posting.hiring_manager, posting, "RECRUITMENT_JOB_POSTING_OPEN", "Job posting opened", f"{posting.title} is now open.")
    return posting


@transaction.atomic
def close_job_posting(*, job_posting, actor, cancelled=False):
    posting = JobPosting.objects.select_for_update().get(pk=job_posting.pk)
    _active_member(actor, posting.institution)
    target = JobPosting.Status.CANCELLED if cancelled else JobPosting.Status.CLOSED
    if posting.status == target:
        return posting
    if posting.status != JobPosting.Status.OPEN:
        raise ValidationError({"status": "Only open job postings can be closed or cancelled."})
    posting.status = target
    posting.save(update_fields=("status", "updated_at"))
    record_audit_event(actor=actor, institution=posting.institution, entity=posting, action=f"recruitment.job_posting.{target.lower()}")
    return posting


@transaction.atomic
def submit_application(*, application, actor):
    instance = Application.objects.select_for_update().select_related("job_posting", "candidate").get(pk=application.pk)
    _active_member(actor, instance.institution)
    if instance.status == Application.Status.ACTIVE:
        return instance
    if instance.status != Application.Status.DRAFT:
        raise ValidationError({"status": "Only draft applications can be submitted."})
    if instance.job_posting.status != JobPosting.Status.OPEN:
        raise ValidationError({"job_posting": "Applications can only be submitted to open job postings."})
    stage = instance.current_stage or RecruitmentStage.objects.for_institution(instance.institution).filter(is_active=True).order_by("sequence").first()
    if stage is None:
        raise ValidationError({"current_stage": "Configure at least one active recruitment stage before submitting an application."})
    instance.current_stage = stage
    instance.status = Application.Status.ACTIVE
    instance.applied_at = timezone.now()
    instance.full_clean()
    instance.save(update_fields=("current_stage", "status", "applied_at", "updated_at"))
    ApplicationStageHistory.objects.create(institution=instance.institution, application=instance, to_stage=stage, changed_by=actor, comment="Application submitted")
    record_audit_event(actor=actor, institution=instance.institution, entity=instance, action="recruitment.application.submitted", metadata={"stage_id": str(stage.id)})
    _notify(instance.job_posting.hiring_manager, instance, "RECRUITMENT_APPLICATION_SUBMITTED", "New application", f"{instance.candidate.full_name} applied for {instance.job_posting.title}.")
    return instance


@transaction.atomic
def move_application_stage(*, application, stage, actor, comment=""):
    instance = Application.objects.select_for_update().get(pk=application.pk)
    _active_member(actor, instance.institution)
    if stage.institution_id != instance.institution_id:
        raise ValidationError({"stage": "Stage belongs to another institution."})
    if not stage.is_active:
        raise ValidationError({"stage": "Cannot move an application to an inactive stage."})
    if instance.status not in (Application.Status.ACTIVE, Application.Status.OFFERED):
        raise ValidationError({"status": "Only active or offered applications can move through the pipeline."})
    if instance.current_stage_id == stage.id:
        return instance
    previous_stage = instance.current_stage
    instance.current_stage = stage
    instance.save(update_fields=("current_stage", "updated_at"))
    ApplicationStageHistory.objects.create(institution=instance.institution, application=instance, from_stage=previous_stage, to_stage=stage, changed_by=actor, comment=comment)
    record_audit_event(actor=actor, institution=instance.institution, entity=instance, action="recruitment.application.stage_moved", metadata={"from_stage_id": str(previous_stage.id) if previous_stage else None, "to_stage_id": str(stage.id)})
    return instance


@transaction.atomic
def withdraw_application(*, application, actor):
    instance = Application.objects.select_for_update().get(pk=application.pk)
    _active_member(actor, instance.institution)
    if instance.status == Application.Status.WITHDRAWN:
        return instance
    if instance.status not in (Application.Status.DRAFT, Application.Status.ACTIVE, Application.Status.OFFERED):
        raise ValidationError({"status": "This application cannot be withdrawn."})
    instance.status = Application.Status.WITHDRAWN
    instance.withdrawn_at = timezone.now()
    instance.save(update_fields=("status", "withdrawn_at", "updated_at"))
    record_audit_event(actor=actor, institution=instance.institution, entity=instance, action="recruitment.application.withdrawn")
    return instance


@transaction.atomic
def reject_application(*, application, actor, reason=""):
    instance = Application.objects.select_for_update().get(pk=application.pk)
    _active_member(actor, instance.institution)
    if instance.status == Application.Status.REJECTED:
        return instance
    if instance.status not in (Application.Status.ACTIVE, Application.Status.OFFERED):
        raise ValidationError({"status": "Only active or offered applications can be rejected."})
    instance.status = Application.Status.REJECTED
    instance.rejected_at = timezone.now()
    instance.rejection_reason = reason
    instance.save(update_fields=("status", "rejected_at", "rejection_reason", "updated_at"))
    record_audit_event(actor=actor, institution=instance.institution, entity=instance, action="recruitment.application.rejected")
    return instance


@transaction.atomic
def update_interview_status(*, interview, actor, status):
    instance = Interview.objects.select_for_update().get(pk=interview.pk)
    _active_member(actor, instance.institution)
    if status not in (Interview.Status.COMPLETED, Interview.Status.CANCELLED, Interview.Status.NO_SHOW):
        raise ValidationError({"status": "Use COMPLETED, CANCELLED, or NO_SHOW for an interview action."})
    if instance.status == status:
        return instance
    if instance.status != Interview.Status.SCHEDULED:
        raise ValidationError({"status": "Only scheduled interviews can be completed, cancelled, or marked no-show."})
    instance.status = status
    instance.save(update_fields=("status", "updated_at"))
    record_audit_event(actor=actor, institution=instance.institution, entity=instance, action=f"recruitment.interview.{status.lower()}")
    return instance


@transaction.atomic
def record_evaluation(*, institution, application, interviewer, actor, **values):
    _active_member(actor, institution)
    if application.institution_id != institution.id or interviewer is None or not interviewer.memberships.filter(institution=institution, status="ACTIVE").exists():
        raise ValidationError({"application": "Application and interviewer must belong to the institution."})
    evaluation = CandidateEvaluation(institution=institution, application=application, interviewer=interviewer, **values)
    evaluation.full_clean()
    evaluation.save()
    record_audit_event(actor=actor, institution=institution, entity=evaluation, action="recruitment.evaluation.recorded", metadata={"application_id": str(application.id)})
    return evaluation


@transaction.atomic
def extend_offer(*, offer, actor):
    instance = Offer.objects.select_for_update().select_related("application__candidate", "application__job_posting").get(pk=offer.pk)
    _active_member(actor, instance.institution)
    if instance.status == Offer.Status.EXTENDED:
        return instance
    if instance.status != Offer.Status.DRAFT:
        raise ValidationError({"status": "Only draft offers can be extended."})
    if instance.application.status != Application.Status.ACTIVE:
        raise ValidationError({"application": "Only active applications can receive an offer."})
    instance.status = Offer.Status.EXTENDED
    instance.extended_at = timezone.now()
    instance.save(update_fields=("status", "extended_at", "updated_at"))
    instance.application.status = Application.Status.OFFERED
    instance.application.save(update_fields=("status", "updated_at"))
    record_audit_event(actor=actor, institution=instance.institution, entity=instance, action="recruitment.offer.extended")
    _notify(instance.application.job_posting.hiring_manager, instance, "RECRUITMENT_OFFER_EXTENDED", "Offer extended", f"An offer was extended to {instance.application.candidate.full_name}.")
    return instance


@transaction.atomic
def decide_offer(*, offer, actor, accepted):
    instance = Offer.objects.select_for_update().select_related("application").get(pk=offer.pk)
    _active_member(actor, instance.institution)
    target = Offer.Status.ACCEPTED if accepted else Offer.Status.DECLINED
    if instance.status == target:
        return instance
    if instance.status != Offer.Status.EXTENDED:
        raise ValidationError({"status": "Only extended offers can be accepted or declined."})
    instance.status = target
    now = timezone.now()
    if accepted:
        instance.accepted_at = now
        fields = ("status", "accepted_at", "updated_at")
    else:
        instance.declined_at = now
        fields = ("status", "declined_at", "updated_at")
    instance.save(update_fields=fields)
    record_audit_event(actor=actor, institution=instance.institution, entity=instance, action=f"recruitment.offer.{target.lower()}")
    return instance


@transaction.atomic
def withdraw_offer(*, offer, actor):
    instance = Offer.objects.select_for_update().get(pk=offer.pk)
    _active_member(actor, instance.institution)
    if instance.status == Offer.Status.WITHDRAWN:
        return instance
    if instance.status not in (Offer.Status.DRAFT, Offer.Status.EXTENDED):
        raise ValidationError({"status": "Only draft or extended offers can be withdrawn."})
    instance.status = Offer.Status.WITHDRAWN
    instance.save(update_fields=("status", "updated_at"))
    if instance.application.status == Application.Status.OFFERED:
        instance.application.status = Application.Status.ACTIVE
        instance.application.save(update_fields=("status", "updated_at"))
    record_audit_event(actor=actor, institution=instance.institution, entity=instance, action="recruitment.offer.withdrawn")
    return instance


@transaction.atomic
def hire_candidate(*, offer, actor, employee_number=None, existing_employee=None):
    """Complete an accepted offer by creating or linking canonical HR records.

    ``existing_employee`` supports controlled historical recruitment imports and
    deterministic demo scenarios where an employee was seeded before the ATS
    history. It never rewrites the employee or current employment record.
    """
    instance = Offer.objects.select_for_update().select_related("application__candidate").get(pk=offer.pk)
    _active_member(actor, instance.institution)
    if instance.hired_employee_id:
        return instance.hired_employee
    if instance.status != Offer.Status.ACCEPTED:
        raise ValidationError({"status": "Only accepted offers can be hired."})
    if existing_employee is None and (not employee_number or not employee_number.strip()):
        raise ValidationError({"employee_number": "An employee number is required."})
    candidate = Candidate.objects.select_for_update().get(pk=instance.application.candidate_id)
    if existing_employee is not None:
        employee = Employee.objects.select_for_update().get(pk=existing_employee.pk)
        if employee.institution_id != instance.institution_id:
            raise ValidationError({"existing_employee": "Employee belongs to another institution."})
        employment = Employment.objects.filter(employee=employee, is_current=True).first()
        if employment is None:
            raise ValidationError({"existing_employee": "Employee must have a current employment record."})
        EmployeeOnboarding.objects.get_or_create(
            institution=instance.institution,
            employee=employee,
            defaults={"status": EmployeeOnboarding.Status.NOT_STARTED, "notes": "Linked from accepted recruitment offer."},
        )
    else:
        employee = Employee(
            institution=instance.institution,
            employee_number=employee_number,
            first_name=candidate.first_name,
            middle_name=candidate.middle_name,
            last_name=candidate.last_name,
            personal_email=candidate.email,
            phone=candidate.phone,
            hire_date=instance.proposed_start_date,
        )
        employee.full_clean()
        employee.save()
        employment = Employment(institution=instance.institution, employee=employee, department=instance.department, position=instance.position, grade=instance.grade, location=instance.location, employment_type=instance.employment_type, staff_category=instance.staff_category, start_date=instance.proposed_start_date, status=Employment.Status.ACTIVE, is_current=True)
        employment.full_clean()
        employment.save()
        EmployeeOnboarding.objects.create(
            institution=instance.institution,
            employee=employee,
            status=EmployeeOnboarding.Status.NOT_STARTED,
            notes="Created from accepted recruitment offer.",
        )
    if instance.salary_structure_id and existing_employee is None:
        compensation = EmployeeCompensation(institution=instance.institution, employee=employee, salary_structure=instance.salary_structure, base_salary=instance.base_salary, currency=instance.currency, effective_from=instance.proposed_start_date, is_current=True)
        compensation.full_clean()
        compensation.save()
    instance.hired_employee = employee
    instance.status = Offer.Status.HIRED
    instance.save(update_fields=("hired_employee", "status", "updated_at"))
    instance.application.status = Application.Status.HIRED
    instance.application.save(update_fields=("status", "updated_at"))
    candidate.status = Candidate.Status.HIRED
    candidate.save(update_fields=("status", "updated_at"))
    record_audit_event(actor=actor, institution=instance.institution, entity=instance, action="recruitment.offer.hired", metadata={"employee_id": str(employee.id), "employment_id": str(employment.id)})
    _notify(instance.application.job_posting.hiring_manager, instance, "RECRUITMENT_CANDIDATE_HIRED", "Candidate hired", f"{candidate.full_name} has been converted to employee {employee.employee_number}.")
    return employee
