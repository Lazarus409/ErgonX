from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.employees.models import Employment
from apps.audit.services import record_audit_event
from apps.institutions.models import InstitutionMembership
from apps.leave.models import (
    LeaveApproval,
    LeaveBalance,
    LeavePolicy,
    LeavePolicyDepartmentEligibility,
    LeavePolicyEmploymentTypeEligibility,
    LeavePolicyGenderEligibility,
    LeavePolicyGradeEligibility,
    LeavePolicyLocationEligibility,
    LeaveRequest,
)
from apps.workflows.models import ApprovalWorkflowDefinition
from apps.notifications.models import Notification


ELIGIBILITY_MODELS = {
    "eligible_departments": (LeavePolicyDepartmentEligibility, "department"),
    "eligible_grades": (LeavePolicyGradeEligibility, "grade"),
    "eligible_locations": (LeavePolicyLocationEligibility, "location"),
    "eligible_employment_types": (
        LeavePolicyEmploymentTypeEligibility,
        "employment_type",
    ),
    "eligible_genders": (LeavePolicyGenderEligibility, "gender"),
}


def _active_membership(user, institution):
    return user.memberships.filter(
        institution=institution, status=InstitutionMembership.Status.ACTIVE
    ).select_related("role").first()


def _employment_on(employee, on_date):
    return (
        Employment.objects.filter(
            employee=employee,
            start_date__lte=on_date,
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=on_date))
        .select_related("department", "grade", "location", "reports_to__employee__user")
        .order_by("-is_current", "-start_date")
        .first()
    )


def matching_policy(leave_request):
    return applicable_policy(
        employee=leave_request.employee,
        leave_type=leave_request.leave_type,
        effective_from=leave_request.start_date,
        effective_to=leave_request.end_date,
    )


def applicable_policy(*, employee, leave_type, effective_from, effective_to=None):
    effective_to = effective_to or effective_from
    employment = _employment_on(employee, effective_from)
    if employment is None:
        raise ValidationError(
            {"employee": "Employee has no employment covering the requested dates."}
        )
    policies = (
        LeavePolicy.objects.filter(
            institution=employee.institution,
            leave_type=leave_type,
            is_active=True,
            effective_from__lte=effective_from,
        )
        .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=effective_to))
        .order_by("-effective_from", "-created_at")
    )
    for policy in policies:
        if policy.applies_to(employee, employment, effective_from):
            return policy
    raise ValidationError(
        {"leave_type": "No active leave policy applies to this employee and date range."}
    )


def validate_request_against_policy(leave_request):
    leave_request.full_clean()
    policy = matching_policy(leave_request)
    if policy.max_consecutive_days is not None:
        if leave_request.requested_days > policy.max_consecutive_days:
            raise ValidationError(
                {
                    "requested_days": (
                        "Requested days exceed the policy's maximum consecutive allowance."
                    )
                }
            )
    if (
        leave_request.leave_type.requires_attachment or policy.requires_document
    ) and not leave_request.attachment_id:
        raise ValidationError({"attachment": "This leave request requires a document."})
    return policy


def _locked_balance(leave_request, policy):
    initial_accrual = (
        policy.annual_entitlement
        if policy.accrual_method
        in {LeavePolicy.AccrualMethod.NONE, LeavePolicy.AccrualMethod.ANNUAL}
        else Decimal("0")
    )
    balance, _ = LeaveBalance.objects.select_for_update().get_or_create(
        institution=leave_request.institution,
        employee=leave_request.employee,
        leave_type=leave_request.leave_type,
        year=leave_request.start_date.year,
        defaults={"accrued": initial_accrual},
    )
    return balance


def _ensure_sufficient_balance(leave_request, policy):
    balance = _locked_balance(leave_request, policy)
    if not policy.allow_negative_balance and balance.available < leave_request.requested_days:
        raise ValidationError(
            {
                "requested_days": (
                    f"Insufficient leave balance; {balance.available} day(s) available."
                )
            }
        )
    return balance


def _consume_balance(leave_request, policy):
    balance = _ensure_sufficient_balance(leave_request, policy)
    balance.used += leave_request.requested_days
    balance.save(update_fields=("used", "updated_at"))
    return balance


def _restore_balance(leave_request):
    balance = LeaveBalance.objects.select_for_update().get(
        employee=leave_request.employee,
        leave_type=leave_request.leave_type,
        year=leave_request.start_date.year,
    )
    balance.used = max(Decimal("0"), balance.used - leave_request.requested_days)
    balance.save(update_fields=("used", "updated_at"))


