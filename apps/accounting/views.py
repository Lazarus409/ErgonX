from decimal import Decimal
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounting.models import (
    Account,
    AccountingPeriod,
    AccountingPreset,
    AccountingPresetVersion,
    AccountTemplate,
    ChartOfAccountsTemplate,
    FiscalYear,
    GhanaLocalizationVersion,
    InstitutionAccountingConfiguration,
    JournalEntry,
    JournalLine,
    TaxCode,
    TaxComponent,
    Vendor,
    VendorBill,
    Customer,
    Invoice,
    BankAccount,
    Payment,
    Receipt,
    BankStatementLine,
    VATWithholdingCertificate,
    GhanaComplianceReminder,
    Expense,
    PayrollAccountMappingTemplate,
    PayComponentAccountMapping,
    WithholdingRule,
)
from apps.accounting.selectors import (
    available_accounting_preset_versions,
    balance_sheet,
    general_ledger,
    income_statement,
    trial_balance,
)
from apps.accounting.serializers import (
    AccountSerializer,
    BalanceSheetSerializer,
    BalanceSheetQuerySerializer,
    AccountingPeriodSerializer,
    AccountingPresetSerializer,
    AccountingPresetVersionSerializer,
    AccountingPresetApplicationSerializer,
    AccountingPresetApplicationResultSerializer,
    AccountTemplateSerializer,
    ChartOfAccountsTemplateSerializer,
    FiscalYearSerializer,
    GeneralLedgerQuerySerializer,
    GeneralLedgerSerializer,
    GhanaLocalizationVersionSerializer,
    IncomeStatementSerializer,
    InstitutionAccountingConfigurationSerializer,
    JournalEntrySerializer,
    JournalLineSerializer,
    JournalReversalSerializer,
    DateRangeQuerySerializer,
    TrialBalanceSerializer,
    TaxCodeSerializer,
    TaxComponentSerializer,
    WithholdingRuleSerializer,
    VendorSerializer,
    VendorBillSerializer,
    CustomerSerializer,
    InvoiceSerializer,
    BankAccountSerializer,
    PaymentSerializer,
    ReceiptSerializer,
    CashTransactionVoidSerializer,
    BankStatementLineSerializer,
    BankStatementMatchSerializer,
    VATWithholdingCertificateSerializer,
    GhanaComplianceReminderSerializer,
    ExpenseSerializer,
    PayrollAccountMappingTemplateSerializer,
    PayComponentAccountMappingSerializer,
    PayrollMappingTemplateApplySerializer,
)
from apps.accounting.services import (
    apply_accounting_preset,
    approve_journal,
    create_reversal,
    close_fiscal_year,
    post_journal,
    set_period_status,
    submit_journal,
    void_journal,
    approve_vendor_bill,
    post_vendor_bill,
    submit_vendor_bill,
    void_vendor_bill,
    issue_invoice,
    void_invoice,
    void_payment,
    void_receipt,
    match_bank_statement_line,
    unmatch_bank_statement_line,
    void_vat_withholding_certificate,
    submit_expense,
    approve_expense,
    reject_expense,
    post_expense,
    apply_payroll_account_mapping_templates,
)
from common.permissions import TenantContextPermission, TenantRBACPermission
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet


class AccountingPresetViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AccountingPreset.objects.all()
    serializer_class = AccountingPresetSerializer
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    filterset_fields = ("country_code", "institution_type", "is_system_managed")
    search_fields = ("code", "name", "description")

    def get_required_permission(self):
        return "account.view"


class AccountingPresetVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AccountingPresetVersion.objects.select_related("accounting_preset")
    serializer_class = AccountingPresetVersionSerializer
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    filterset_fields = ("accounting_preset", "status", "effective_from")
    search_fields = ("version_code", "localization_version", "reporting_framework")

    schema_action_descriptions = {
        "apply": (
            "Atomically instantiate one chart template and select this preset version "
            "for the active institution"
        )
    }
    schema_action_error_codes = {
        "apply": (
            "invalid_state_transition",
            "policy_not_applicable",
            "duplicate_operation",
            "record_immutable",
        )
    }

    def get_required_permission(self):
        return "accounting.configure" if self.action == "apply" else "account.view"

    @extend_schema(
        request=AccountingPresetApplicationSerializer,
        responses=AccountingPresetApplicationResultSerializer,
        filters=False,
    )
    @action(detail=True, methods=("post",), filter_backends=())
    def apply(self, request, pk=None):
        preset_version = self.get_object()
        payload = AccountingPresetApplicationSerializer(
            data=request.data,
            context={**self.get_serializer_context(), "preset_version": preset_version},
        )
        payload.is_valid(raise_exception=True)
        result = call_validated_service(
            apply_accounting_preset,
            institution=request.institution,
            actor=request.user,
            preset_version=preset_version,
            **payload.validated_data,
        )
        return Response(
            AccountingPresetApplicationResultSerializer(
                result, context=self.get_serializer_context()
            ).data
        )


class GhanaLocalizationVersionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GhanaLocalizationVersion.objects.all()
    serializer_class = GhanaLocalizationVersionSerializer
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    filterset_fields = ("code", "version", "status", "effective_from")
    search_fields = ("code", "version", "tax_authority")
    ordering_fields = ("code", "version", "effective_from")
    ordering = ("-effective_from", "code")

    def get_required_permission(self):
        return "account.view"


class TaxCodeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TaxCode.objects.select_related("preset_version", "preset_version__accounting_preset")
    serializer_class = TaxCodeSerializer
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    filterset_fields = ("preset_version", "code", "tax_treatment", "is_active", "effective_from")
    search_fields = ("code", "name", "tax_treatment")
    ordering_fields = ("code", "name", "effective_from")
    ordering = ("code", "effective_from")

    def get_required_permission(self):
        return "account.view"


class TaxComponentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TaxComponent.objects.select_related(
        "tax_code", "tax_code__preset_version", "tax_code__preset_version__accounting_preset"
    )
    serializer_class = TaxComponentSerializer
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    filterset_fields = ("tax_code", "code", "sequence")
    search_fields = ("code", "name", "input_account_mapping_code", "output_account_mapping_code")
    ordering_fields = ("code", "name", "sequence", "rate")
    ordering = ("tax_code", "sequence", "code")

    def get_required_permission(self):
        return "account.view"


class WithholdingRuleViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WithholdingRule.objects.select_related(
        "preset_version", "preset_version__accounting_preset"
    )
    serializer_class = WithholdingRuleSerializer
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    filterset_fields = (
        "preset_version",
        "code",
        "residency",
        "transaction_category",
        "is_vat_withholding_rule",
        "requires_confirmation",
        "effective_from",
    )
    search_fields = ("code", "name", "residency", "transaction_category")
    ordering_fields = ("code", "name", "rate", "effective_from")
    ordering = ("code", "effective_from")

    def get_required_permission(self):
        return "account.view"


class VendorViewSet(TenantModelViewSet):
    model = Vendor
    serializer_class = VendorSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = (
        "is_active", "country_code", "tax_residency", "taxpayer_type", "vat_registered",
        "withholding_category",
    )
    search_fields = ("vendor_code", "name", "email", "tax_identification_number")
    ordering_fields = ("vendor_code", "name", "created_at")
    ordering = ("vendor_code",)

    def get_required_permission(self):
        return {"create": "vendor.create", "partial_update": "vendor.update"}.get(
            self.action, "vendor.view"
        )

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    def perform_update(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)


