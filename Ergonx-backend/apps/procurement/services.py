"""Procurement services (Future additions item 9).

Lifecycle:
    Requisition  DRAFT -> PENDING (approval steps) -> APPROVED -> ORDERED
                 with RETURNED (back to the requester), REJECTED and CANCELLED.
    Order        DRAFT -> PENDING -> ISSUED -> PART_RECEIVED -> RECEIVED -> CLOSED
                 with CANCELLED (only before anything is received).
    Receipt      records what arrived; quantities never exceed what is outstanding.
    Bill         a draft vendor bill for what was received and not yet billed.

Rules that always hold:
* nobody approves their own requisition, or an order they created, submitted or requested;
* a person approves at most one step of a requisition;
* nothing is billed beyond what was received (three-way match);
* money moves only through accounting: a bill raised here is an ordinary vendor bill.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.accounting.models import AccountingPeriod, BudgetLine, Budget, FiscalYear, VendorBill
from apps.audit.services import record_audit_event
from apps.notifications.models import Notification
from apps.procurement.models import (
    GoodsReceipt,
    GoodsReceiptLine,
    PurchaseOrder,
    PurchaseOrderBill,
    PurchaseOrderBillLine,
    PurchaseOrderLine,
    PurchaseRequisition,
    RequisitionApproval,
    RequisitionLine,
)
from common.exceptions import CodedValidationError

ZERO = Decimal("0")
_MONEY = Decimal("0.01")
ReqStatus = PurchaseRequisition.Status
OrderStatus = PurchaseOrder.Status


def _money(value):
    return Decimal(value or 0).quantize(_MONEY)


def _qty(value):
    return Decimal(value or 0)


def _qtext(value):
    """A quantity as plain text without trailing zeros: 6, 2.5."""
    return f"{_qty(value).normalize():f}"


def _has(actor, institution, code):
    return actor.memberships.filter(institution=institution, status="ACTIVE", role__permissions__code=code).exists()


def _require(actor, institution, code):
    if not _has(actor, institution, code):
        raise CodedValidationError({"actor": "Your role does not allow this."}, api_code="permission_denied")


def _transition(before, after, **metadata):
    return {"before": {"status": before}, "after": {"status": after}, **metadata}


def _notify(user, institution, notification_type, title, message, *, route, metadata):
    if user is None:
        return
    Notification.objects.create(
        institution=institution, user=user, notification_type=notification_type, title=title, message=message,
        channel=Notification.Channel.IN_APP, metadata={**metadata, "route_hint": route},
    )


def _holders(institution, permission, *, exclude=()):
    excluded = {getattr(user, "pk", user) for user in exclude if user is not None}
    return [
        membership.user
        for membership in institution.memberships.filter(status="ACTIVE", role__permissions__code=permission, role__is_read_only=False)
        .select_related("user").distinct()
        if membership.user_id not in excluded
    ]


def base_currency(institution):
    from apps.accounting.expenses import base_currency as accounting_base_currency

    return accounting_base_currency(institution) or "GHS"


def _ensure_editable(record, statuses, message):
    if record.status not in statuses:
        raise CodedValidationError({"status": message}, api_code="record_immutable")


def _tax_amount(line):
    from apps.accounting.services import _tax_component_amounts

    return sum(_tax_component_amounts(line).values(), ZERO)


def _check_tax_code(institution, tax_code, on_date):
    if tax_code is None:
        return
    configuration = getattr(institution, "accounting_configuration", None)
    preset_version_id = getattr(configuration, "selected_accounting_preset_version_id", None)
    if not preset_version_id or tax_code.preset_version_id != preset_version_id:
        raise CodedValidationError({"lines": "The tax code must come from the organisation's accounting setup."}, api_code="validation_error")
    if not tax_code.is_active or tax_code.effective_from > on_date or (tax_code.effective_to and tax_code.effective_to < on_date):
        raise CodedValidationError({"lines": f"Tax code {tax_code.code} is not in effect on {on_date:%d %b %Y}."}, api_code="validation_error")


# ---- requisitions --------------------------------------------------------------------------


def _requester_employment(user, institution):
    from apps.employees.models import Employment

    return (
        Employment.objects.filter(employee__institution=institution, employee__user=user, is_current=True)
        .select_related("employee", "department", "reports_to__employee__user")
        .first()
    )


def _write_requisition_lines(requisition, lines):
    if not lines:
        raise CodedValidationError({"lines": "Add at least one item."}, api_code="validation_error")
    requisition.lines.all().delete()
    total = ZERO
    for sequence, values in enumerate(lines, start=1):
        line = RequisitionLine(
            institution=requisition.institution, requisition=requisition, sequence=sequence,
            description=values["description"], quantity=values["quantity"], unit=values.get("unit", ""),
            estimated_unit_price=values.get("estimated_unit_price") or ZERO, expense_account=values.get("expense_account"),
        )
        line.line_total = _money(_qty(line.quantity) * _qty(line.estimated_unit_price))
        line.save()
        total += line.line_total
    requisition.estimated_total = _money(total)
    requisition.save(update_fields=("estimated_total", "updated_at"))


@transaction.atomic
def create_requisition(*, institution, actor, lines, **values):
    _require(actor, institution, "requisition.create_own")
    if "department" not in values or values.get("department") is None:
        employment = _requester_employment(actor, institution)
        values["department"] = employment.department if employment else None
    requisition = PurchaseRequisition(institution=institution, requested_by=actor, currency=values.pop("currency", None) or base_currency(institution), **values)
    requisition.save()
    _write_requisition_lines(requisition, lines)
    record_audit_event(actor=actor, institution=institution, entity=requisition, action="procurement.requisition.created", metadata={"lines": len(lines), "estimated_total": str(requisition.estimated_total)})
    return requisition


def _lock_requisition(requisition):
    return PurchaseRequisition.objects.select_for_update(of=("self",)).select_related("institution", "requested_by").get(pk=requisition.pk)


@transaction.atomic
def update_requisition(*, requisition, actor, lines=None, **values):
    requisition = _lock_requisition(requisition)
    if requisition.requested_by_id != actor.id:
        raise CodedValidationError({"actor": "Only the requester can change this requisition."}, api_code="permission_denied")
    _ensure_editable(requisition, PurchaseRequisition.EDITABLE, "Only draft or returned requisitions can be changed.")
    for field, value in values.items():
        setattr(requisition, field, value)
    requisition.save()
    if lines is not None:
        _write_requisition_lines(requisition, lines)
    record_audit_event(actor=actor, institution=requisition.institution, entity=requisition, action="procurement.requisition.updated", metadata={"fields": sorted(values)})
    return requisition


def _requisition_chain(requisition):
    """[(step name, approver or None)]: the PURCHASE_REQUISITION workflow, else line manager then procurement."""
    from apps.workflows.engine import Trigger, department_head_of, resolve_chain, resolve_definition

    institution, requester = requisition.institution, requisition.requested_by
    employment = _requester_employment(requester, institution)
    definition = resolve_definition(institution, Trigger.PURCHASE_REQUISITION, department=requisition.department, amount=requisition.estimated_total)
    if definition is not None and definition.steps.exists():
        return [(step.name, user) for step, user in resolve_chain(definition, institution=institution, requester=requester, employment=employment, employee_id=employment.employee_id if employment else None)]
    chain = []
    if employment is not None:
        manager = None
        if employment.reports_to_id:
            candidate = employment.reports_to.employee.user
            if candidate and candidate.pk != requester.pk and candidate.memberships.filter(institution=institution, status="ACTIVE").exists():
                manager = candidate
        if manager is None:
            manager = department_head_of(employment.department, exclude_employee_id=employment.employee_id, institution=institution)
        if manager is not None:
            chain.append(("Manager approval", manager))
    named = {user.pk for _, user in chain}
    if not _holders(institution, "requisition.approve", exclude=(requester, *named)):
        if chain:
            return chain
        raise CodedValidationError(
            {"approval": "Nobody can approve this requisition: you have no manager in ErgonX and nobody else holds the procurement approval permission."},
            api_code="policy_not_applicable",
        )
    chain.append(("Procurement approval", None))
    return chain


def _current_requisition_step(requisition):
    return requisition.approvals.filter(status=RequisitionApproval.Status.PENDING).order_by("sequence").first()


def may_decide_step(step, user):
    """Whether ``user`` may decide this pending step (named approver, or a procurement approver)."""
    requisition = step.requisition
    if user.pk == requisition.requested_by_id:
        return False
    if step.approver_id is not None:
        return step.approver_id == user.pk
    return _has(user, requisition.institution, "requisition.approve") and not user.memberships.filter(institution=requisition.institution, role__is_read_only=True).exists()


def _notify_step(requisition, step):
    message = f"{requisition.requested_by.get_full_name() or requisition.requested_by.email}: {requisition.title} ({requisition.estimated_total} {requisition.currency})."
    users = [step.approver] if step.approver_id else _holders(requisition.institution, "requisition.approve", exclude=(requisition.requested_by,))
    for user in users:
        _notify(user, requisition.institution, "PROCUREMENT_REQUISITION_APPROVAL", "Purchase requisition to approve", message, route="/approvals", metadata={"requisition_id": str(requisition.id)})


@transaction.atomic
def submit_requisition(*, requisition, actor):
    requisition = _lock_requisition(requisition)
    if requisition.status == ReqStatus.PENDING:
        return requisition
    if requisition.requested_by_id != actor.id:
        raise CodedValidationError({"actor": "Only the requester can submit this requisition."}, api_code="permission_denied")
    if requisition.status not in PurchaseRequisition.EDITABLE:
        raise CodedValidationError({"status": "Only draft or returned requisitions can be submitted."}, api_code="invalid_state_transition")
    if not requisition.lines.exists():
        raise CodedValidationError({"lines": "Add at least one item."}, api_code="validation_error")
    chain = _requisition_chain(requisition)
    requisition.approvals.filter(status=RequisitionApproval.Status.PENDING).delete()
    start = (requisition.approvals.order_by("-sequence").values_list("sequence", flat=True).first() or 0) + 1
    for offset, (name, approver) in enumerate(chain):
        RequisitionApproval.objects.create(institution=requisition.institution, requisition=requisition, sequence=start + offset, step_name=name, approver=approver)
    before = requisition.status
    requisition.status, requisition.submitted_at, requisition.decision_note = ReqStatus.PENDING, timezone.now(), ""
    requisition.save(update_fields=("status", "submitted_at", "decision_note", "updated_at"))
    _notify_step(requisition, _current_requisition_step(requisition))
    record_audit_event(actor=actor, institution=requisition.institution, entity=requisition, action="procurement.requisition.submitted",
                       metadata=_transition(before, ReqStatus.PENDING, steps=[name for name, _ in chain], estimated_total=str(requisition.estimated_total)))
    return requisition


@transaction.atomic
def decide_requisition(*, requisition, actor, decision, comment=""):
    requisition = _lock_requisition(requisition)
    if requisition.status != ReqStatus.PENDING:
        raise CodedValidationError({"status": "Only requisitions awaiting approval can be decided."}, api_code="invalid_state_transition")
    if decision not in ("approve", "return", "reject"):
        raise CodedValidationError({"decision": "Choose approve, return or reject."}, api_code="validation_error")
    if requisition.requested_by_id == actor.id:
        raise CodedValidationError({"actor": "You cannot decide your own requisition."}, api_code="separation_of_duties")
    step = requisition.approvals.select_for_update().filter(status=RequisitionApproval.Status.PENDING).order_by("sequence").first()
    if step is None or not may_decide_step(step, actor):
        raise CodedValidationError({"actor": "This approval step is not yours."}, api_code="permission_denied")
    if decision == "approve" and requisition.approvals.filter(decided_by=actor, status=RequisitionApproval.Status.APPROVED, acted_at__gte=requisition.submitted_at).exists():
        raise CodedValidationError({"actor": "You approved an earlier step, so someone else must approve this one."}, api_code="separation_of_duties")
    if decision in ("return", "reject") and not comment.strip():
        raise CodedValidationError({"comment": "Explain the decision to the requester."}, api_code="validation_error")
    step.status = {"approve": RequisitionApproval.Status.APPROVED, "return": RequisitionApproval.Status.RETURNED, "reject": RequisitionApproval.Status.REJECTED}[decision]
    step.decided_by, step.comment, step.acted_at = actor, comment.strip(), timezone.now()
    step.save(update_fields=("status", "decided_by", "comment", "acted_at", "updated_at"))
    following = _current_requisition_step(requisition) if decision == "approve" else None
    if decision == "approve" and following is not None:
        _notify_step(requisition, following)
        action = "procurement.requisition.step_approved"
    else:
        if decision != "approve":
            requisition.approvals.filter(status=RequisitionApproval.Status.PENDING).delete()
        requisition.status = {"approve": ReqStatus.APPROVED, "return": ReqStatus.RETURNED, "reject": ReqStatus.REJECTED}[decision]
        requisition.decided_at, requisition.decision_note = timezone.now(), comment.strip()
        requisition.save(update_fields=("status", "decided_at", "decision_note", "updated_at"))
        outcome = requisition.get_status_display().lower()
        _notify(requisition.requested_by, requisition.institution, f"PROCUREMENT_REQUISITION_{requisition.status}", f"Requisition {outcome}",
                comment.strip() or f"{requisition.requisition_number} {requisition.title} was {outcome}.", route=f"/procurement/requisitions/{requisition.id}", metadata={"requisition_id": str(requisition.id)})
        if requisition.status == ReqStatus.APPROVED:
            for user in _holders(requisition.institution, "purchase_order.create"):
                _notify(user, requisition.institution, "PROCUREMENT_REQUISITION_TO_ORDER", "Requisition ready to order",
                        f"{requisition.requisition_number} {requisition.title} is approved.", route=f"/procurement/requisitions/{requisition.id}", metadata={"requisition_id": str(requisition.id)})
        action = {"approve": "procurement.requisition.approved", "return": "procurement.requisition.returned", "reject": "procurement.requisition.rejected"}[decision]
    record_audit_event(actor=actor, institution=requisition.institution, entity=requisition, action=action,
                       metadata=_transition(ReqStatus.PENDING, requisition.status, step=step.step_name, comment=comment.strip()))
    return requisition


@transaction.atomic
def cancel_requisition(*, requisition, actor, reason=""):
    requisition = _lock_requisition(requisition)
    if requisition.requested_by_id != actor.id and not _has(actor, requisition.institution, "purchase_order.create"):
        raise CodedValidationError({"actor": "Only the requester or procurement can cancel this requisition."}, api_code="permission_denied")
    if requisition.status not in (ReqStatus.DRAFT, ReqStatus.RETURNED, ReqStatus.PENDING, ReqStatus.APPROVED):
        raise CodedValidationError({"status": "This requisition can no longer be cancelled."}, api_code="invalid_state_transition")
    before = requisition.status
    requisition.approvals.filter(status=RequisitionApproval.Status.PENDING).delete()
    requisition.status, requisition.decision_note = ReqStatus.CANCELLED, reason.strip()
    requisition.save(update_fields=("status", "decision_note", "updated_at"))
    record_audit_event(actor=actor, institution=requisition.institution, entity=requisition, action="procurement.requisition.cancelled", metadata=_transition(before, ReqStatus.CANCELLED, reason=reason.strip()))
    return requisition


# ---- purchase orders -------------------------------------------------------------------------


def _write_order_lines(order, lines):
    if not lines:
        raise CodedValidationError({"lines": "Add at least one line."}, api_code="validation_error")
    order.lines.all().delete()
    subtotal = tax_total = ZERO
    for sequence, values in enumerate(lines, start=1):
        _check_tax_code(order.institution, values.get("tax_code"), order.order_date)
        line = PurchaseOrderLine(
            institution=order.institution, order=order, sequence=sequence, description=values["description"],
            expense_account=values.get("expense_account"), quantity=values["quantity"], unit=values.get("unit", ""),
            unit_price=values["unit_price"], tax_code=values.get("tax_code"), requisition_line=values.get("requisition_line"),
        )
        line.line_total = _money(_qty(line.quantity) * _qty(line.unit_price))
        line.save()
        subtotal += line.line_total
        tax_total += _tax_amount(line)
    order.subtotal, order.tax_total = _money(subtotal), _money(tax_total)
    order.total_amount = _money(order.subtotal + order.tax_total)
    order.save(update_fields=("subtotal", "tax_total", "total_amount", "updated_at"))


def _lock_order(order):
    return PurchaseOrder.objects.select_for_update(of=("self",)).select_related("institution", "vendor", "requisition").get(pk=order.pk)


@transaction.atomic
def create_order(*, institution, actor, lines, **values):
    _require(actor, institution, "purchase_order.create")
    requisition = values.get("requisition")
    if requisition is not None:
        requisition = _lock_requisition(requisition)
        if requisition.status != ReqStatus.APPROVED:
            raise CodedValidationError({"requisition": "Only approved requisitions can be ordered."}, api_code="invalid_state_transition")
        values["requisition"] = requisition
        values.setdefault("department", requisition.department)
    values.setdefault("order_date", timezone.localdate())
    order = PurchaseOrder(institution=institution, created_by=actor, currency=values.pop("currency", None) or base_currency(institution), **values)
    order.save()
    _write_order_lines(order, lines)
    if requisition is not None:
        requisition.status = ReqStatus.ORDERED
        requisition.save(update_fields=("status", "updated_at"))
        record_audit_event(actor=actor, institution=institution, entity=requisition, action="procurement.requisition.ordered", metadata=_transition(ReqStatus.APPROVED, ReqStatus.ORDERED, order=order.order_number))
        _notify(requisition.requested_by, institution, "PROCUREMENT_REQUISITION_ORDERED", "Your requisition is being ordered",
                f"{requisition.requisition_number} is on purchase order {order.order_number}.", route=f"/procurement/requisitions/{requisition.id}", metadata={"requisition_id": str(requisition.id)})
    record_audit_event(actor=actor, institution=institution, entity=order, action="procurement.order.created",
                       metadata={"vendor": order.vendor.name, "total_amount": str(order.total_amount), "requisition": requisition.requisition_number if requisition else ""})
    return order


def lines_from_requisition(requisition):
    """Order lines prefilled from a requisition; procurement sets the real prices before submitting."""
    return [
        {"description": line.description, "quantity": line.quantity, "unit": line.unit, "unit_price": line.estimated_unit_price,
         "expense_account": line.expense_account, "requisition_line": line}
        for line in requisition.lines.select_related("expense_account")
    ]


@transaction.atomic
def update_order(*, order, actor, lines=None, **values):
    order = _lock_order(order)
    _require(actor, order.institution, "purchase_order.create")
    _ensure_editable(order, (OrderStatus.DRAFT,), "Only draft orders can be changed.")
    values.pop("requisition", None)
    for field, value in values.items():
        setattr(order, field, value)
    order.save()
    if lines is not None:
        _write_order_lines(order, lines)
    record_audit_event(actor=actor, institution=order.institution, entity=order, action="procurement.order.updated", metadata={"fields": sorted(values), "total_amount": str(order.total_amount)})
    return order


@transaction.atomic
def submit_order(*, order, actor):
    order = _lock_order(order)
    _require(actor, order.institution, "purchase_order.create")
    if order.status == OrderStatus.PENDING:
        return order
    if order.status != OrderStatus.DRAFT:
        raise CodedValidationError({"status": "Only draft orders can be submitted."}, api_code="invalid_state_transition")
    lines = list(order.lines.all())
    if not lines:
        raise CodedValidationError({"lines": "Add at least one line."}, api_code="validation_error")
    missing = [line.sequence for line in lines if not line.expense_account_id]
    if missing:
        raise CodedValidationError({"lines": f"Choose the account to charge for line {', '.join(map(str, missing))}."}, api_code="validation_error")
    if not order.vendor.is_active:
        raise CodedValidationError({"vendor": "This vendor is inactive."}, api_code="validation_error")
    excluded = (actor, order.created_by, order.requisition.requested_by if order.requisition_id else None)
    approvers = _holders(order.institution, "purchase_order.approve", exclude=excluded)
    if not approvers:
        raise CodedValidationError({"approval": "Nobody else can approve this order. Someone other than its author must hold the purchase order approval permission."}, api_code="policy_not_applicable")
    order.status, order.submitted_by, order.submitted_at, order.rejection_reason = OrderStatus.PENDING, actor, timezone.now(), ""
    order.save(update_fields=("status", "submitted_by", "submitted_at", "rejection_reason", "updated_at"))
    for user in approvers:
        _notify(user, order.institution, "PROCUREMENT_ORDER_APPROVAL", "Purchase order to approve",
                f"{order.order_number} · {order.vendor.name} · {order.total_amount} {order.currency}.", route="/approvals", metadata={"purchase_order_id": str(order.id)})
    record_audit_event(actor=actor, institution=order.institution, entity=order, action="procurement.order.submitted", metadata=_transition(OrderStatus.DRAFT, OrderStatus.PENDING, total_amount=str(order.total_amount)))
    return order


def order_blocked_reason(order, user):
    """Why ``user`` may not approve ``order`` (separation of duties), or ""."""
    if user.pk == order.created_by_id:
        return "You created this order; someone else must approve it."
    if user.pk == order.submitted_by_id:
        return "You submitted this order; someone else must approve it."
    if order.requisition_id and order.requisition.requested_by_id == user.pk:
        return "You requested these goods; someone else must approve the order."
    return ""


@transaction.atomic
def approve_order(*, order, actor):
    order = _lock_order(order)
    _require(actor, order.institution, "purchase_order.approve")
    if order.status == OrderStatus.ISSUED:
        return order
    if order.status != OrderStatus.PENDING:
        raise CodedValidationError({"status": "Only orders awaiting approval can be approved."}, api_code="invalid_state_transition")
    blocked = order_blocked_reason(order, actor)
    if blocked:
        raise CodedValidationError({"actor": blocked}, api_code="separation_of_duties")
    order.status, order.approved_by, order.approved_at = OrderStatus.ISSUED, actor, timezone.now()
    order.save(update_fields=("status", "approved_by", "approved_at", "updated_at"))
    for user in {order.created_by, order.submitted_by} - {None}:
        _notify(user, order.institution, "PROCUREMENT_ORDER_ISSUED", "Purchase order approved",
                f"{order.order_number} to {order.vendor.name} is approved and can be sent.", route=f"/procurement/orders/{order.id}", metadata={"purchase_order_id": str(order.id)})
    record_audit_event(actor=actor, institution=order.institution, entity=order, action="procurement.order.approved", metadata=_transition(OrderStatus.PENDING, OrderStatus.ISSUED, total_amount=str(order.total_amount)))
    return order


@transaction.atomic
def reject_order(*, order, actor, reason):
    order = _lock_order(order)
    _require(actor, order.institution, "purchase_order.approve")
    if order.status != OrderStatus.PENDING:
        raise CodedValidationError({"status": "Only orders awaiting approval can be sent back."}, api_code="invalid_state_transition")
    if not (reason or "").strip():
        raise CodedValidationError({"reason": "Explain what needs to change."}, api_code="validation_error")
    blocked = order_blocked_reason(order, actor)
    if blocked:
        raise CodedValidationError({"actor": blocked}, api_code="separation_of_duties")
    order.status, order.rejection_reason = OrderStatus.DRAFT, reason.strip()
    order.save(update_fields=("status", "rejection_reason", "updated_at"))
    for user in {order.created_by, order.submitted_by} - {None}:
        _notify(user, order.institution, "PROCUREMENT_ORDER_RETURNED", "Purchase order sent back", reason.strip(), route=f"/procurement/orders/{order.id}", metadata={"purchase_order_id": str(order.id)})
    record_audit_event(actor=actor, institution=order.institution, entity=order, action="procurement.order.returned", metadata=_transition(OrderStatus.PENDING, OrderStatus.DRAFT, reason=reason.strip()))
    return order


@transaction.atomic
def cancel_order(*, order, actor, reason):
    order = _lock_order(order)
    _require(actor, order.institution, "purchase_order.create")
    if order.status not in (OrderStatus.DRAFT, OrderStatus.PENDING, OrderStatus.ISSUED):
        raise CodedValidationError({"status": "An order with deliveries cannot be cancelled; close it instead."}, api_code="invalid_state_transition")
    if not (reason or "").strip():
        raise CodedValidationError({"reason": "Give a reason for cancelling."}, api_code="validation_error")
    before = order.status
    order.status, order.close_reason, order.closed_at = OrderStatus.CANCELLED, reason.strip(), timezone.now()
    order.save(update_fields=("status", "close_reason", "closed_at", "updated_at"))
    if order.requisition_id and not order.requisition.orders.exclude(pk=order.pk).exclude(status=OrderStatus.CANCELLED).exists():
        requisition = _lock_requisition(order.requisition)
        if requisition.status == ReqStatus.ORDERED:
            requisition.status = ReqStatus.APPROVED
            requisition.save(update_fields=("status", "updated_at"))
    record_audit_event(actor=actor, institution=order.institution, entity=order, action="procurement.order.cancelled", metadata=_transition(before, OrderStatus.CANCELLED, reason=reason.strip()))
    return order


@transaction.atomic
def close_order(*, order, actor, reason=""):
    order = _lock_order(order)
    _require(actor, order.institution, "purchase_order.create")
    if order.status not in PurchaseOrder.OPEN:
        raise CodedValidationError({"status": "Only issued orders can be closed."}, api_code="invalid_state_transition")
    if order.status != OrderStatus.RECEIVED and not (reason or "").strip():
        raise CodedValidationError({"reason": "Explain why the rest of the order will not be delivered."}, api_code="validation_error")
    before = order.status
    order.status, order.close_reason, order.closed_at = OrderStatus.CLOSED, (reason or "").strip(), timezone.now()
    order.save(update_fields=("status", "close_reason", "closed_at", "updated_at"))
    record_audit_event(actor=actor, institution=order.institution, entity=order, action="procurement.order.closed", metadata=_transition(before, OrderStatus.CLOSED, reason=order.close_reason))
    return order


# ---- quantities and matching ---------------------------------------------------------------


def line_quantities(order):
    """{order line id: {received, rejected, billed}} from receipts and non-void linked bills."""
    received = {
        row["order_line"]: row
        for row in GoodsReceiptLine.objects.filter(order_line__order=order).values("order_line").annotate(received=Sum("quantity"), rejected=Sum("rejected_quantity"))
    }
    billed = {
        row["order_line"]: row["billed"]
        for row in PurchaseOrderBillLine.objects.filter(order_line__order=order).exclude(link__vendor_bill__status=VendorBill.Status.VOID)
        .values("order_line").annotate(billed=Sum("quantity"))
    }
    return {
        line_id: {
            "received": _qty(received.get(line_id, {}).get("received")),
            "rejected": _qty(received.get(line_id, {}).get("rejected")),
            "billed": _qty(billed.get(line_id)),
        }
        for line_id in order.lines.values_list("id", flat=True)
    }


def match_summary(order):
    """Ordered, received and billed per line, and whether each linked bill still matches its order."""
    quantities = line_quantities(order)
    lines = []
    totals = {"ordered": ZERO, "received": ZERO, "billed": ZERO}
    for line in order.lines.all():
        figures = quantities[line.id]
        price = _qty(line.unit_price)
        row = {
            "line_id": str(line.id), "sequence": line.sequence, "description": line.description, "unit": line.unit,
            "ordered_quantity": _qtext(line.quantity), "received_quantity": _qtext(figures["received"]), "rejected_quantity": _qtext(figures["rejected"]),
            "billed_quantity": _qtext(figures["billed"]), "outstanding_quantity": _qtext(max(_qty(line.quantity) - figures["received"], ZERO)),
            "billable_quantity": _qtext(max(figures["received"] - figures["billed"], ZERO)),
            "ordered_value": str(_money(line.line_total)), "received_value": str(_money(figures["received"] * price)), "billed_value": str(_money(figures["billed"] * price)),
        }
        totals["ordered"] += _money(line.line_total)
        totals["received"] += _money(figures["received"] * price)
        totals["billed"] += _money(figures["billed"] * price)
        lines.append(row)
    bills = []
    for link in order.bills.select_related("vendor_bill").prefetch_related("lines"):
        bill = link.vendor_bill
        expected = _money(sum((_qty(item.quantity) * _qty(item.unit_price) for item in link.lines.all()), ZERO))
        bills.append({
            "id": str(bill.id), "bill_number": bill.bill_number, "status": bill.status, "status_label": bill.get_status_display(),
            "bill_date": bill.bill_date, "subtotal": str(bill.subtotal), "total_amount": str(bill.total_amount), "expected_subtotal": str(expected),
            "matches": bill.status == VendorBill.Status.VOID or _money(bill.subtotal) == expected,
        })
    return {
        "lines": lines,
        "bills": bills,
        "totals": {key: str(_money(value)) for key, value in totals.items()},
        "fully_received": all(_qty(row["outstanding_quantity"]) == 0 for row in lines),
        "fully_billed": any(_qty(row["received_quantity"]) > 0 for row in lines) and all(_qty(row["billable_quantity"]) == 0 for row in lines),
        "mismatched_bills": len([bill for bill in bills if not bill["matches"]]),
    }


# ---- receiving -----------------------------------------------------------------------------


@transaction.atomic
def receive_goods(*, order, actor, lines, received_date=None, delivery_note="", notes=""):
    order = _lock_order(order)
    _require(actor, order.institution, "goods_receipt.create")
    if order.status not in PurchaseOrder.RECEIVABLE:
        raise CodedValidationError({"status": "Goods can be received only against an issued order."}, api_code="invalid_state_transition")
    received_date = received_date or timezone.localdate()
    if received_date < order.order_date:
        raise CodedValidationError({"received_date": "Goods cannot arrive before the order date."}, api_code="validation_error")
    if received_date > timezone.localdate():
        raise CodedValidationError({"received_date": "The receipt date cannot be in the future."}, api_code="validation_error")
    order_lines = {str(line.id): line for line in order.lines.select_for_update()}
    quantities = line_quantities(order)
    rows = []
    for values in lines or ():
        line = order_lines.get(str(getattr(values.get("order_line"), "pk", values.get("order_line"))))
        if line is None:
            raise CodedValidationError({"lines": "A line does not belong to this order."}, api_code="validation_error")
        quantity, rejected = _qty(values.get("quantity")), _qty(values.get("rejected_quantity"))
        if quantity < 0 or rejected < 0:
            raise CodedValidationError({"lines": "Quantities cannot be negative."}, api_code="validation_error")
        if quantity == 0 and rejected == 0:
            continue
        outstanding = _qty(line.quantity) - quantities[line.id]["received"]
        if quantity > outstanding:
            raise CodedValidationError({"lines": f"Line {line.sequence}: only {outstanding.normalize():f} {line.unit or 'units'} are still to come."}, api_code="validation_error")
        rows.append((line, quantity, rejected, (values.get("note") or "").strip()[:255]))
        quantities[line.id]["received"] += quantity
    if not rows:
        raise CodedValidationError({"lines": "Enter what arrived for at least one line."}, api_code="validation_error")
    receipt = GoodsReceipt(institution=order.institution, order=order, received_date=received_date, received_by=actor, delivery_note=delivery_note.strip()[:120], notes=notes.strip())
    receipt.save()
    for line, quantity, rejected, note in rows:
        GoodsReceiptLine(institution=order.institution, receipt=receipt, order_line=line, quantity=quantity, rejected_quantity=rejected, note=note).save()
    before = order.status
    complete = all(quantities[line.id]["received"] >= _qty(line.quantity) for line in order_lines.values())
    order.status = OrderStatus.RECEIVED if complete else OrderStatus.PART_RECEIVED
    order.save(update_fields=("status", "updated_at"))
    for user in _holders(order.institution, "vendor_bill.create"):
        _notify(user, order.institution, "PROCUREMENT_GOODS_RECEIVED", "Goods received", f"{receipt.receipt_number} against {order.order_number} ({order.vendor.name}) can now be billed.",
                route=f"/procurement/orders/{order.id}", metadata={"purchase_order_id": str(order.id)})
    record_audit_event(actor=actor, institution=order.institution, entity=order, action="procurement.goods.received",
                       metadata=_transition(before, order.status, receipt=receipt.receipt_number, lines=len(rows), rejected=str(sum((row[2] for row in rows), ZERO))))
    return receipt


# ---- billing (three-way match) -------------------------------------------------------------


def _open_period(institution, on_date):
    periods = list(AccountingPeriod.objects.filter(institution=institution, start_date__lte=on_date, end_date__gte=on_date))
    if len(periods) != 1:
        raise CodedValidationError({"bill_date": "The bill date must fall within one accounting period."}, api_code="validation_error")
    if periods[0].status != AccountingPeriod.Status.OPEN:
        raise CodedValidationError({"bill_date": "That accounting period is closed."}, api_code="period_closed")
    return periods[0]


@transaction.atomic
def bill_order(*, order, actor, bill_number, bill_date, due_date, lines=None):
    """A draft vendor bill for received, unbilled quantities. ``lines`` optionally limits it: [{order_line, quantity}]."""
    from apps.accounting import services as accounting

    order = _lock_order(order)
    _require(actor, order.institution, "vendor_bill.create")
    if order.status not in (*PurchaseOrder.OPEN, OrderStatus.CLOSED):
        raise CodedValidationError({"status": "Only issued orders can be billed."}, api_code="invalid_state_transition")
    order_lines = {str(line.id): line for line in order.lines.select_related("expense_account", "tax_code")}
    quantities = line_quantities(order)
    if lines:
        wanted = {str(getattr(row.get("order_line"), "pk", row.get("order_line"))): _qty(row.get("quantity")) for row in lines}
    else:
        wanted = {key: quantities[line.id]["received"] - quantities[line.id]["billed"] for key, line in order_lines.items()}
    picked = []
    for key, quantity in wanted.items():
        line = order_lines.get(key)
        if line is None:
            raise CodedValidationError({"lines": "A line does not belong to this order."}, api_code="validation_error")
        if quantity <= 0:
            continue
        billable = quantities[line.id]["received"] - quantities[line.id]["billed"]
        if quantity > billable:
            raise CodedValidationError({"lines": f"Line {line.sequence}: only {billable.normalize():f} received and not yet billed. Record the delivery first."}, api_code="validation_error")
        picked.append((line, quantity))
    if not picked:
        raise CodedValidationError({"lines": "Nothing received on this order is waiting to be billed."}, api_code="validation_error")
    bill = accounting.create_vendor_bill(
        institution=order.institution, actor=actor, vendor=order.vendor, bill_number=bill_number, bill_date=bill_date, due_date=due_date,
        currency=order.currency, accounting_period=_open_period(order.institution, bill_date),
        lines=[{"description": f"{order.order_number}: {line.description}"[:500], "expense_account": line.expense_account, "quantity": quantity,
                "unit_price": line.unit_price, "tax_code": line.tax_code} for line, quantity in picked],
    )
    link = PurchaseOrderBill(institution=order.institution, order=order, vendor_bill=bill, created_by=actor)
    link.save()
    for line, quantity in picked:
        PurchaseOrderBillLine(institution=order.institution, link=link, order_line=line, quantity=quantity, unit_price=line.unit_price).save()
    record_audit_event(actor=actor, institution=order.institution, entity=order, action="procurement.order.billed",
                       metadata={"vendor_bill_id": str(bill.id), "bill_number": bill.bill_number, "subtotal": str(bill.subtotal), "lines": len(picked)})
    return bill


# ---- commitments and budget checks ---------------------------------------------------------


def _unbilled_value(line, quantities):
    figures = quantities.get(line.id, {"billed": ZERO})
    return _money(max(_qty(line.quantity) - figures["billed"], ZERO) * _qty(line.unit_price))


def open_order_commitments(institution, *, account_id=None, department_id=None, start=None, end=None):
    """Unbilled value of open orders: what the organisation has promised to pay but not yet been billed for."""
    orders = PurchaseOrder.objects.for_institution(institution).filter(status__in=PurchaseOrder.OPEN).prefetch_related("lines")
    if department_id is not None:
        orders = orders.filter(department_id=department_id)
    if start is not None:
        orders = orders.filter(order_date__gte=start)
    if end is not None:
        orders = orders.filter(order_date__lte=end)
    total = ZERO
    for order in orders:
        quantities = line_quantities(order)
        for line in order.lines.all():
            if account_id is None or line.expense_account_id == account_id:
                total += _unbilled_value(line, quantities)
    return _money(total)


def commitments_report(institution):
    """Open orders' unbilled value by vendor and by account."""
    by_vendor, by_account, orders = {}, {}, []
    queryset = PurchaseOrder.objects.for_institution(institution).filter(status__in=PurchaseOrder.OPEN).select_related("vendor").prefetch_related("lines__expense_account")
    for order in queryset:
        quantities = line_quantities(order)
        value = ZERO
        for line in order.lines.all():
            amount = _unbilled_value(line, quantities)
            value += amount
            if line.expense_account_id:
                key = str(line.expense_account_id)
                entry = by_account.setdefault(key, {"account_id": key, "account": f"{line.expense_account.code} {line.expense_account.name}", "amount": ZERO})
                entry["amount"] += amount
        vendor = by_vendor.setdefault(str(order.vendor_id), {"vendor_id": str(order.vendor_id), "vendor": order.vendor.name, "orders": 0, "amount": ZERO})
        vendor["orders"] += 1
        vendor["amount"] += value
        late = bool(order.expected_date and order.expected_date < timezone.localdate() and order.status != OrderStatus.RECEIVED)
        orders.append({"id": str(order.id), "order_number": order.order_number, "vendor": order.vendor.name, "status": order.status, "status_label": order.get_status_display(),
                       "expected_date": order.expected_date, "late": late, "unbilled": str(_money(value))})
    as_text = lambda rows: sorted(({**row, "amount": str(_money(row["amount"]))} for row in rows), key=lambda row: -Decimal(row["amount"]))
    return {
        "currency": base_currency(institution),
        "total": str(_money(sum((Decimal(row["unbilled"]) for row in orders), ZERO))),
        "late_orders": len([row for row in orders if row["late"]]),
        "by_vendor": as_text(by_vendor.values()),
        "by_account": as_text(by_account.values()),
        "orders": orders,
    }