def _configured_approvers(leave_request):
    definition = (
        ApprovalWorkflowDefinition.objects.filter(
            institution=leave_request.institution,
            entity_type__in=("leave.LeaveRequest", "LeaveRequest"),
            is_active=True,
        )
        .prefetch_related("steps__approver_user", "steps__approver_role")
        .order_by("created_at")
        .first()
    )
    if definition:
        resolved = []
        for step in definition.steps.order_by("order"):
            approver = step.approver_user
            if approver is None and step.approver_role_id:
                membership = (
                    InstitutionMembership.objects.filter(
                        institution=leave_request.institution,
                        role=step.approver_role,
                        status=InstitutionMembership.Status.ACTIVE,
                    )
                    .select_related("user")
                    .order_by("joined_at", "created_at")
                    .first()
                )
                approver = membership.user if membership else None
            if approver is None:
                raise ValidationError(
                    {"approval": f"No active approver is available for step {step.order}."}
                )
            resolved.append(approver)
        if resolved:
            return resolved

    employment = _employment_on(leave_request.employee, leave_request.start_date)
    fallback = []
    if employment and employment.reports_to_id:
        manager = employment.reports_to.employee.user
        if manager:
            fallback.append(manager)
    hr_membership = (
        InstitutionMembership.objects.filter(
            institution=leave_request.institution,
            role__code="HR_ADMIN",
            status=InstitutionMembership.Status.ACTIVE,
        )
        .select_related("user")
        .order_by("joined_at", "created_at")
        .first()
    )
    if hr_membership and hr_membership.user not in fallback:
        fallback.append(hr_membership.user)
    if not fallback:
        raise ValidationError(
            {"approval": "No configured workflow, manager, or active HR approver exists."}
        )
    return fallback


def _notify(user, leave_request, notification_type, title, message):
    if user is None:
        return
    Notification.objects.create(
        institution=leave_request.institution,
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        channel=Notification.Channel.IN_APP,
        metadata={"leave_request_id": str(leave_request.id)},
    )


@transaction.atomic
def configure_policy(*, institution, eligibility=None, policy=None, **values):
    if policy is None:
        policy = LeavePolicy(institution=institution, **values)
    else:
        if policy.institution_id != institution.id:
            raise ValidationError({"policy": "Policy belongs to another institution."})
        for field, value in values.items():
            setattr(policy, field, value)
    policy.save()

    if eligibility is not None:
        for key, (model, field_name) in ELIGIBILITY_MODELS.items():
            if key not in eligibility:
                continue
            model.objects.filter(policy=policy).delete()
            for value in eligibility[key]:
                relation_value = getattr(value, "pk", value)
                model.objects.create(
                    institution=institution,
                    policy=policy,
                    **{field_name: value if hasattr(value, "pk") else relation_value},
                )
    return policy


@transaction.atomic
def create_leave_request(*, institution, actor, **values):
    membership = _active_membership(actor, institution)
    if membership is None:
        raise ValidationError({"actor": "Requester must be an active institution member."})
    employee = values.get("employee")
    if employee and employee.user_id != actor.id and not membership.role.permissions.filter(
        code="leave.configure"
    ).exists():
        raise ValidationError({"employee": "Requester may only create their own leave request."})
    leave_request = LeaveRequest(institution=institution, status=LeaveRequest.Status.DRAFT, **values)
    validate_request_against_policy(leave_request)
    leave_request.save()
    record_audit_event(
        actor=actor,
        institution=institution,
        entity=leave_request,
        action="leave.request.created",
    )
    return leave_request


