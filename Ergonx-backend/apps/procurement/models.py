"""Procurement: requisition -> purchase order -> goods received -> vendor bill.

Suppliers are the accounting ``Vendor`` records and bills are ordinary
``VendorBill`` records, so payables, payments and the ledger stay in one place.
A bill raised from an order is linked through ``PurchaseOrderBill`` so the
order knows how much of each line has been billed (three-way match).
"""

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.accounting.models import Account, TaxCode, Vendor, VendorBill
from apps.institutions.models import Institution
from common.codes import AutoCodeMixin
from common.models import TenantOwnedModel, changed_actor_fields

ZERO = Decimal("0")


def _same_institution(instance, fields):
    errors = {}
    for field in fields:
        related = getattr(instance, field, None)
        if related is not None and getattr(related, "institution_id", instance.institution_id) != instance.institution_id:
            errors[field] = "Belongs to another institution."
    return errors


def _active_members(instance, fields):
    errors = {}
    for field in changed_actor_fields(instance, fields):
        user = getattr(instance, field, None)
        if user is not None and not user.memberships.filter(institution_id=instance.institution_id, status="ACTIVE").exists():
            errors[field] = "User must be an active member of the institution."
    return errors


def _expense_account_errors(account):
    if account is None:
        return None
    # Bills raised from orders post through accounts payable, which charges expense accounts.
    if account.account_type != Account.AccountType.EXPENSE:
        return "Charge purchases to an expense account."
    if not (account.is_active and account.is_postable):
        return "This account is inactive or not postable."
    return None


class PurchaseRequisition(AutoCodeMixin, TenantOwnedModel):
    """A request to buy something, approved before anyone orders it."""

    auto_code_field = "requisition_number"
    auto_code_prefix = "PR"
    auto_code_width = 4
    auto_code_year_from = "today"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING = "PENDING", "Awaiting approval"
        RETURNED = "RETURNED", "Returned for changes"
        APPROVED = "APPROVED", "Approved"
        ORDERED = "ORDERED", "Ordered"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    EDITABLE = (Status.DRAFT, Status.RETURNED)

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="purchase_requisitions")
    requisition_number = models.CharField(max_length=40, blank=True)
    title = models.CharField(max_length=200)
    justification = models.TextField(blank=True, max_length=4000)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="purchase_requisitions")
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_requisitions")
    needed_by = models.DateField(null=True, blank=True)
    preferred_vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_requisitions")
    currency = models.CharField(max_length=3)
    estimated_total = models.DecimalField(max_digits=20, decimal_places=2, default=ZERO)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    submitted_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(fields=("institution", "requisition_number"), name="uniq_requisition_number"),
            models.CheckConstraint(condition=Q(estimated_total__gte=0), name="requisition_total_nonnegative"),
        ]
        indexes = [models.Index(fields=("institution", "status", "created_at"))]

    def clean(self):
        self.currency = (self.currency or "").strip().upper()
        errors = _same_institution(self, ("department", "preferred_vendor"))
        errors |= _active_members(self, ("requested_by",))
        if len(self.currency) != 3 or not self.currency.isalpha():
            errors["currency"] = "Use a three-letter ISO currency code."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.requisition_number} {self.title}"


class RequisitionLine(TenantOwnedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="requisition_lines")
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.CASCADE, related_name="lines")
    sequence = models.PositiveSmallIntegerField(default=1)
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    unit = models.CharField(max_length=30, blank=True)
    estimated_unit_price = models.DecimalField(max_digits=20, decimal_places=4, default=ZERO)
    expense_account = models.ForeignKey(Account, on_delete=models.PROTECT, null=True, blank=True, related_name="requisition_lines")
    line_total = models.DecimalField(max_digits=20, decimal_places=2, default=ZERO)

    class Meta:
        ordering = ("requisition", "sequence", "created_at")
        constraints = [models.CheckConstraint(condition=Q(quantity__gt=0) & Q(estimated_unit_price__gte=0), name="requisition_line_amounts_valid")]

    def clean(self):
        errors = _same_institution(self, ("requisition", "expense_account"))
        problem = _expense_account_errors(self.expense_account if self.expense_account_id else None)
        if problem:
            errors["expense_account"] = problem
        if errors:
            raise ValidationError(errors)