def budget_check(institution, *, lines, department=None, on_date=None):
    """For each account in ``lines`` [(account, amount)], the approved budget left this fiscal year.

    Advisory: it tells the approver whether the purchase fits, it does not block.
    """
    from apps.accounting.budgets import line_figures

    on_date = on_date or timezone.localdate()
    year = FiscalYear.objects.filter(institution=institution, start_date__lte=on_date, end_date__gte=on_date).first()
    amounts = {}
    for account, amount in lines:
        if account is not None:
            entry = amounts.setdefault(account.id, {"account": account, "amount": ZERO})
            entry["amount"] += _money(amount)
    rows = []
    for entry in amounts.values():
        account = entry["account"]
        budget_lines = BudgetLine.objects.none()
        if year is not None:
            budget_lines = BudgetLine.objects.filter(institution=institution, account=account, budget__fiscal_year=year, budget__status=Budget.Status.APPROVED).select_related("budget")
            if department is not None:
                scoped = budget_lines.filter(budget__department=department)
                budget_lines = scoped if scoped.exists() else budget_lines.filter(budget__department__isnull=True)
            else:
                budget_lines = budget_lines.filter(budget__department__isnull=True)
        allocated = remaining = ZERO
        found = False
        for budget_line in budget_lines:
            found = True
            figures = line_figures(budget_line)
            allocated += figures["allocated"]
            remaining += figures["remaining"]
        status = "NO_BUDGET" if not found else "OVER_BUDGET" if entry["amount"] > remaining else "WITHIN_BUDGET"
        rows.append({"account_id": str(account.id), "account": f"{account.code} {account.name}", "amount": str(entry["amount"]),
                     "allocated": str(_money(allocated)), "remaining": str(_money(remaining)), "status": status})
    return {"fiscal_year": year.name if year else None, "rows": rows, "over_budget": any(row["status"] == "OVER_BUDGET" for row in rows)}


