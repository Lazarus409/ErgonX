from datetime import timedelta

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.workflows.models import ApprovalAction, ApprovalRequest


@transaction.atomic
def submit_approval_request(*, institution, workflow, entity_type, entity_id, requested_by, metadata=None):
    if workflow.institution_id != institution.id or not workflow.is_active:
        raise ValidationError("The selected approval workflow is not active for this institution.")
    first_step = workflow.steps.order_by("order").first()
    if first_step is None:
        raise ValidationError("An approval workflow needs at least one step.")
    request = ApprovalRequest.objects.create(
        institution=institution, workflow=workflow, entity_type=entity_type,
        entity_id=entity_id, requested_by=requested_by, current_step=first_step,
        due_at=timezone.now() + timedelta(hours=first_step.due_after_hours) if first_step.due_after_hours else None,
        metadata=metadata or {},
    )
    record_audit_event(actor=requested_by, institution=institution, entity=request, action="APPROVAL_REQUESTED")
    return request


@transaction.atomic
def decide_approval_request(*, request, actor, action, comments=""):
    request = ApprovalRequest.objects.select_related("current_step", "workflow").select_for_update(of=("self",)).get(pk=request.pk)
    if request.status != ApprovalRequest.Status.PENDING or request.current_step_id is None:
        raise ValidationError("Only pending approval requests can be decided.")
    step = request.current_step
    if action not in (ApprovalAction.Action.APPROVE, ApprovalAction.Action.REJECT, ApprovalAction.Action.CANCEL):
        raise ValidationError("Unsupported approval action.")
    if action == ApprovalAction.Action.CANCEL and request.requested_by_id != actor.id:
        raise PermissionDenied("Only the requester can cancel an approval request.")
    if action != ApprovalAction.Action.CANCEL:
        is_assigned_user = step.approver_user_id == actor.id
        is_assigned_role = step.approver_role_id and actor.memberships.filter(institution=request.institution, role_id=step.approver_role_id, status="ACTIVE").exists()
        if not (is_assigned_user or is_assigned_role):
            raise PermissionDenied("You are not assigned to the current approval step.")
    ApprovalAction.objects.create(institution=request.institution, request=request, step=step, actor=actor, action=action, comments=comments)
    if action == ApprovalAction.Action.APPROVE:
        next_step = request.workflow.steps.filter(order__gt=step.order).order_by("order").first()
        if next_step:
            request.current_step = next_step
            request.due_at = timezone.now() + timedelta(hours=next_step.due_after_hours) if next_step.due_after_hours else None
        else:
            request.status = ApprovalRequest.Status.APPROVED
            request.current_step = None
            request.completed_at = timezone.now()
    else:
        request.status = ApprovalRequest.Status.REJECTED if action == ApprovalAction.Action.REJECT else ApprovalRequest.Status.CANCELLED
        request.current_step = None
        request.completed_at = timezone.now()
    request.save(update_fields=("status", "current_step", "due_at", "completed_at", "updated_at"))
    record_audit_event(actor=actor, institution=request.institution, entity=request, action=f"APPROVAL_{action}", metadata={"comments": comments})
    return request