@transaction.atomic
def submit_leave_request(*, leave_request, actor):
    leave_request = LeaveRequest.objects.select_for_update().get(pk=leave_request.pk)
    if leave_request.status != LeaveRequest.Status.DRAFT:
        raise ValidationError({"status": "Only draft requests can be submitted."})
    membership = _active_membership(actor, leave_request.institution)
    if membership is None:
        raise ValidationError({"actor": "Requester must be an active institution member."})
    if leave_request.employee.user_id != actor.id and not membership.role.permissions.filter(
        code="leave.configure"
    ).exists():
        raise ValidationError({"employee": "Requester may only submit their own leave request."})

    policy = validate_request_against_policy(leave_request)
    _ensure_sufficient_balance(leave_request, policy)
    leave_request.submitted_at = timezone.now()
    if leave_request.leave_type.requires_approval:
        leave_request.status = LeaveRequest.Status.PENDING
        leave_request.save(update_fields=("status", "submitted_at", "updated_at"))
        approvers = _configured_approvers(leave_request)
        for sequence, approver in enumerate(approvers, start=1):
            LeaveApproval.objects.create(
                institution=leave_request.institution,
                leave_request=leave_request,
                approver=approver,
                sequence=sequence,
            )
        _notify(
            approvers[0],
            leave_request,
            "LEAVE_APPROVAL_REQUIRED",
            "Leave approval required",
            f"Leave request for {leave_request.employee.full_name} requires review.",
        )
    else:
        _consume_balance(leave_request, policy)
        leave_request.status = LeaveRequest.Status.APPROVED
        leave_request.save(update_fields=("status", "submitted_at", "updated_at"))
        _notify(
            leave_request.employee.user,
            leave_request,
            "LEAVE_APPROVED",
            "Leave approved",
            "Your leave request was approved automatically.",
        )
    record_audit_event(
        actor=actor,
        institution=leave_request.institution,
        entity=leave_request,
        action="leave.request.submitted",
        metadata={"status": leave_request.status},
    )
    return leave_request


@transaction.atomic
def approve_leave_request(*, leave_request, actor, comment=""):
    leave_request = LeaveRequest.objects.select_for_update().get(pk=leave_request.pk)
    if leave_request.status != LeaveRequest.Status.PENDING:
        raise ValidationError({"status": "Only pending requests can be approved."})
    approval = (
        LeaveApproval.objects.select_for_update()
        .filter(leave_request=leave_request, status=LeaveApproval.Status.PENDING)
        .order_by("sequence")
        .first()
    )
    if approval is None or approval.approver_id != actor.id:
        raise ValidationError({"approver": "This is not the actor's active approval step."})
    approval.status = LeaveApproval.Status.APPROVED
    approval.comment = comment
    approval.acted_at = timezone.now()
    approval.save(update_fields=("status", "comment", "acted_at", "updated_at"))

    if not LeaveApproval.objects.filter(
        leave_request=leave_request, status=LeaveApproval.Status.PENDING
    ).exists():
        policy = validate_request_against_policy(leave_request)
        _consume_balance(leave_request, policy)
        leave_request.status = LeaveRequest.Status.APPROVED
        leave_request.save(update_fields=("status", "updated_at"))
        _notify(
            leave_request.employee.user,
            leave_request,
            "LEAVE_APPROVED",
            "Leave approved",
            "Your leave request has been approved.",
        )
    else:
        next_approval = LeaveApproval.objects.filter(
            leave_request=leave_request, status=LeaveApproval.Status.PENDING
        ).order_by("sequence").first()
        if next_approval:
            _notify(
                next_approval.approver,
                leave_request,
                "LEAVE_APPROVAL_REQUIRED",
                "Leave approval required",
                f"Leave request for {leave_request.employee.full_name} requires review.",
            )
    record_audit_event(
        actor=actor,
        institution=leave_request.institution,
        entity=leave_request,
        action="leave.request.approved_step",
        metadata={"sequence": approval.sequence, "final_status": leave_request.status},
    )
    return leave_request


@transaction.atomic
def reject_leave_request(*, leave_request, actor, comment=""):
    leave_request = LeaveRequest.objects.select_for_update().get(pk=leave_request.pk)
    if leave_request.status != LeaveRequest.Status.PENDING:
        raise ValidationError({"status": "Only pending requests can be rejected."})
    approval = (
        LeaveApproval.objects.select_for_update()
        .filter(leave_request=leave_request, status=LeaveApproval.Status.PENDING)
        .order_by("sequence")
        .first()
    )
    if approval is None or approval.approver_id != actor.id:
        raise ValidationError({"approver": "This is not the actor's active approval step."})
    approval.status = LeaveApproval.Status.REJECTED
    approval.comment = comment
    approval.acted_at = timezone.now()
    approval.save(update_fields=("status", "comment", "acted_at", "updated_at"))
    LeaveApproval.objects.filter(
        leave_request=leave_request, status=LeaveApproval.Status.PENDING
    ).update(status=LeaveApproval.Status.SKIPPED, updated_at=timezone.now())
    leave_request.status = LeaveRequest.Status.REJECTED
    leave_request.save(update_fields=("status", "updated_at"))
    _notify(
        leave_request.employee.user,
        leave_request,
        "LEAVE_REJECTED",
        "Leave rejected",
        "Your leave request has been rejected.",
    )
    record_audit_event(
        actor=actor,
        institution=leave_request.institution,
        entity=leave_request,
        action="leave.request.rejected",
        metadata={"sequence": approval.sequence},
    )
    return leave_request