def supplier_scorecard(institution):
    """Per vendor: orders, spend issued, on-time deliveries and rejected quantity."""
    from django.db.models import Count, Min

    rows = {}
    orders = PurchaseOrder.objects.for_institution(institution).exclude(status__in=(OrderStatus.DRAFT, OrderStatus.PENDING, OrderStatus.CANCELLED)).select_related("vendor")
    for order in orders.annotate(first_receipt=Min("receipts__received_date")):
        row = rows.setdefault(order.vendor_id, {"vendor_id": str(order.vendor_id), "vendor": order.vendor.name, "orders": 0, "spend": ZERO, "delivered": 0, "on_time": 0, "rejected_lines": 0})
        row["orders"] += 1
        row["spend"] += order.total_amount
        if order.first_receipt is not None:
            row["delivered"] += 1
            if order.expected_date is None or order.first_receipt <= order.expected_date:
                row["on_time"] += 1
    for vendor_id, count in (
        GoodsReceiptLine.objects.filter(institution=institution, rejected_quantity__gt=0).values("receipt__order__vendor_id").annotate(count=Count("id")).values_list("receipt__order__vendor_id", "count")
    ):
        if vendor_id in rows:
            rows[vendor_id]["rejected_lines"] = count
    result = []
    for row in rows.values():
        row["spend"] = str(_money(row["spend"]))
        row["on_time_rate"] = round(100 * row["on_time"] / row["delivered"]) if row["delivered"] else None
        result.append(row)
    return sorted(result, key=lambda row: -Decimal(row["spend"]))
