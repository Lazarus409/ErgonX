from django.db.models import Q
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounting.models import Account
from apps.institutions.services import effective_permission_codes
from apps.procurement import services
from apps.procurement.models import GoodsReceipt, PurchaseOrder, PurchaseRequisition, RequisitionApproval
from apps.procurement.serializers import (
    BillInput,
    DecisionInput,
    GoodsReceiptSerializer,
    OrderInput,
    OrderListSerializer,
    OrderSerializer,
    ReasonInput,
    ReceiveInput,
    RequisitionInput,
    RequisitionSerializer,
)
from common.exports import table_response
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet


def _valid(serializer_class, request, *, partial=False):
    serializer = serializer_class(data=request.data, context={"request": request}, partial=partial)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def _plain_lines(lines):
    return [dict(line) for line in lines] if lines is not None else None


class PurchaseRequisitionViewSet(TenantModelViewSet):
    """Requests to buy. Everyone sees their own; approvers see what awaits them; procurement sees all."""

    model = PurchaseRequisition
    serializer_class = RequisitionSerializer
    required_module = "PROCUREMENT"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("status", "department")
    search_fields = ("requisition_number", "title", "lines__description")
    ordering_fields = ("created_at", "estimated_total", "needed_by")

    # Deciding a step is authorized by step assignment, and cancelling by authorship, inside the service.
    SERVICE_AUTHORIZED = frozenset({"approve", "return_for_changes", "reject", "cancel"})

    def get_required_permission(self):
        if self.action in self.SERVICE_AUTHORIZED:
            return None
        if self.action in ("list", "retrieve", "budget_check"):
            # Whichever of these the member holds; the queryset then limits what they see.
            membership = getattr(self.request, "membership", None)
            codes = set(effective_permission_codes(membership)) if membership is not None else set()
            return next((code for code in ("procurement.view", "requisition.approve") if code in codes), "requisition.create_own")
        return "requisition.create_own"

    def get_queryset(self):
        queryset = super().get_queryset().select_related("requested_by", "department", "preferred_vendor").prefetch_related(
            "lines__expense_account", "approvals__approver", "approvals__decided_by", "orders"
        )
        if getattr(self, "swagger_fake_view", False):
            return queryset
        codes = set(effective_permission_codes(self.request.membership))
        if "procurement.view" in codes:
            mine = self.request.query_params.get("mine")
            return queryset.filter(requested_by=self.request.user) if mine == "1" else queryset
        visible = Q(requested_by=self.request.user) | Q(approvals__approver=self.request.user)
        if "requisition.approve" in codes:
            visible |= Q(status=PurchaseRequisition.Status.PENDING, approvals__approver__isnull=True, approvals__status=RequisitionApproval.Status.PENDING)
        return queryset.filter(visible).distinct()

    def create(self, request, *args, **kwargs):
        values = _valid(RequisitionInput, request)
        lines = _plain_lines(values.pop("lines", None)) or []
        requisition = call_validated_service(services.create_requisition, institution=request.institution, actor=request.user, lines=lines, **values)
        return Response(self.get_serializer(self.get_queryset().get(pk=requisition.pk)).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        values = _valid(RequisitionInput, request, partial=True)
        lines = _plain_lines(values.pop("lines", None))
        requisition = call_validated_service(services.update_requisition, requisition=self.get_object(), actor=request.user, lines=lines, **values)
        return Response(self.get_serializer(self.get_queryset().get(pk=requisition.pk)).data)

    def _respond(self, requisition):
        return Response(self.get_serializer(self.get_queryset().get(pk=requisition.pk)).data)

    @extend_schema(request=None, responses={200: RequisitionSerializer})
    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        return self._respond(call_validated_service(services.submit_requisition, requisition=self.get_object(), actor=request.user))

    def _decide(self, request, decision):
        comment = _valid(DecisionInput, request)["comment"]
        requisition = call_validated_service(services.decide_requisition, requisition=self.get_object(), actor=request.user, decision=decision, comment=comment)
        return Response(RequisitionSerializer(PurchaseRequisition.objects.get(pk=requisition.pk), context={"request": request}).data)

    @extend_schema(request=DecisionInput, responses={200: RequisitionSerializer})
    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return self._decide(request, "approve")

    @extend_schema(request=DecisionInput, responses={200: RequisitionSerializer})
    @action(detail=True, methods=("post",), url_path="return")
    def return_for_changes(self, request, pk=None):
        return self._decide(request, "return")

    @extend_schema(request=DecisionInput, responses={200: RequisitionSerializer})
    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return self._decide(request, "reject")

    @extend_schema(request=ReasonInput, responses={200: RequisitionSerializer})
    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        reason = _valid(ReasonInput, request)["reason"]
        return self._respond(call_validated_service(services.cancel_requisition, requisition=self.get_object(), actor=request.user, reason=reason))

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=("get",), url_path="budget-check")
    def budget_check(self, request, pk=None):
        requisition = self.get_object()
        lines = [(line.expense_account, line.line_total) for line in requisition.lines.all()]
        return Response(services.budget_check(request.institution, lines=lines, department=requisition.department))