@transaction.atomic
def cancel_leave_request(*, leave_request, actor):
    leave_request = LeaveRequest.objects.select_for_update().get(pk=leave_request.pk)
    if leave_request.status not in {
        LeaveRequest.Status.DRAFT,
        LeaveRequest.Status.PENDING,
        LeaveRequest.Status.APPROVED,
    }:
        raise ValidationError({"status": "This request cannot be cancelled."})
    membership = _active_membership(actor, leave_request.institution)
    if membership is None:
        raise ValidationError({"actor": "Actor must be an active institution member."})
    if leave_request.employee.user_id != actor.id and not membership.role.permissions.filter(
        code="leave.approve"
    ).exists():
        raise ValidationError({"actor": "Only the employee or a leave approver may cancel."})
    if leave_request.status == LeaveRequest.Status.APPROVED:
        _restore_balance(leave_request)
    leave_request.status = LeaveRequest.Status.CANCELLED
    leave_request.cancelled_at = timezone.now()
    leave_request.save(update_fields=("status", "cancelled_at", "updated_at"))
    record_audit_event(
        actor=actor,
        institution=leave_request.institution,
        entity=leave_request,
        action="leave.request.cancelled",
    )
    return leave_request


@transaction.atomic
def accrue_leave_balance(*, balance, actor, amount=None, as_of_date=None):
    balance = LeaveBalance.objects.select_for_update().select_related(
        "employee", "leave_type", "institution"
    ).get(pk=balance.pk)
    _membership = _active_membership(actor, balance.institution)
    if _membership is None or not _membership.role.permissions.filter(
        code="leave.balance.manage"
    ).exists():
        raise ValidationError({"actor": "Actor cannot accrue leave balances."})
    as_of_date = as_of_date or timezone.localdate()
    if as_of_date.year != balance.year:
        raise ValidationError({"as_of_date": "Accrual date must be in the balance year."})
    policy = applicable_policy(
        employee=balance.employee,
        leave_type=balance.leave_type,
        effective_from=as_of_date,
    )
    if amount is None:
        if policy.accrual_method in {
            LeavePolicy.AccrualMethod.MONTHLY,
            LeavePolicy.AccrualMethod.DAILY,
        }:
            amount = policy.accrual_rate
        elif policy.accrual_method == LeavePolicy.AccrualMethod.ANNUAL:
            amount = policy.annual_entitlement
        else:
            raise ValidationError({"amount": "An explicit accrual amount is required."})
    amount = Decimal(amount).quantize(Decimal("0.01"))
    if amount <= 0:
        raise ValidationError({"amount": "Accrual amount must be positive."})
    balance.accrued += amount
    balance.save(update_fields=("accrued", "updated_at"))
    record_audit_event(
        actor=actor,
        institution=balance.institution,
        entity=balance,
        action="leave.balance.accrued",
        metadata={"amount": str(amount), "as_of_date": as_of_date.isoformat()},
    )
    return balance


@transaction.atomic
def carry_forward_leave_balance(*, balance, actor, target_year=None):
    balance = LeaveBalance.objects.select_for_update().select_related(
        "employee", "leave_type", "institution"
    ).get(pk=balance.pk)
    membership = _active_membership(actor, balance.institution)
    if membership is None or not membership.role.permissions.filter(
        code="leave.balance.manage"
    ).exists():
        raise ValidationError({"actor": "Actor cannot carry leave balances forward."})
    target_year = target_year or balance.year + 1
    if target_year != balance.year + 1:
        raise ValidationError({"target_year": "Carry-forward must target the next year."})
    policy = applicable_policy(
        employee=balance.employee,
        leave_type=balance.leave_type,
        effective_from=date(balance.year, 12, 31),
    )
    carry = min(max(balance.available, Decimal("0")), policy.max_carry_forward)
    next_balance, created = LeaveBalance.objects.get_or_create(
        institution=balance.institution,
        employee=balance.employee,
        leave_type=balance.leave_type,
        year=target_year,
        defaults={"opening_balance": carry},
    )
    if not created and next_balance.opening_balance != carry:
        raise ValidationError(
            {"target_year": "The target balance already has a different opening balance."}
        )
    record_audit_event(
        actor=actor,
        institution=balance.institution,
        entity=next_balance,
        action="leave.balance.carried_forward",
        metadata={"source_year": balance.year, "amount": str(carry)},
    )
    return next_balance
