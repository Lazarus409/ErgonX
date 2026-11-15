from decimal import Decimal

from rest_framework import serializers

from apps.accounting.models import Account, TaxCode, Vendor
from apps.organization.models import Department
from apps.procurement.models import (
    GoodsReceipt,
    GoodsReceiptLine,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequisition,
    RequisitionApproval,
    RequisitionLine,
)


def _name(user):
    return (user.get_full_name() or user.email) if user else ""


def _institution(serializer):
    return getattr(serializer.context.get("request"), "institution", None)


class TenantPK(serializers.PrimaryKeyRelatedField):
    """A primary key limited to the caller's institution, resolved when validating (works inside nested lists)."""

    def __init__(self, model, **kwargs):
        self.model = model
        super().__init__(queryset=model.objects.none(), **kwargs)

    def get_queryset(self):
        institution = getattr(self.context.get("request"), "institution", None)
        return self.model.objects.for_institution(institution) if institution else self.model.objects.none()


class RequisitionLineInput(serializers.Serializer):
    description = serializers.CharField(max_length=255)
    quantity = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    unit = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    estimated_unit_price = serializers.DecimalField(max_digits=20, decimal_places=4, min_value=0, required=False, default=0)
    expense_account = TenantPK(Account, required=False, allow_null=True)


class RequisitionInput(serializers.Serializer):
    title = serializers.CharField(max_length=200)
    justification = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    department = TenantPK(Department, required=False, allow_null=True)
    needed_by = serializers.DateField(required=False, allow_null=True)
    preferred_vendor = TenantPK(Vendor, required=False, allow_null=True)
    lines = RequisitionLineInput(many=True, required=False)


class RequisitionLineSerializer(serializers.ModelSerializer):
    expense_account_label = serializers.SerializerMethodField()

    class Meta:
        model = RequisitionLine
        fields = ("id", "sequence", "description", "quantity", "unit", "estimated_unit_price", "line_total", "expense_account", "expense_account_label")

    def get_expense_account_label(self, obj):
        return f"{obj.expense_account.code} {obj.expense_account.name}" if obj.expense_account_id else ""


class RequisitionApprovalSerializer(serializers.ModelSerializer):
    approver_name = serializers.SerializerMethodField()
    decided_by_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = RequisitionApproval
        fields = ("id", "sequence", "step_name", "approver", "approver_name", "status", "status_label", "decided_by_name", "comment", "acted_at")

    def get_approver_name(self, obj):
        return _name(obj.approver) if obj.approver_id else "Procurement approvers"

    def get_decided_by_name(self, obj):
        return _name(obj.decided_by)


class RequisitionSerializer(serializers.ModelSerializer):
    lines = RequisitionLineSerializer(many=True, read_only=True)
    approvals = RequisitionApprovalSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    preferred_vendor_name = serializers.SerializerMethodField()
    orders = serializers.SerializerMethodField()
    viewer = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseRequisition
        fields = (
            "id", "requisition_number", "title", "justification", "requested_by", "requested_by_name", "department", "department_name",
            "needed_by", "preferred_vendor", "preferred_vendor_name", "currency", "estimated_total", "status", "status_label",
            "submitted_at", "decided_at", "decision_note", "lines", "approvals", "orders", "viewer", "created_at", "updated_at",
        )

    def get_requested_by_name(self, obj):
        return _name(obj.requested_by)

    def get_department_name(self, obj):
        return obj.department.name if obj.department_id else ""

    def get_preferred_vendor_name(self, obj):
        return obj.preferred_vendor.name if obj.preferred_vendor_id else ""

    def get_orders(self, obj):
        return [{"id": str(order.id), "order_number": order.order_number, "status": order.status, "status_label": order.get_status_display()} for order in obj.orders.all()]

    def get_viewer(self, obj):
        """What the viewer may do: edit (requester), decide the current step."""
        from apps.procurement.services import may_decide_step

        request = self.context.get("request")
        if request is None:
            return {}
        user = request.user
        current = next((step for step in obj.approvals.all() if step.status == RequisitionApproval.Status.PENDING), None)
        return {
            "is_requester": obj.requested_by_id == user.id,
            "can_edit": obj.requested_by_id == user.id and obj.status in PurchaseRequisition.EDITABLE,
            "can_decide": obj.status == PurchaseRequisition.Status.PENDING and current is not None and may_decide_step(current, user),
        }


class OrderLineInput(serializers.Serializer):
    description = serializers.CharField(max_length=255)
    quantity = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    unit = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    unit_price = serializers.DecimalField(max_digits=20, decimal_places=4, min_value=0)
    expense_account = TenantPK(Account, required=False, allow_null=True)
    tax_code = serializers.PrimaryKeyRelatedField(queryset=TaxCode.objects.all(), required=False, allow_null=True)
    requisition_line = TenantPK(RequisitionLine, required=False, allow_null=True)


