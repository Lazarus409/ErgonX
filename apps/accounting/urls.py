from rest_framework.routers import DefaultRouter

from apps.accounting.views import (
    AccountViewSet,
    AccountingPeriodViewSet,
    AccountingPresetVersionViewSet,
    AccountingPresetViewSet,
    AccountTemplateViewSet,
    ChartOfAccountsTemplateViewSet,
    AccountingReportViewSet,
    FiscalYearViewSet,
    GhanaLocalizationVersionViewSet,
    InstitutionAccountingConfigurationViewSet,
    JournalEntryViewSet,
    JournalLineViewSet,
    TaxCodeViewSet,
    TaxComponentViewSet,
    WithholdingRuleViewSet,
    VendorViewSet,
    VendorBillViewSet,
    CustomerViewSet,
    InvoiceViewSet,
    BankAccountViewSet,
    PaymentViewSet,
    ReceiptViewSet,
    BankStatementLineViewSet,
    VATWithholdingCertificateViewSet,
    GhanaComplianceReminderViewSet,
    ExpenseViewSet,
    PayrollAccountMappingTemplateViewSet,
    PayComponentAccountMappingViewSet,
)


router = DefaultRouter()
router.register("accounting-presets", AccountingPresetViewSet, basename="accounting-preset")
router.register(
    "accounting-preset-versions",
    AccountingPresetVersionViewSet,
    basename="accounting-preset-version",
)
router.register(
    "ghana-localization-versions",
    GhanaLocalizationVersionViewSet,
    basename="ghana-localization-version",
)
router.register("tax-codes", TaxCodeViewSet, basename="tax-code")
router.register("tax-components", TaxComponentViewSet, basename="tax-component")
router.register("withholding-rules", WithholdingRuleViewSet, basename="withholding-rule")
router.register("vendors", VendorViewSet, basename="vendor")
router.register("vendor-bills", VendorBillViewSet, basename="vendor-bill")
router.register("customers", CustomerViewSet, basename="customer")
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("bank-accounts", BankAccountViewSet, basename="bank-account")
router.register("payments", PaymentViewSet, basename="payment")
router.register("receipts", ReceiptViewSet, basename="receipt")
router.register("bank-statement-lines", BankStatementLineViewSet, basename="bank-statement-line")
router.register("vat-withholding-certificates", VATWithholdingCertificateViewSet, basename="vat-withholding-certificate")
router.register("ghana-compliance-reminders", GhanaComplianceReminderViewSet, basename="ghana-compliance-reminder")
router.register("expenses", ExpenseViewSet, basename="expense")
router.register("payroll-account-mapping-templates", PayrollAccountMappingTemplateViewSet, basename="payroll-account-mapping-template")
router.register("pay-component-account-mappings", PayComponentAccountMappingViewSet, basename="pay-component-account-mapping")
router.register(
    "chart-of-accounts-templates",
    ChartOfAccountsTemplateViewSet,
    basename="chart-of-accounts-template",
)
router.register(
    "account-templates", AccountTemplateViewSet, basename="account-template"
)
router.register(
    "accounting-configurations",
    InstitutionAccountingConfigurationViewSet,
    basename="accounting-configuration",
)
router.register("accounts", AccountViewSet, basename="account")
router.register("fiscal-years", FiscalYearViewSet, basename="fiscal-year")
router.register("accounting-periods", AccountingPeriodViewSet, basename="accounting-period")
router.register("journal-entries", JournalEntryViewSet, basename="journal-entry")
router.register("journal-lines", JournalLineViewSet, basename="journal-line")
router.register("accounting-reports", AccountingReportViewSet, basename="accounting-report")

urlpatterns = router.urls