class RequisitionApproval(TenantOwnedModel):
    """One approval step on a requisition. No named approver means anyone holding ``requisition.approve``."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        RETURNED = "RETURNED", "Returned"
        REJECTED = "REJECTED", "Rejected"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="requisition_approvals")
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.CASCADE, related_name="approvals")
    sequence = models.PositiveSmallIntegerField()
    step_name = models.CharField(max_length=150)
    approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="requisition_approval_steps")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="requisition_decisions")
    comment = models.TextField(blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("requisition", "sequence")
        constraints = [models.UniqueConstraint(fields=("requisition", "sequence"), name="uniq_requisition_approval_sequence")]


class PurchaseOrder(AutoCodeMixin, TenantOwnedModel):
    """An order sent to a supplier once someone other than its author approves it."""

    auto_code_field = "order_number"
    auto_code_prefix = "PO"
    auto_code_width = 4
    auto_code_year_from = "today"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING = "PENDING", "Awaiting approval"
        ISSUED = "ISSUED", "Issued"
        PART_RECEIVED = "PART_RECEIVED", "Partly received"
        RECEIVED = "RECEIVED", "Received"
        CLOSED = "CLOSED", "Closed"
        CANCELLED = "CANCELLED", "Cancelled"

    OPEN = (Status.ISSUED, Status.PART_RECEIVED, Status.RECEIVED)
    RECEIVABLE = (Status.ISSUED, Status.PART_RECEIVED)

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="purchase_orders")
    order_number = models.CharField(max_length=40, blank=True)
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="purchase_orders")
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.PROTECT, null=True, blank=True, related_name="orders")
    department = models.ForeignKey("organization.Department", on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_orders")
    order_date = models.DateField()
    expected_date = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=3)
    delivery_address = models.TextField(blank=True, max_length=1000)
    terms = models.TextField(blank=True, max_length=4000)
    notes = models.TextField(blank=True, max_length=4000)
    subtotal = models.DecimalField(max_digits=20, decimal_places=2, default=ZERO)
    tax_total = models.DecimalField(max_digits=20, decimal_places=2, default=ZERO)
    total_amount = models.DecimalField(max_digits=20, decimal_places=2, default=ZERO)
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="purchase_orders_created")
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_orders_submitted")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_orders_approved")
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    close_reason = models.TextField(blank=True)

    class Meta:
        ordering = ("-order_date", "-created_at")
        constraints = [
            models.UniqueConstraint(fields=("institution", "order_number"), name="uniq_purchase_order_number"),
            models.CheckConstraint(condition=Q(subtotal__gte=0) & Q(tax_total__gte=0) & Q(total_amount__gte=0), name="purchase_order_amounts_nonnegative"),
            models.CheckConstraint(condition=Q(expected_date__isnull=True) | Q(expected_date__gte=models.F("order_date")), name="purchase_order_expected_after_order"),
        ]
        indexes = [models.Index(fields=("institution", "status", "order_date")), models.Index(fields=("institution", "vendor", "status"))]

    def clean(self):
        self.currency = (self.currency or "").strip().upper()
        errors = _same_institution(self, ("vendor", "requisition", "department"))
        errors |= _active_members(self, ("created_by", "submitted_by", "approved_by"))
        if len(self.currency) != 3 or not self.currency.isalpha():
            errors["currency"] = "Use a three-letter ISO currency code."
        if self.vendor_id and not self.vendor.is_active and self.status in (self.Status.DRAFT, self.Status.PENDING):
            errors["vendor"] = "This vendor is inactive."
        if self.expected_date and self.order_date and self.expected_date < self.order_date:
            errors["expected_date"] = "Expected delivery cannot be before the order date."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.order_number} {self.vendor.name if self.vendor_id else ''}".strip()


class PurchaseOrderLine(TenantOwnedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="purchase_order_lines")
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    requisition_line = models.ForeignKey(RequisitionLine, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_lines")
    sequence = models.PositiveSmallIntegerField(default=1)
    description = models.CharField(max_length=255)
    expense_account = models.ForeignKey(Account, on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_order_lines")
    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    unit = models.CharField(max_length=30, blank=True)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    tax_code = models.ForeignKey(TaxCode, on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_order_lines")
    line_total = models.DecimalField(max_digits=20, decimal_places=2, default=ZERO)

    class Meta:
        ordering = ("order", "sequence", "created_at")
        constraints = [models.CheckConstraint(condition=Q(quantity__gt=0) & Q(unit_price__gte=0) & Q(line_total__gte=0), name="purchase_order_line_amounts_valid")]

    def clean(self):
        errors = _same_institution(self, ("order", "expense_account"))
        problem = _expense_account_errors(self.expense_account if self.expense_account_id else None)
        if problem:
            errors["expense_account"] = problem
        if errors:
            raise ValidationError(errors)


class GoodsReceipt(AutoCodeMixin, TenantOwnedModel):
    """What arrived against an order, and when. Receipts are never edited; a mistake is recorded as a return."""

    auto_code_field = "receipt_number"
    auto_code_prefix = "GRN"
    auto_code_width = 4
    auto_code_year_from = "today"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="goods_receipts")
    receipt_number = models.CharField(max_length=40, blank=True)
    order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="receipts")
    received_date = models.DateField()
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="goods_receipts")
    delivery_note = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True, max_length=2000)

    class Meta:
        ordering = ("-received_date", "-created_at")
        constraints = [models.UniqueConstraint(fields=("institution", "receipt_number"), name="uniq_goods_receipt_number")]

    def clean(self):
        errors = _same_institution(self, ("order",)) | _active_members(self, ("received_by",))
        if errors:
            raise ValidationError(errors)


class GoodsReceiptLine(TenantOwnedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="goods_receipt_lines")
    receipt = models.ForeignKey(GoodsReceipt, on_delete=models.CASCADE, related_name="lines")
    order_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.PROTECT, related_name="receipt_lines")
    # Accepted into stock or use; rejected items (damaged, wrong) are noted but not counted as received.
    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    rejected_quantity = models.DecimalField(max_digits=18, decimal_places=4, default=ZERO)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ("receipt", "created_at")
        constraints = [models.CheckConstraint(condition=Q(quantity__gte=0) & Q(rejected_quantity__gte=0), name="goods_receipt_line_quantities_valid")]

    def clean(self):
        errors = _same_institution(self, ("receipt", "order_line"))
        if self.receipt_id and self.order_line_id and self.order_line.order_id != self.receipt.order_id:
            errors["order_line"] = "This line belongs to another order."
        if errors:
            raise ValidationError(errors)


class PurchaseOrderBill(TenantOwnedModel):
    """A vendor bill raised from an order; its lines say how much of each order line it bills."""

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="purchase_order_bills")
    order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="bills")
    vendor_bill = models.OneToOneField(VendorBill, on_delete=models.CASCADE, related_name="purchase_order_link")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="purchase_order_bills")

    class Meta:
        ordering = ("-created_at",)

    def clean(self):
        errors = _same_institution(self, ("order", "vendor_bill"))
        if self.order_id and self.vendor_bill_id and self.order.vendor_id != self.vendor_bill.vendor_id:
            errors["vendor_bill"] = "The bill is from a different vendor than the order."
        if errors:
            raise ValidationError(errors)


class PurchaseOrderBillLine(TenantOwnedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="purchase_order_bill_lines")
    link = models.ForeignKey(PurchaseOrderBill, on_delete=models.CASCADE, related_name="lines")
    order_line = models.ForeignKey(PurchaseOrderLine, on_delete=models.PROTECT, related_name="bill_lines")
    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(quantity__gt=0), name="purchase_order_bill_line_quantity_positive")]