class VendorBillViewSet(TenantModelViewSet):
    model = VendorBill
    serializer_class = VendorBillSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("vendor", "status", "currency", "accounting_period", "bill_date")
    search_fields = ("bill_number", "vendor__name", "vendor__vendor_code")
    ordering_fields = ("bill_number", "bill_date", "due_date", "total_amount", "created_at")
    ordering = ("-bill_date", "-created_at")
    schema_action_descriptions = {
        "submit": "Validate and submit a draft vendor bill for approval",
        "approve": "Approve a pending vendor bill for controlled posting",
        "post": "Create, approve, and post the linked AP journal for an approved bill",
        "void": "Void an unposted vendor bill",
    }
    schema_action_error_codes = {
        "submit": ("invalid_state_transition", "period_closed", "validation_error"),
        "approve": ("invalid_state_transition",),
        "post": ("invalid_state_transition", "policy_not_applicable", "period_closed"),
        "void": ("invalid_state_transition", "record_immutable"),
    }

    def get_queryset(self):
        return super().get_queryset().select_related(
            "vendor", "accounting_period", "journal_entry"
        ).prefetch_related("lines")

    def get_required_permission(self):
        return {
            "create": "vendor_bill.create",
            "partial_update": "vendor_bill.create",
            "submit": "vendor_bill.create",
            "approve": "vendor_bill.approve",
            "post": "vendor_bill.post",
            "void": "vendor_bill.void",
        }.get(self.action, "vendor_bill.view")

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    def perform_update(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    @extend_schema(request=None, responses=VendorBillSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def submit(self, request, pk=None):
        return Response(
            VendorBillSerializer(
                call_validated_service(
                    submit_vendor_bill, bill=self.get_object(), actor=request.user
                ),
                context=self.get_serializer_context(),
            ).data
        )

    @extend_schema(request=None, responses=VendorBillSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def approve(self, request, pk=None):
        return Response(
            VendorBillSerializer(
                call_validated_service(
                    approve_vendor_bill, bill=self.get_object(), actor=request.user
                ),
                context=self.get_serializer_context(),
            ).data
        )

    @extend_schema(request=None, responses=VendorBillSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def post(self, request, pk=None):
        return Response(
            VendorBillSerializer(
                call_validated_service(
                    post_vendor_bill, bill=self.get_object(), actor=request.user
                ),
                context=self.get_serializer_context(),
            ).data
        )

    @extend_schema(request=None, responses=VendorBillSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def void(self, request, pk=None):
        return Response(
            VendorBillSerializer(
                call_validated_service(
                    void_vendor_bill, bill=self.get_object(), actor=request.user
                ),
                context=self.get_serializer_context(),
            ).data
        )


class CustomerViewSet(TenantModelViewSet):
    model = Customer
    serializer_class = CustomerSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("is_active", "country_code", "tax_residency", "taxpayer_type", "vat_registered")
    search_fields = ("customer_code", "name", "email", "tax_identification_number")
    ordering_fields = ("customer_code", "name", "created_at")
    ordering = ("customer_code",)

    def get_required_permission(self):
        return {"create": "customer.create", "partial_update": "customer.update"}.get(self.action, "customer.view")

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    def perform_update(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)


class InvoiceViewSet(TenantModelViewSet):
    model = Invoice
    serializer_class = InvoiceSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("customer", "status", "currency", "accounting_period", "invoice_date")
    search_fields = ("invoice_number", "customer__name", "customer__customer_code", "external_tax_reference")
    ordering_fields = ("invoice_number", "invoice_date", "due_date", "total_amount", "created_at")
    ordering = ("-invoice_date", "-created_at")
    schema_action_descriptions = {"issue": "Issue a draft invoice and post its controlled AR journal", "void": "Void a draft invoice"}
    schema_action_error_codes = {"issue": ("invalid_state_transition", "policy_not_applicable", "period_closed"), "void": ("record_immutable",)}

    def get_queryset(self):
        return super().get_queryset().select_related("customer", "accounting_period", "journal_entry").prefetch_related("lines")

    def get_required_permission(self):
        return {"create": "invoice.create", "partial_update": "invoice.create", "issue": "invoice.issue", "void": "invoice.void"}.get(self.action, "invoice.view")

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    def perform_update(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    @extend_schema(request=None, responses=InvoiceSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def issue(self, request, pk=None):
        return Response(InvoiceSerializer(call_validated_service(issue_invoice, invoice=self.get_object(), actor=request.user), context=self.get_serializer_context()).data)

    @extend_schema(request=None, responses=InvoiceSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def void(self, request, pk=None):
        return Response(InvoiceSerializer(call_validated_service(void_invoice, invoice=self.get_object(), actor=request.user), context=self.get_serializer_context()).data)


class BankAccountViewSet(TenantModelViewSet):
    model = BankAccount
    serializer_class = BankAccountSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("is_active", "currency", "ledger_account")
    search_fields = ("name", "bank_name", "masked_account_number")
    ordering_fields = ("name", "bank_name", "created_at")
    ordering = ("name",)

    def get_required_permission(self):
        return {"create": "bank_account.create", "partial_update": "bank_account.update"}.get(
            self.action, "bank_account.view"
        )

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    def perform_update(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)


class PaymentViewSet(TenantModelViewSet):
    model = Payment
    serializer_class = PaymentSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("status", "currency", "payment_method", "bank_account", "vendor_bill", "payment_date")
    search_fields = ("payment_number", "vendor_bill__bill_number", "vendor_bill__vendor__name")
    ordering_fields = ("payment_number", "payment_date", "amount", "created_at")
    ordering = ("-payment_date", "-created_at")
    schema_action_descriptions = {
        "create": "Post one payment against one vendor bill and derive the bill settlement state",
        "void": "Reverse a posted payment journal and recompute the linked vendor bill state",
    }
    schema_action_error_codes = {
        "create": ("invalid_state_transition", "period_closed", "policy_not_applicable", "validation_error"),
        "void": ("invalid_state_transition", "period_closed", "record_immutable"),
    }

    def get_queryset(self):
        return super().get_queryset().select_related("bank_account", "vendor_bill", "journal_entry")

    def get_required_permission(self):
        return {"create": "payment.create", "void": "payment.void"}.get(
            self.action, "payment.view"
        )

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    @extend_schema(request=CashTransactionVoidSerializer, responses=PaymentSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def void(self, request, pk=None):
        payment = self.get_object()
        payload = CashTransactionVoidSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return Response(
            PaymentSerializer(
                call_validated_service(
                    void_payment,
                    payment=payment,
                    actor=request.user,
                    **payload.validated_data,
                ),
                context=self.get_serializer_context(),
            ).data
        )


class ReceiptViewSet(TenantModelViewSet):
    model = Receipt
    serializer_class = ReceiptSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("status", "currency", "payment_method", "bank_account", "invoice", "receipt_date")
    search_fields = ("receipt_number", "invoice__invoice_number", "invoice__customer__name")
    ordering_fields = ("receipt_number", "receipt_date", "amount", "created_at")
    ordering = ("-receipt_date", "-created_at")
    schema_action_descriptions = {
        "create": "Post one receipt against one invoice and derive the invoice settlement state",
        "void": "Reverse a posted receipt journal and recompute the linked invoice state",
    }
    schema_action_error_codes = {
        "create": ("invalid_state_transition", "period_closed", "policy_not_applicable", "validation_error"),
        "void": ("invalid_state_transition", "period_closed", "record_immutable"),
    }

    def get_queryset(self):
        return super().get_queryset().select_related("bank_account", "invoice", "journal_entry")

    def get_required_permission(self):
        return {"create": "receipt.create", "void": "receipt.void"}.get(
            self.action, "receipt.view"
        )

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    @extend_schema(request=CashTransactionVoidSerializer, responses=ReceiptSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def void(self, request, pk=None):
        receipt = self.get_object()
        payload = CashTransactionVoidSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return Response(
            ReceiptSerializer(
                call_validated_service(
                    void_receipt,
                    receipt=receipt,
                    actor=request.user,
                    **payload.validated_data,
                ),
                context=self.get_serializer_context(),
            ).data
        )


class BankStatementLineViewSet(TenantModelViewSet):
    model = BankStatementLine
    serializer_class = BankStatementLineSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("bank_account", "status", "currency", "statement_date")
    search_fields = ("external_id", "reference", "description")
    ordering_fields = ("statement_date", "amount", "created_at")
    ordering = ("-statement_date", "-created_at")
    schema_action_descriptions = {
        "create": "Import an idempotent bank statement line using its bank-supplied external identifier",
        "match": "Match one statement movement to one posted journal with an equal bank-ledger movement",
        "unmatch": "Remove a statement-to-journal match without altering either ledger record",
    }
    schema_action_error_codes = {
        "create": ("duplicate_operation", "validation_error"),
        "match": ("invalid_state_transition", "duplicate_operation", "validation_error"),
        "unmatch": ("invalid_state_transition",),
    }

    def get_queryset(self):
        return super().get_queryset().select_related("bank_account", "journal_entry", "reconciled_by")

    def get_required_permission(self):
        return {"create": "bank_reconciliation.manage", "match": "bank_reconciliation.manage", "unmatch": "bank_reconciliation.manage"}.get(self.action, "bank_reconciliation.view")

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    @extend_schema(request=BankStatementMatchSerializer, responses=BankStatementLineSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def match(self, request, pk=None):
        payload = BankStatementMatchSerializer(data=request.data, context=self.get_serializer_context())
        payload.is_valid(raise_exception=True)
        return Response(BankStatementLineSerializer(call_validated_service(match_bank_statement_line, statement_line=self.get_object(), actor=request.user, **payload.validated_data), context=self.get_serializer_context()).data)

    @extend_schema(request=None, responses=BankStatementLineSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def unmatch(self, request, pk=None):
        return Response(BankStatementLineSerializer(call_validated_service(unmatch_bank_statement_line, statement_line=self.get_object(), actor=request.user), context=self.get_serializer_context()).data)


class VATWithholdingCertificateViewSet(TenantModelViewSet):
    model = VATWithholdingCertificate
    serializer_class = VATWithholdingCertificateSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("vendor_bill", "withholding_rule", "status", "certificate_date")
    search_fields = ("certificate_number",)
    ordering_fields = ("certificate_date", "certificate_number", "created_at")
    schema_action_descriptions = {"create": "Issue a VAT withholding certificate for a posted vendor bill", "void": "Void an issued VAT withholding certificate while retaining audit history"}
    schema_action_error_codes = {"create": ("policy_not_applicable", "invalid_state_transition", "validation_error"), "void": ("invalid_state_transition",)}

    def get_required_permission(self):
        return {"create": "vat_withholding_certificate.issue", "void": "vat_withholding_certificate.issue"}.get(self.action, "vat_withholding_certificate.view")

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    @extend_schema(request=None, responses=VATWithholdingCertificateSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def void(self, request, pk=None):
        return Response(VATWithholdingCertificateSerializer(call_validated_service(void_vat_withholding_certificate, certificate=self.get_object(), actor=request.user), context=self.get_serializer_context()).data)


class GhanaComplianceReminderViewSet(TenantModelViewSet):
    model = GhanaComplianceReminder
    serializer_class = GhanaComplianceReminderSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("code", "status", "due_date")
    ordering_fields = ("due_date", "code", "created_at")

    def get_required_permission(self):
        return "accounting.configure" if self.action in {"create", "partial_update"} else "financial_report.view"

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution)


class ExpenseViewSet(TenantModelViewSet):
    model = Expense
    serializer_class = ExpenseSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("status", "currency", "account", "expense_date")
    search_fields = ("description",)
    ordering_fields = ("expense_date", "amount", "created_at")
    schema_action_descriptions = {"submit": "Submit a draft expense", "approve": "Approve an expense", "reject": "Reject a pending expense", "post": "Post an approved cash expense journal"}
    schema_action_error_codes = {"submit": ("invalid_state_transition",), "approve": ("invalid_state_transition",), "reject": ("invalid_state_transition",), "post": ("invalid_state_transition", "period_closed", "policy_not_applicable")}
    def get_required_permission(self):
        return {"create": "expense.create", "partial_update": "expense.create", "submit": "expense.create", "approve": "expense.approve", "reject": "expense.approve", "post": "expense.post"}.get(self.action, "expense.view")
    def perform_create(self, serializer): serializer.save(institution=self.request.institution, actor=self.request.user)
    def perform_update(self, serializer): serializer.save(actor=self.request.user)
    @action(detail=True, methods=("post",), filter_backends=())
    def submit(self, request, pk=None): return Response(ExpenseSerializer(call_validated_service(submit_expense, expense=self.get_object(), actor=request.user), context=self.get_serializer_context()).data)
    @action(detail=True, methods=("post",), filter_backends=())
    def approve(self, request, pk=None): return Response(ExpenseSerializer(call_validated_service(approve_expense, expense=self.get_object(), actor=request.user), context=self.get_serializer_context()).data)
    @action(detail=True, methods=("post",), filter_backends=())
    def reject(self, request, pk=None): return Response(ExpenseSerializer(call_validated_service(reject_expense, expense=self.get_object(), actor=request.user), context=self.get_serializer_context()).data)
    @action(detail=True, methods=("post",), filter_backends=())
    def post(self, request, pk=None): return Response(ExpenseSerializer(call_validated_service(post_expense, expense=self.get_object(), actor=request.user), context=self.get_serializer_context()).data)


class PayrollAccountMappingTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    # Stable order so pagination never repeats or skips templates.
    queryset = PayrollAccountMappingTemplate.objects.select_related("accounting_preset_version").order_by("accounting_preset_version_id", "payroll_component_code", "id")
    serializer_class = PayrollAccountMappingTemplateSerializer
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    def get_required_permission(self): return "account.view"


class PayComponentAccountMappingViewSet(TenantModelViewSet):
    model = PayComponentAccountMapping
    serializer_class = PayComponentAccountMappingSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")
    def get_required_permission(self): return "payroll_accounting.configure" if self.action in {"create", "partial_update", "apply_templates"} else "payroll_accounting.view"

    @extend_schema(request=PayrollMappingTemplateApplySerializer, responses=PayComponentAccountMappingSerializer(many=True), filters=False)
    @action(detail=False, methods=("post",), url_path="apply-templates", filter_backends=())
    def apply_templates(self, request):
        payload = PayrollMappingTemplateApplySerializer(data=request.data); payload.is_valid(raise_exception=True)
        result = call_validated_service(apply_payroll_account_mapping_templates, institution=request.institution, actor=request.user, **payload.validated_data)
        return Response(PayComponentAccountMappingSerializer(result, many=True, context=self.get_serializer_context()).data)


class ChartOfAccountsTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ChartOfAccountsTemplate.objects.select_related(
        "preset_version", "preset_version__accounting_preset"
    )
    serializer_class = ChartOfAccountsTemplateSerializer
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    filterset_fields = ("preset_version",)
    search_fields = ("name", "description")

    def get_required_permission(self):
        return "account.view"


class AccountTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AccountTemplate.objects.select_related(
        "coa_template", "coa_template__preset_version", "parent_template"
    )
    serializer_class = AccountTemplateSerializer
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    filterset_fields = (
        "coa_template",
        "account_type",
        "normal_balance",
        "parent_template",
        "is_postable",
        "system_mapping_code",
    )
    search_fields = ("code", "name", "system_mapping_code")
    ordering_fields = ("code", "name", "account_type")
    ordering = ("code",)

    def get_required_permission(self):
        return "account.view"


class InstitutionAccountingConfigurationViewSet(TenantModelViewSet):
    model = InstitutionAccountingConfiguration
    serializer_class = InstitutionAccountingConfigurationSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")

    def get_required_permission(self):
        return (
            "accounting.configure"
            if self.action in {"create", "partial_update"}
            else "account.view"
        )

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    def perform_update(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    @action(detail=False, methods=("get",), filter_backends=())
    def choices(self, request):
        versions = available_accounting_preset_versions(
            institution=request.institution
        )
        choices = [
            {
                "mode": "PRESET",
                "preset_version_id": str(version.id),
                "preset_code": version.accounting_preset.code,
                "version_code": version.version_code,
                "name": version.accounting_preset.name,
                "institution_type": version.accounting_preset.institution_type,
                "reporting_framework": version.reporting_framework,
                "coa_templates": [
                    {"id": str(template.id), "name": template.name}
                    for template in version.coa_templates.all()
                ],
            }
            for version in versions
        ]
        choices.append(
            {
                "mode": "CUSTOM",
                "preset_version_id": None,
                "preset_code": None,
                "version_code": None,
                "name": "Configure manually",
                "reporting_framework": None,
                "compliance_warning": (
                    "Manual accounting setup does not apply localized chart or tax defaults."
                ),
            }
        )
        return Response(
            {
                "country_code": request.institution.country_code,
                "currency": request.institution.default_currency,
                "choices": choices,
            }
        )


class AccountViewSet(TenantModelViewSet):
    model = Account
    serializer_class = AccountSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("account_type", "normal_balance", "parent", "is_postable", "is_active")
    search_fields = ("code", "name")
    ordering_fields = ("code", "name", "account_type", "created_at")
    ordering = ("code",)

    def get_required_permission(self):
        return {
            "create": "account.create",
            "partial_update": "account.update",
            "activity": "journal.view",
            "balances": "account.view",
        }.get(self.action, "account.view")

    @action(detail=False, methods=("get",), filter_backends=())
    def balances(self, request):
        """Posted balance per account (debit minus credit) for the chart of accounts."""
        from django.db.models import Sum

        rows = JournalLine.objects.filter(
            journal_entry__institution=request.institution,
            journal_entry__status__in=(JournalEntry.Status.POSTED, JournalEntry.Status.REVERSED),
        ).values("account_id").annotate(debit=Sum("debit"), credit=Sum("credit"))
        cents = Decimal("0.01")
        return Response({str(row["account_id"]): str((Decimal(row["debit"] or 0) - Decimal(row["credit"] or 0)).quantize(cents)) for row in rows})

    @action(detail=True, methods=("get",), filter_backends=())
    def activity(self, request, pk=None):
        """Every journal line on this account in the range, posted or not, with a
        running balance over posted lines and a monthly movement summary."""
        from datetime import date as date_type
        from decimal import Decimal as D

        from django.db.models import Sum
        from django.db.models.functions import TruncMonth

        account = self.get_object()
        params = request.query_params
        money = lambda value: str(D(value or 0).quantize(D("0.01")))  # noqa: E731
        try:
            date_from = date_type.fromisoformat(params["date_from"]) if params.get("date_from") else None
            date_to = date_type.fromisoformat(params["date_to"]) if params.get("date_to") else None
        except ValueError:
            from rest_framework.exceptions import ValidationError as DRFValidationError

            raise DRFValidationError({"date_from": "Use YYYY-MM-DD dates."})
        posted = (JournalEntry.Status.POSTED, JournalEntry.Status.REVERSED)
        base = JournalLine.objects.filter(journal_entry__institution=request.institution, account=account)
        opening = D("0.00")
        if date_from:
            before = base.filter(journal_entry__status__in=posted, journal_entry__entry_date__lt=date_from).aggregate(debit=Sum("debit"), credit=Sum("credit"))
            opening = D(before["debit"] or 0) - D(before["credit"] or 0)
        lines = base.select_related("journal_entry")
        if date_from:
            lines = lines.filter(journal_entry__entry_date__gte=date_from)
        if date_to:
            lines = lines.filter(journal_entry__entry_date__lte=date_to)
        if params.get("status"):
            lines = lines.filter(journal_entry__status=params["status"])
        if params.get("source"):
            lines = lines.filter(journal_entry__source=params["source"])
        if params.get("search"):
            from django.db.models import Q

            term = params["search"]
            lines = lines.filter(Q(description__icontains=term) | Q(journal_entry__description__icontains=term) | Q(journal_entry__journal_number__icontains=term) | Q(journal_entry__reference__icontains=term))
        running = opening
        rows = []
        for line in lines.order_by("journal_entry__entry_date", "journal_entry__journal_number", "created_at")[:500]:
            is_posted = line.journal_entry.status in posted
            if is_posted:
                running += line.debit - line.credit
            rows.append({
                "id": str(line.id), "journal_entry_id": str(line.journal_entry_id), "journal_number": line.journal_entry.journal_number,
                "entry_date": line.journal_entry.entry_date, "reference": line.journal_entry.reference or "",
                "description": line.description or line.journal_entry.description, "debit": money(line.debit), "credit": money(line.credit),
                "running_balance": money(running) if is_posted else None, "status": line.journal_entry.status, "source": line.journal_entry.source,
            })
        posted_range = base.filter(journal_entry__status__in=posted)
        if date_from:
            posted_range = posted_range.filter(journal_entry__entry_date__gte=date_from)
        if date_to:
            posted_range = posted_range.filter(journal_entry__entry_date__lte=date_to)
        totals = posted_range.aggregate(debit=Sum("debit"), credit=Sum("credit"))
        monthly = [
            {"month": (row["month"].date() if hasattr(row["month"], "date") else row["month"]).isoformat(), "debit": money(row["debit"]), "credit": money(row["credit"])}
            for row in posted_range.annotate(month=TruncMonth("journal_entry__entry_date")).values("month").annotate(debit=Sum("debit"), credit=Sum("credit")).order_by("month")
        ]
        all_time = base.filter(journal_entry__status__in=posted).aggregate(debit=Sum("debit"), credit=Sum("credit"))
        return Response({
            "account": {"id": str(account.id), "code": account.code, "name": account.name, "account_type": account.account_type,
                        "normal_balance": account.normal_balance, "is_postable": account.is_postable, "is_active": account.is_active,
                        "parent": str(account.parent_id) if account.parent_id else None, "parent_name": account.parent.name if account.parent_id else None},
            "balance": money(D(all_time["debit"] or 0) - D(all_time["credit"] or 0)),
            "opening_balance": money(opening),
            "closing_balance": money(running),
            "period_debits": money(totals["debit"]),
            "period_credits": money(totals["credit"]),
            "unposted_lines": sum(1 for row in rows if row["running_balance"] is None),
            "monthly": monthly,
            "lines": rows,
        })

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    def perform_update(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)


class FiscalYearViewSet(TenantModelViewSet):
    model = FiscalYear
    serializer_class = FiscalYearSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("status", "start_date", "end_date")
    search_fields = ("name",)

    def get_required_permission(self):
        if self.action == "create":
            return "accounting.configure"
        if self.action == "close":
            return "accounting_period.close"
        return "account.view"

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    @extend_schema(request=None, responses=FiscalYearSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def close(self, request, pk=None):
        fiscal_year = call_validated_service(
            close_fiscal_year, fiscal_year=self.get_object(), actor=request.user
        )
        return Response(self.get_serializer(fiscal_year).data)


class AccountingPeriodViewSet(TenantModelViewSet):
    model = AccountingPeriod
    serializer_class = AccountingPeriodSerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("fiscal_year", "status", "start_date", "end_date")
    search_fields = ("name",)
    schema_action_descriptions = {
        "close": "Close an open accounting period after all journals are resolved",
        "lock": "Lock an accounting period after all journals are resolved",
        "reopen": "Reopen a closed or locked accounting period",
    }
    schema_action_error_codes = {
        "close": ("invalid_state_transition",),
        "lock": ("invalid_state_transition",),
        "reopen": ("invalid_state_transition",),
    }

    def get_required_permission(self):
        if self.action == "create":
            return "accounting.configure"
        if self.action in {"close", "lock"}:
            return "accounting_period.close"
        if self.action == "reopen":
            return "accounting_period.reopen"
        return "account.view"

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    def _set_status(self, request, status):
        period = call_validated_service(
            set_period_status, period=self.get_object(), actor=request.user, status=status
        )
        return Response(self.get_serializer(period).data)

    @extend_schema(request=None, responses=AccountingPeriodSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def close(self, request, pk=None):
        return self._set_status(request, AccountingPeriod.Status.CLOSED)

    @extend_schema(request=None, responses=AccountingPeriodSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def lock(self, request, pk=None):
        return self._set_status(request, AccountingPeriod.Status.LOCKED)

    @extend_schema(request=None, responses=AccountingPeriodSerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def reopen(self, request, pk=None):
        return self._set_status(request, AccountingPeriod.Status.OPEN)


class JournalEntryViewSet(TenantModelViewSet):
    model = JournalEntry
    serializer_class = JournalEntrySerializer
    required_module = "ACCOUNTING"
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("accounting_period", "entry_date", "source", "status", "reversal_of")
    search_fields = ("journal_number", "description", "reference")
    ordering_fields = ("journal_number", "entry_date", "created_at", "posted_at")
    schema_action_descriptions = {
        "submit": "Validate and submit a balanced draft journal for approval",
        "approve": "Approve a submitted journal for posting",
        "post": "Post an approved journal into the immutable general ledger",
        "void": "Void an unposted journal",
        "reverse": "Create an unposted journal with lines that reverse a posted journal",
    }
    schema_action_error_codes = {
        "submit": ("unbalanced_journal", "invalid_state_transition"),
        "approve": ("unbalanced_journal", "invalid_state_transition"),
        "post": (
            "unbalanced_journal",
            "invalid_state_transition",
            "period_closed",
            "record_immutable",
        ),
        "void": ("invalid_state_transition", "record_immutable"),
        "reverse": ("invalid_state_transition", "period_closed", "duplicate_operation"),
    }

    def get_required_permission(self):
        return {
            "create": "journal.create",
            "partial_update": "journal.create",
            "submit": "journal.create",
            "approve": "journal.approve",
            "post": "journal.post",
            "reverse": "journal.reverse",
            "void": "journal.create",
            "attachments": "journal.create",
            "notes": "journal.view",
        }.get(self.action, "journal.view")

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            "accounting_period", "created_by", "approved_by", "posted_by", "reversal_of"
        ).prefetch_related("lines__account", "lines__department")
        params = self.request.query_params
        if params.get("account"):
            queryset = queryset.filter(lines__account_id=params["account"]).distinct()
        if params.get("date_from"):
            queryset = queryset.filter(entry_date__gte=params["date_from"])
        if params.get("date_to"):
            queryset = queryset.filter(entry_date__lte=params["date_to"])
        return queryset

    def _journal_documents(self, journal):
        from apps.documents.models import Document

        return Document.objects.for_institution(self.request.institution).filter(
            entity_type="accounting.JournalEntry", entity_id=journal.id, is_active=True
        )

    @action(detail=True, methods=("get",), filter_backends=())
    def context(self, request, pk=None):
        """Related records, notes, attachments and audit events for the detail page."""
        from apps.accounting.models import Expense, Invoice, Payment, Receipt, VendorBill
        from apps.audit.models import AuditLog
        from apps.documents.serializers import DocumentSerializer

        journal = self.get_object()
        related = []
        for label, rows, route in (
            ("Vendor bill", VendorBill.objects.filter(journal_entry=journal), "/accounting/payables/bills/"),
            ("Customer invoice", Invoice.objects.filter(journal_entry=journal), "/accounting/receivables/invoices/"),
            ("Payment", Payment.objects.filter(journal_entry=journal), None),
            ("Receipt", Receipt.objects.filter(journal_entry=journal), None),
            ("Expense", Expense.objects.filter(journal_entry=journal), None),
        ):
            for row in rows[:20]:
                number = next((getattr(row, field) for field in ("bill_number", "invoice_number", "payment_number", "receipt_number", "reference") if getattr(row, field, None)), str(row.pk)[:8])
                related.append({"type": label, "id": str(row.pk), "reference": number, "status": getattr(row, "status", ""), "href": f"{route}{row.pk}" if route else None})
        for run in journal.payroll_runs.all()[:5]:
            related.append({"type": "Payroll run", "id": str(run.pk), "reference": str(run), "status": run.status, "href": f"/payroll/runs/{run.pk}"})
        if journal.reversal_of_id:
            related.append({"type": "Reverses journal", "id": str(journal.reversal_of_id), "reference": journal.reversal_of.journal_number, "status": journal.reversal_of.status, "href": f"/accounting/journals/{journal.reversal_of_id}"})
        for reversal in journal.reversals.all():
            related.append({"type": "Reversed by", "id": str(reversal.pk), "reference": reversal.journal_number, "status": reversal.status, "href": f"/accounting/journals/{reversal.pk}"})
        audit = AuditLog.objects.filter(institution=request.institution, entity_id=journal.id).select_related("actor").order_by("-created_at")[:50]
        name = lambda user: (user.get_full_name() or user.email) if user else "System"  # noqa: E731
        return Response({
            "related": related,
            "notes": [{"id": str(note.id), "author": name(note.author), "body": note.body, "created_at": note.created_at} for note in journal.notes.select_related("author")],
            "attachments": DocumentSerializer(self._journal_documents(journal), many=True, context={"request": request}).data,
            "audit": [{"id": str(entry.id), "action": entry.action, "actor": name(entry.actor), "created_at": entry.created_at, "metadata": entry.metadata} for entry in audit],
            "requires_approval": journal.source == JournalEntry.Source.MANUAL,
        })

    @action(detail=True, methods=("post",), filter_backends=())
    def notes(self, request, pk=None):
        from apps.accounting.models import JournalEntryNote
        from apps.audit.services import record_audit_event
        from rest_framework.exceptions import ValidationError as DRFValidationError

        journal = self.get_object()
        body = (request.data.get("body") or "").strip()
        if not body:
            raise DRFValidationError({"body": "Write a note first."})
        note = JournalEntryNote.objects.create(institution=request.institution, journal_entry=journal, author=request.user, body=body[:4000])
        record_audit_event(actor=request.user, institution=request.institution, entity=journal, action="accounting.journal.note_added")
        return Response({"id": str(note.id), "author": request.user.get_full_name() or request.user.email, "body": note.body, "created_at": note.created_at}, status=201)

    @action(detail=True, methods=("post",), filter_backends=(), parser_classes=(MultiPartParser, FormParser))
    def attachments(self, request, pk=None):
        import mimetypes

        from django.conf import settings as django_settings
        from apps.audit.services import record_audit_event
        from apps.documents.models import Document
        from apps.documents.serializers import DocumentSerializer
        from rest_framework.exceptions import ValidationError as DRFValidationError

        journal = self.get_object()
        upload = request.FILES.get("uploaded_file")
        if upload is None:
            raise DRFValidationError({"uploaded_file": "Choose a file to upload."})
        if upload.size > django_settings.DOCUMENT_UPLOAD_MAX_BYTES:
            raise DRFValidationError({"uploaded_file": f"Files must be {django_settings.DOCUMENT_UPLOAD_MAX_BYTES // (1024 * 1024)} MB or smaller."})
        name = (upload.name or "attachment").replace("\\", "/").rsplit("/", 1)[-1][:255]
        content_type = (upload.content_type or "").split(";")[0].strip().lower()
        if not content_type or content_type == "application/octet-stream":
            content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        document = Document.objects.create(
            institution=request.institution, uploaded_by=request.user, stored_file=upload, original_filename=name,
            content_type=content_type[:150], size_bytes=upload.size, category="JOURNAL_SUPPORT",
            classification=Document.Classification.CONFIDENTIAL, entity_type="accounting.JournalEntry", entity_id=journal.id,
        )
        record_audit_event(actor=request.user, institution=request.institution, entity=journal, action="accounting.journal.attachment_added", metadata={"filename": name})
        return Response(DocumentSerializer(document, context={"request": request}).data, status=201)

    @action(detail=True, methods=("get",), filter_backends=(), url_path=r"attachments/(?P<document_id>[0-9a-f-]+)/download")
    def download_attachment(self, request, pk=None, document_id=None):
        from django.http import FileResponse
        from rest_framework.exceptions import NotFound

        document = self._journal_documents(self.get_object()).filter(pk=document_id).first()
        if document is None or not document.stored_file:
            raise NotFound("Attachment not found.")
        response = FileResponse(document.stored_file.open("rb"), as_attachment=True, filename=document.original_filename,
                                content_type=document.content_type or "application/octet-stream")
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    def perform_update(self, serializer):
        serializer.save(institution=self.request.institution, actor=self.request.user)

    def _transition(self, request, service):
        journal = call_validated_service(
            service, journal=self.get_object(), actor=request.user
        )
        return Response(self.get_serializer(journal).data)

    @extend_schema(request=None, responses=JournalEntrySerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def submit(self, request, pk=None):
        return self._transition(request, submit_journal)

    @extend_schema(request=None, responses=JournalEntrySerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def approve(self, request, pk=None):
        return self._transition(request, approve_journal)

    @extend_schema(request=None, responses=JournalEntrySerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def post(self, request, pk=None):
        return self._transition(request, post_journal)

    @extend_schema(request=None, responses=JournalEntrySerializer, filters=False)
    @action(detail=True, methods=("post",), filter_backends=())
    def void(self, request, pk=None):
        return self._transition(request, void_journal)

    @extend_schema(
        request=JournalReversalSerializer,
        responses=JournalEntrySerializer,
        filters=False,
    )
    @action(detail=True, methods=("post",), filter_backends=())
    def reverse(self, request, pk=None):
        journal = self.get_object()
        payload = JournalReversalSerializer(data=request.data, context=self.get_serializer_context())
        payload.is_valid(raise_exception=True)
        reversal = call_validated_service(
            create_reversal,
            journal=journal,
            actor=request.user,
            **payload.validated_data,
        )
        return Response(self.get_serializer(reversal).data)


class JournalLineViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = JournalLineSerializer
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    filterset_fields = ("journal_entry", "account", "department", "location", "employee")
    ordering_fields = ("debit", "credit", "created_at")

    def get_required_permission(self):
        return "journal.view"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return JournalLine.objects.none()
        return JournalLine.objects.filter(
            journal_entry__institution=self.request.institution
        ).select_related("journal_entry", "account", "department", "location", "employee")


class AccountingReportViewSet(viewsets.ViewSet):
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "ACCOUNTING"
    schema_scope_description = (
        "Reports are derived only from posted journal lines in the active institution."
    )
    schema_action_error_codes = {
        "general_ledger": ("not_found", "validation_error"),
        "trial_balance": ("validation_error",),
        "income_statement": ("validation_error",),
        "balance_sheet": ("validation_error",),
    }

    def get_required_permission(self):
        return "financial_report.view"

    @extend_schema(
        parameters=[GeneralLedgerQuerySerializer],
        responses=GeneralLedgerSerializer,
        filters=False,
    )
    @action(detail=False, methods=("get",), url_path="general-ledger")
    def general_ledger(self, request):
        query = GeneralLedgerQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        account = get_object_or_404(
            Account.objects.for_institution(request.institution),
            pk=query.validated_data["account"],
        )
        result = general_ledger(
            institution=request.institution,
            account=account,
            date_from=query.validated_data.get("date_from"),
            date_to=query.validated_data.get("date_to"),
        )
        return Response(GeneralLedgerSerializer(result).data)

    @extend_schema(
        parameters=[DateRangeQuerySerializer],
        responses=TrialBalanceSerializer,
        filters=False,
    )
    @action(detail=False, methods=("get",), url_path="trial-balance")
    def trial_balance(self, request):
        query = DateRangeQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        result = trial_balance(
            institution=request.institution,
            date_from=query.validated_data.get("date_from"),
            date_to=query.validated_data.get("date_to"),
        )
        return Response(TrialBalanceSerializer(result).data)

    @extend_schema(
        parameters=[DateRangeQuerySerializer],
        responses=IncomeStatementSerializer,
        filters=False,
    )
    @action(detail=False, methods=("get",), url_path="income-statement")
    def income_statement(self, request):
        query = DateRangeQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        result = income_statement(
            institution=request.institution,
            date_from=query.validated_data.get("date_from"),
            date_to=query.validated_data.get("date_to"),
        )
        return Response(IncomeStatementSerializer(result).data)

    @extend_schema(
        parameters=[BalanceSheetQuerySerializer],
        responses=BalanceSheetSerializer,
        filters=False,
    )
    @action(detail=False, methods=("get",), url_path="balance-sheet")
    def balance_sheet(self, request):
        query = BalanceSheetQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        result = balance_sheet(
            institution=request.institution,
            as_of=query.validated_data.get("as_of"),
        )
        return Response(BalanceSheetSerializer(result).data)