class PurchaseOrderViewSet(TenantModelViewSet):
    model = PurchaseOrder
    serializer_class = OrderSerializer
    required_module = "PROCUREMENT"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("status", "vendor", "department", "requisition")
    search_fields = ("order_number", "vendor__name", "lines__description")
    ordering_fields = ("order_date", "expected_date", "total_amount", "created_at")
    ordering = ("-order_date", "-created_at")

    PERMISSIONS = {
        "create": "purchase_order.create", "partial_update": "purchase_order.create", "submit": "purchase_order.create",
        "cancel": "purchase_order.create", "close": "purchase_order.create", "from_requisition": "purchase_order.create",
        "approve": "purchase_order.approve", "reject": "purchase_order.approve",
        "receive": "goods_receipt.create", "bill": "vendor_bill.create",
    }

    def get_required_permission(self):
        return self.PERMISSIONS.get(self.action, "procurement.view")

    def get_serializer_class(self):
        return OrderListSerializer if self.action == "list" else OrderSerializer

    def get_queryset(self):
        queryset = super().get_queryset().select_related("vendor", "requisition", "department", "created_by", "submitted_by", "approved_by")
        if self.action != "list":
            queryset = queryset.prefetch_related("lines__expense_account", "lines__tax_code", "receipts__lines__order_line", "receipts__received_by")
        return queryset

    def _respond(self, order, code=status.HTTP_200_OK):
        return Response(OrderSerializer(self.get_queryset().get(pk=order.pk), context={"request": self.request}).data, status=code)

    def create(self, request, *args, **kwargs):
        values = _valid(OrderInput, request)
        lines = _plain_lines(values.pop("lines", None)) or []
        order = call_validated_service(services.create_order, institution=request.institution, actor=request.user, lines=lines, **values)
        return self._respond(order, status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        values = _valid(OrderInput, request, partial=True)
        lines = _plain_lines(values.pop("lines", None))
        return self._respond(call_validated_service(services.update_order, order=self.get_object(), actor=request.user, lines=lines, **values))

    @extend_schema(request=OrderInput, responses={201: OrderSerializer})
    @action(detail=False, methods=("post",), url_path="from-requisition")
    def from_requisition(self, request):
        """Draft an order from an approved requisition; prices and accounts can be adjusted before submitting."""
        values = _valid(OrderInput, request)
        requisition = values.get("requisition")
        if requisition is None:
            return Response({"requisition": ["Choose the approved requisition to order."]}, status=status.HTTP_400_BAD_REQUEST)
        lines = _plain_lines(values.pop("lines", None)) or services.lines_from_requisition(requisition)
        order = call_validated_service(services.create_order, institution=request.institution, actor=request.user, lines=lines, **values)
        return self._respond(order, status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={200: OrderSerializer})
    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        return self._respond(call_validated_service(services.submit_order, order=self.get_object(), actor=request.user))

    @extend_schema(request=None, responses={200: OrderSerializer})
    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return self._respond(call_validated_service(services.approve_order, order=self.get_object(), actor=request.user))

    @extend_schema(request=ReasonInput, responses={200: OrderSerializer})
    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return self._respond(call_validated_service(services.reject_order, order=self.get_object(), actor=request.user, reason=_valid(ReasonInput, request)["reason"]))

    @extend_schema(request=ReasonInput, responses={200: OrderSerializer})
    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        return self._respond(call_validated_service(services.cancel_order, order=self.get_object(), actor=request.user, reason=_valid(ReasonInput, request)["reason"]))

    @extend_schema(request=ReasonInput, responses={200: OrderSerializer})
    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        return self._respond(call_validated_service(services.close_order, order=self.get_object(), actor=request.user, reason=_valid(ReasonInput, request)["reason"]))

    @extend_schema(request=ReceiveInput, responses={201: GoodsReceiptSerializer})
    @action(detail=True, methods=("post",))
    def receive(self, request, pk=None):
        values = _valid(ReceiveInput, request)
        receipt = call_validated_service(services.receive_goods, order=self.get_object(), actor=request.user, lines=_plain_lines(values.pop("lines")), **values)
        return Response(GoodsReceiptSerializer(receipt, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=BillInput, responses={201: OpenApiTypes.OBJECT})
    @action(detail=True, methods=("post",))
    def bill(self, request, pk=None):
        values = _valid(BillInput, request)
        bill = call_validated_service(services.bill_order, order=self.get_object(), actor=request.user, lines=_plain_lines(values.pop("lines", None)), **values)
        return Response({"id": str(bill.id), "bill_number": bill.bill_number, "status": bill.status, "subtotal": str(bill.subtotal), "total_amount": str(bill.total_amount)}, status=status.HTTP_201_CREATED)

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=("get",))
    def match(self, request, pk=None):
        return Response(services.match_summary(self.get_object()))

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=("get",), url_path="budget-check")
    def budget_check(self, request, pk=None):
        order = self.get_object()
        lines = [(line.expense_account, line.line_total) for line in order.lines.all()]
        return Response(services.budget_check(request.institution, lines=lines, department=order.department, on_date=order.order_date))

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    @action(detail=True, methods=("get",))
    def document(self, request, pk=None):
        """The order as a PDF (or Excel/CSV with ?export=) to send to the supplier."""
        order = self.get_object()
        vendor = order.vendor
        parts = [f"Supplier: {vendor.name}" + (f" ({vendor.vendor_code})" if vendor.vendor_code else ""), f"Order date: {order.order_date:%d %b %Y}"]
        if order.expected_date:
            parts.append(f"Deliver by: {order.expected_date:%d %b %Y}")
        if order.delivery_address:
            parts.append(f"Deliver to: {' '.join(order.delivery_address.split())}")
        if order.status in (PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.PENDING):
            parts.append("DRAFT, not yet approved")
        rows = [{"line": line.sequence, "item": line.description, "quantity": f"{line.quantity.normalize():f} {line.unit}".strip(), "unit_price": f"{line.unit_price:,.2f}",
                 "tax": line.tax_code.code if line.tax_code_id else "", "amount": f"{line.line_total:,.2f}"} for line in order.lines.all()]
        rows += [{"item": "Subtotal", "amount": f"{order.subtotal:,.2f}"}, {"item": "Tax", "amount": f"{order.tax_total:,.2f}"}, {"item": f"Total ({order.currency})", "amount": f"{order.total_amount:,.2f}"}]
        if order.terms:
            rows.append({"item": f"Terms: {' '.join(order.terms.split())}"[:500]})
        return table_response(
            request.query_params.get("export", "pdf"), filename=f"purchase-order-{order.order_number}", title=f"Purchase order {order.order_number}",
            subtitle=" · ".join(parts), columns=[("line", "#"), ("item", "Item"), ("quantity", "Quantity"), ("unit_price", "Unit price"), ("tax", "Tax"), ("amount", "Amount")],
            rows=rows, institution=request.institution, count_rows=False,
            classification="CONFIDENTIAL",
        )

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=("get",))
    def commitments(self, request):
        return Response(services.commitments_report(request.institution))

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=("get",))
    def suppliers(self, request):
        return Response({"results": services.supplier_scorecard(request.institution)})

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=("get",), url_path="form-options")
    def form_options(self, request):
        """Accounts and tax codes an order line may use."""
        from apps.accounting.models import TaxCode

        accounts = Account.objects.for_institution(request.institution).filter(
            is_active=True, is_postable=True, account_type=Account.AccountType.EXPENSE
        ).order_by("code")
        configuration = getattr(request.institution, "accounting_configuration", None)
        preset_version_id = getattr(configuration, "selected_accounting_preset_version_id", None)
        taxes = TaxCode.objects.filter(preset_version_id=preset_version_id, is_active=True).order_by("code") if preset_version_id else TaxCode.objects.none()
        return Response({
            "currency": services.base_currency(request.institution),
            "accounts": [{"id": str(account.id), "label": f"{account.code} {account.name}"} for account in accounts],
            "tax_codes": [{"id": str(tax.id), "label": f"{tax.code} {tax.name}"} for tax in taxes],
        })


class GoodsReceiptViewSet(TenantModelViewSet):
    model = GoodsReceipt
    serializer_class = GoodsReceiptSerializer
    required_module = "PROCUREMENT"
    required_permission = "procurement.view"
    http_method_names = ("get", "head", "options")
    filterset_fields = ("order",)
    search_fields = ("receipt_number", "order__order_number", "order__vendor__name", "delivery_note")
    ordering = ("-received_date", "-created_at")

    def get_queryset(self):
        return super().get_queryset().select_related("order__vendor", "received_by").prefetch_related("lines__order_line")