class OrderInput(serializers.Serializer):
    vendor = TenantPK(Vendor)
    requisition = TenantPK(PurchaseRequisition, required=False, allow_null=True)
    department = TenantPK(Department, required=False, allow_null=True)
    order_date = serializers.DateField(required=False)
    expected_date = serializers.DateField(required=False, allow_null=True)
    delivery_address = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    terms = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    notes = serializers.CharField(max_length=4000, required=False, allow_blank=True)
    lines = OrderLineInput(many=True, required=False)


class OrderLineSerializer(serializers.ModelSerializer):
    expense_account_label = serializers.SerializerMethodField()
    tax_code_label = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderLine
        fields = ("id", "sequence", "description", "quantity", "unit", "unit_price", "line_total", "expense_account", "expense_account_label", "tax_code", "tax_code_label", "requisition_line")

    def get_expense_account_label(self, obj):
        return f"{obj.expense_account.code} {obj.expense_account.name}" if obj.expense_account_id else ""

    def get_tax_code_label(self, obj):
        return f"{obj.tax_code.code} {obj.tax_code.name}" if obj.tax_code_id else ""


class GoodsReceiptLineSerializer(serializers.ModelSerializer):
    description = serializers.CharField(source="order_line.description", read_only=True)

    class Meta:
        model = GoodsReceiptLine
        fields = ("id", "order_line", "description", "quantity", "rejected_quantity", "note")


class GoodsReceiptSerializer(serializers.ModelSerializer):
    lines = GoodsReceiptLineSerializer(many=True, read_only=True)
    received_by_name = serializers.SerializerMethodField()
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    vendor_name = serializers.CharField(source="order.vendor.name", read_only=True)

    class Meta:
        model = GoodsReceipt
        fields = ("id", "receipt_number", "order", "order_number", "vendor_name", "received_date", "received_by_name", "delivery_note", "notes", "lines", "created_at")

    def get_received_by_name(self, obj):
        return _name(obj.received_by)


class OrderListSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    requisition_number = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = ("id", "order_number", "vendor", "vendor_name", "requisition", "requisition_number", "order_date", "expected_date", "currency", "total_amount", "status", "status_label", "created_at")

    def get_requisition_number(self, obj):
        return obj.requisition.requisition_number if obj.requisition_id else ""


class OrderSerializer(OrderListSerializer):
    lines = OrderLineSerializer(many=True, read_only=True)
    receipts = GoodsReceiptSerializer(many=True, read_only=True)
    department_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    submitted_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    vendor_details = serializers.SerializerMethodField()
    viewer = serializers.SerializerMethodField()

    class Meta(OrderListSerializer.Meta):
        fields = OrderListSerializer.Meta.fields + (
            "department", "department_name", "delivery_address", "terms", "notes", "subtotal", "tax_total", "created_by_name", "submitted_by_name",
            "submitted_at", "approved_by_name", "approved_at", "rejection_reason", "closed_at", "close_reason", "lines", "receipts", "vendor_details", "viewer", "updated_at",
        )

    def get_department_name(self, obj):
        return obj.department.name if obj.department_id else ""

    def get_created_by_name(self, obj):
        return _name(obj.created_by)

    def get_submitted_by_name(self, obj):
        return _name(obj.submitted_by)

    def get_approved_by_name(self, obj):
        return _name(obj.approved_by)

    def get_vendor_details(self, obj):
        vendor = obj.vendor
        return {"code": vendor.vendor_code, "email": vendor.email, "phone": vendor.phone, "address": vendor.address, "tax_identification_number": vendor.tax_identification_number}

    def get_viewer(self, obj):
        from apps.procurement.services import order_blocked_reason

        request = self.context.get("request")
        if request is None:
            return {}
        return {"approval_blocked_reason": order_blocked_reason(obj, request.user) if obj.status == PurchaseOrder.Status.PENDING else ""}


class ReceiveLineInput(serializers.Serializer):
    order_line = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=0, required=False, default=0)
    rejected_quantity = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=0, required=False, default=0)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class ReceiveInput(serializers.Serializer):
    received_date = serializers.DateField(required=False)
    delivery_note = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    notes = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    lines = ReceiveLineInput(many=True)


class BillLineInput(serializers.Serializer):
    order_line = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=0)


class BillInput(serializers.Serializer):
    bill_number = serializers.CharField(max_length=80)
    bill_date = serializers.DateField()
    due_date = serializers.DateField()
    lines = BillLineInput(many=True, required=False)

    def validate(self, attrs):
        if attrs["due_date"] < attrs["bill_date"]:
            raise serializers.ValidationError({"due_date": "The due date cannot be before the bill date."})
        return attrs


class DecisionInput(serializers.Serializer):
    comment = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")


class ReasonInput(serializers.Serializer):
    reason = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
