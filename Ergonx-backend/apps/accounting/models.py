from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.db import models

from apps.employees.models import Employee
from apps.compensation.models import PayComponent
from apps.documents.models import Document
from apps.institutions.models import Institution
from apps.organization.models import Department, Location
from common.models import BaseModel, TenantOwnedModel


class AccountingPreset(BaseModel):
    code = models.CharField(max_length=80, unique=True)
    country_code = models.CharField(max_length=2)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    institution_type = models.CharField(max_length=40)
    is_system_managed = models.BooleanField(default=True)

    class Meta:
        ordering = ("country_code", "code")

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        self.country_code = self.country_code.strip().upper()
        super().save(*args, **kwargs)


class AccountingPresetVersion(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        RETIRED = "RETIRED", "Retired"

    accounting_preset = models.ForeignKey(
        AccountingPreset, on_delete=models.CASCADE, related_name="versions"
    )
    version_code = models.CharField(max_length=80)
    localization_version = models.CharField(max_length=80, blank=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    reporting_framework = models.CharField(max_length=80)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    source_metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("accounting_preset", "-effective_from")
        constraints = [
            models.UniqueConstraint(
                fields=("accounting_preset", "version_code"),
                name="uniq_accounting_preset_version",
            )
        ]

    def clean(self):
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({"effective_to": "Effective end cannot precede start."})


class GhanaLocalizationVersion(BaseModel):
    """Versioned, global Ghana statutory configuration provenance."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        RETIRED = "RETIRED", "Retired"

    code = models.CharField(max_length=80, unique=True)
    version = models.CharField(max_length=40)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    default_currency = models.CharField(max_length=3)
    tax_authority = models.CharField(max_length=150)
    source_metadata = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        ordering = ("-effective_from", "code")
        constraints = [
            models.UniqueConstraint(
                fields=("version", "effective_from"),
                name="uniq_ghana_localization_version_effective_date",
            ),
            models.CheckConstraint(
                condition=Q(effective_to__isnull=True) | Q(effective_to__gte=models.F("effective_from")),
                name="ghana_localization_dates_valid",
            ),
        ]

    def clean(self):
        self.code = self.code.strip().upper()
        self.version = self.version.strip()
        self.default_currency = self.default_currency.strip().upper()
        errors = {}
        if len(self.default_currency) != 3 or not self.default_currency.isalpha():
            errors["default_currency"] = "Use a three-letter ISO currency code."
        if self.effective_to and self.effective_to < self.effective_from:
            errors["effective_to"] = "Effective end cannot precede start."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)


class PayrollAccountMappingTemplate(BaseModel):
    accounting_preset_version = models.ForeignKey(AccountingPresetVersion, on_delete=models.CASCADE, related_name="payroll_account_mapping_templates")
    payroll_component_code = models.CharField(max_length=50)
    debit_account_mapping_code = models.CharField(max_length=80, null=True, blank=True)
    credit_account_mapping_code = models.CharField(max_length=80, null=True, blank=True)
    description = models.TextField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=("accounting_preset_version", "payroll_component_code"), name="uniq_payroll_mapping_template_component")]

    def clean(self):
        self.payroll_component_code = self.payroll_component_code.strip().upper()
        if not self.debit_account_mapping_code and not self.credit_account_mapping_code:
            raise ValidationError("At least one debit or credit mapping is required.")


class TaxCode(BaseModel):
    preset_version = models.ForeignKey(
        AccountingPresetVersion, on_delete=models.CASCADE, related_name="tax_codes"
    )
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=150)
    tax_treatment = models.CharField(max_length=40)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("preset_version", "code", "effective_from")
        constraints = [
            models.UniqueConstraint(
                fields=("preset_version", "code", "effective_from"),
                name="uniq_tax_code_effective_date",
            ),
            models.CheckConstraint(
                condition=Q(effective_to__isnull=True) | Q(effective_to__gte=models.F("effective_from")),
                name="tax_code_dates_valid",
            ),
        ]

    def clean(self):
        self.code = self.code.strip().upper()
        self.tax_treatment = self.tax_treatment.strip().upper()
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({"effective_to": "Effective end cannot precede start."})

    def save(self, *args, **kwargs):
        self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)


class TaxComponent(BaseModel):
    tax_code = models.ForeignKey(TaxCode, on_delete=models.CASCADE, related_name="components")
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=150)
    rate = models.DecimalField(max_digits=7, decimal_places=4)
    input_account_mapping_code = models.CharField(max_length=100, null=True, blank=True)
    output_account_mapping_code = models.CharField(max_length=100, null=True, blank=True)
    sequence = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ("tax_code", "sequence", "code")
        constraints = [
            models.UniqueConstraint(
                fields=("tax_code", "code"), name="uniq_tax_component_code_per_tax_code"
            ),
            models.UniqueConstraint(
                fields=("tax_code", "sequence"), name="uniq_tax_component_sequence_per_tax_code"
            ),
            models.CheckConstraint(
                condition=Q(rate__gte=0) & Q(rate__lte=100),
                name="tax_component_rate_percent_valid",
            ),
        ]

    def clean(self):
        self.code = self.code.strip().upper()
        self.input_account_mapping_code = (
            self.input_account_mapping_code.strip().upper()
            if self.input_account_mapping_code
            else None
        )
        self.output_account_mapping_code = (
            self.output_account_mapping_code.strip().upper()
            if self.output_account_mapping_code
            else None
        )
        if self.rate is not None and not 0 <= self.rate <= 100:
            raise ValidationError({"rate": "Rate must be between 0 and 100 percent."})

    def save(self, *args, **kwargs):
        self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)


class WithholdingRule(BaseModel):
    preset_version = models.ForeignKey(
        AccountingPresetVersion, on_delete=models.CASCADE, related_name="withholding_rules"
    )
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=150)
    residency = models.CharField(max_length=30)
    transaction_category = models.CharField(max_length=80)
    rate = models.DecimalField(max_digits=7, decimal_places=4)
    threshold = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_vat_withholding_rule = models.BooleanField(default=False)
    requires_confirmation = models.BooleanField(default=False)

    class Meta:
        ordering = ("preset_version", "code", "effective_from")
        constraints = [
            models.UniqueConstraint(
                fields=("preset_version", "code", "effective_from"),
                name="uniq_withholding_rule_effective_date",
            ),
            models.CheckConstraint(
                condition=Q(effective_to__isnull=True) | Q(effective_to__gte=models.F("effective_from")),
                name="withholding_rule_dates_valid",
            ),
            models.CheckConstraint(
                condition=Q(rate__gte=0) & Q(rate__lte=100),
                name="withholding_rule_rate_percent_valid",
            ),
            models.CheckConstraint(
                condition=Q(threshold__isnull=True) | Q(threshold__gte=0),
                name="withholding_rule_threshold_valid",
            ),
        ]

    def clean(self):
        self.code = self.code.strip().upper()
        self.residency = self.residency.strip().upper()
        self.transaction_category = self.transaction_category.strip().upper()
        errors = {}
        if self.rate is not None and not 0 <= self.rate <= 100:
            errors["rate"] = "Rate must be between 0 and 100 percent."
        if self.threshold is not None and self.threshold < 0:
            errors["threshold"] = "Threshold cannot be negative."
        if self.effective_to and self.effective_to < self.effective_from:
            errors["effective_to"] = "Effective end cannot precede start."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)


class InstitutionAccountingConfiguration(TenantOwnedModel):
    class SetupMode(models.TextChoices):
        PRESET = "PRESET", "Preset"
        CUSTOM = "CUSTOM", "Custom"

    institution = models.OneToOneField(
        Institution, on_delete=models.CASCADE, related_name="accounting_configuration"
    )
    country_code = models.CharField(max_length=2)
    base_currency = models.CharField(max_length=3)
    accounting_setup_mode = models.CharField(max_length=10, choices=SetupMode.choices)
    selected_accounting_preset_version = models.ForeignKey(
        AccountingPresetVersion,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="institution_configurations",
    )
    reporting_framework = models.CharField(max_length=80)
    tax_identification_number = models.CharField(max_length=80, blank=True)
    vat_registered = models.BooleanField(default=False)
    is_vat_withholding_agent = models.BooleanField(default=False)
    statutory_profile_metadata = models.JSONField(default=dict, blank=True)
    fiscal_year_start_month = models.PositiveSmallIntegerField(default=1)
    is_configured = models.BooleanField(default=False)
    configured_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="accounting_configurations_set",
    )
    configured_at = models.DateTimeField()

    def clean(self):
        self.country_code = self.country_code.strip().upper()
        self.base_currency = self.base_currency.strip().upper()
        errors = {}
        if len(self.country_code) != 2 or not self.country_code.isalpha():
            errors["country_code"] = "Use a two-letter ISO country code."
        if len(self.base_currency) != 3 or not self.base_currency.isalpha():
            errors["base_currency"] = "Use a three-letter ISO currency code."
        if not 1 <= self.fiscal_year_start_month <= 12:
            errors["fiscal_year_start_month"] = "Use a month from 1 through 12."
        version = self.selected_accounting_preset_version
        if self.accounting_setup_mode == self.SetupMode.PRESET:
            if version is None:
                errors["selected_accounting_preset_version"] = "Preset mode requires a version."
            elif version.status != AccountingPresetVersion.Status.ACTIVE:
                errors["selected_accounting_preset_version"] = "Selected version must be active."
            elif version.accounting_preset.country_code != self.country_code:
                errors["selected_accounting_preset_version"] = (
                    "Selected preset must match the configured country."
                )
        elif version is not None:
            errors["selected_accounting_preset_version"] = (
                "Custom mode cannot select an accounting preset version."
            )
        if self.configured_by_id and not self.configured_by.memberships.filter(
            institution_id=self.institution_id, status="ACTIVE"
        ).exists():
            errors["configured_by"] = "Configurer must be an active institution member."
        if errors:
            raise ValidationError(errors)


class Account(TenantOwnedModel):
    class AccountType(models.TextChoices):
        ASSET = "ASSET", "Asset"
        LIABILITY = "LIABILITY", "Liability"
        EQUITY = "EQUITY", "Equity"
        INCOME = "INCOME", "Income"
        EXPENSE = "EXPENSE", "Expense"

    class NormalBalance(models.TextChoices):
        DEBIT = "DEBIT", "Debit"
        CREDIT = "CREDIT", "Credit"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="accounts"
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    account_type = models.CharField(max_length=12, choices=AccountType.choices)
    parent = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="children"
    )
    normal_balance = models.CharField(max_length=6, choices=NormalBalance.choices)
    is_postable = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("code",)
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "code"), name="uniq_account_code_per_institution"
            )
        ]
        indexes = [models.Index(fields=("institution", "account_type", "is_active"))]

    def clean(self):
        errors = {}
        if self.parent_id:
            if self.parent_id == self.id:
                errors["parent"] = "An account cannot be its own parent."
            elif self.parent.institution_id != self.institution_id:
                errors["parent"] = "Parent account belongs to another institution."
            else:
                ancestor = self.parent
                while ancestor is not None:
                    if ancestor.id == self.id:
                        errors["parent"] = "Account hierarchy cannot contain a cycle."
                        break
                    ancestor = ancestor.parent
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)


class ChartOfAccountsTemplate(BaseModel):
    preset_version = models.ForeignKey(
        AccountingPresetVersion,
        on_delete=models.CASCADE,
        related_name="coa_templates",
    )
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ("preset_version", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("preset_version", "name"),
                name="uniq_coa_template_name_per_version",
            )
        ]


class AccountTemplate(BaseModel):
    coa_template = models.ForeignKey(
        ChartOfAccountsTemplate,
        on_delete=models.CASCADE,
        related_name="account_templates",
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    account_type = models.CharField(max_length=12, choices=Account.AccountType.choices)
    parent_template = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="child_templates",
    )
    normal_balance = models.CharField(
        max_length=6, choices=Account.NormalBalance.choices
    )
    is_postable = models.BooleanField(default=True)
    system_mapping_code = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ("coa_template", "code")
        constraints = [
            models.UniqueConstraint(
                fields=("coa_template", "code"),
                name="uniq_account_template_code",
            ),
            models.UniqueConstraint(
                fields=("coa_template", "system_mapping_code"),
                condition=models.Q(system_mapping_code__isnull=False),
                name="uniq_account_template_mapping_code",
            ),
        ]

    def clean(self):
        errors = {}
        if self.parent_template_id:
            if self.parent_template_id == self.id:
                errors["parent_template"] = "An account template cannot be its own parent."
            elif self.parent_template.coa_template_id != self.coa_template_id:
                errors["parent_template"] = (
                    "Parent account template belongs to another chart template."
                )
            else:
                ancestor = self.parent_template
                while ancestor is not None:
                    if ancestor.id == self.id:
                        errors["parent_template"] = (
                            "Account template hierarchy cannot contain a cycle."
                        )
                        break
                    ancestor = ancestor.parent_template
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        self.system_mapping_code = (
            self.system_mapping_code.strip().upper()
            if self.system_mapping_code
            else None
        )
        self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)


class PayComponentAccountMapping(TenantOwnedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="pay_component_account_mappings")
    pay_component = models.ForeignKey(PayComponent, on_delete=models.PROTECT, related_name="account_mappings")
    debit_account = models.ForeignKey(Account, on_delete=models.PROTECT, null=True, blank=True, related_name="payroll_debit_mappings")
    credit_account = models.ForeignKey(Account, on_delete=models.PROTECT, null=True, blank=True, related_name="payroll_credit_mappings")
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("institution", "pay_component", "effective_from"), name="uniq_pay_component_mapping_effective_date")]

    def clean(self):
        errors = {}
        if self.effective_to and self.effective_to < self.effective_from: errors["effective_to"] = "Effective end cannot precede start."
        for field in ("pay_component", "debit_account", "credit_account"):
            record = getattr(self, field, None)
            if record and record.institution_id != self.institution_id: errors[field] = "Referenced record belongs to another institution."
        if not self.debit_account_id and not self.credit_account_id: errors["debit_account"] = "At least one debit or credit account is required."
        if errors: raise ValidationError(errors)


class FiscalYear(TenantOwnedModel):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        CLOSED = "CLOSED", "Closed"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="fiscal_years"
    )
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=6, choices=Status.choices, default=Status.OPEN)

    class Meta:
        ordering = ("-start_date",)
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "name"), name="uniq_fiscal_year_name_per_institution"
            ),
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")),
                name="fiscal_year_dates_valid",
            ),
        ]

    def clean(self):
        errors = {}
        if self.end_date < self.start_date:
            errors["end_date"] = "End date cannot precede start date."
        overlap = FiscalYear.objects.filter(
            institution_id=self.institution_id,
            start_date__lte=self.end_date,
            end_date__gte=self.start_date,
        )
        if self.pk:
            overlap = overlap.exclude(pk=self.pk)
        if overlap.exists():
            errors["start_date"] = "Fiscal years cannot overlap."
        if errors:
            raise ValidationError(errors)


class AccountingPeriod(TenantOwnedModel):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        CLOSED = "CLOSED", "Closed"
        LOCKED = "LOCKED", "Locked"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="accounting_periods"
    )
    fiscal_year = models.ForeignKey(
        FiscalYear, on_delete=models.PROTECT, related_name="periods"
    )
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=6, choices=Status.choices, default=Status.OPEN)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="accounting_periods_closed",
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-start_date",)
        constraints = [
            models.UniqueConstraint(
                fields=("fiscal_year", "start_date", "end_date"),
                name="uniq_accounting_period_dates",
            ),
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")),
                name="accounting_period_dates_valid",
            ),
        ]
        indexes = [models.Index(fields=("institution", "status", "start_date"))]

    def clean(self):
        errors = {}
        if self.fiscal_year_id and self.fiscal_year.institution_id != self.institution_id:
            errors["fiscal_year"] = "Fiscal year belongs to another institution."
        elif (
            self.fiscal_year_id
            and self.fiscal_year.status == FiscalYear.Status.CLOSED
            and self.status == self.Status.OPEN
        ):
            errors["fiscal_year"] = "Open periods cannot belong to a closed fiscal year."
        if self.end_date < self.start_date:
            errors["end_date"] = "End date cannot precede start date."
        if self.fiscal_year_id and (
            self.start_date < self.fiscal_year.start_date
            or self.end_date > self.fiscal_year.end_date
        ):
            errors["start_date"] = "Period must fall within its fiscal year."
        overlap = AccountingPeriod.objects.filter(
            fiscal_year_id=self.fiscal_year_id,
            start_date__lte=self.end_date,
            end_date__gte=self.start_date,
        )
        if self.pk:
            overlap = overlap.exclude(pk=self.pk)
        if overlap.exists():
            errors["start_date"] = "Accounting periods cannot overlap."
        if self.closed_by_id and not self.closed_by.memberships.filter(
            institution_id=self.institution_id, status="ACTIVE"
        ).exists():
            errors["closed_by"] = "Closer must be an active institution member."
        if errors:
            raise ValidationError(errors)


class JournalEntry(TenantOwnedModel):
    class Source(models.TextChoices):
        MANUAL = "MANUAL", "Manual"
        PAYROLL = "PAYROLL", "Payroll"
        AP = "AP", "Accounts payable"
        AR = "AR", "Accounts receivable"
        EXPENSE = "EXPENSE", "Expense"
        CASH = "CASH", "Cash"
        SYSTEM = "SYSTEM", "System"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING_APPROVAL = "PENDING_APPROVAL", "Pending approval"
        APPROVED = "APPROVED", "Approved"
        POSTED = "POSTED", "Posted"
        REVERSED = "REVERSED", "Reversed"
        VOID = "VOID", "Void"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="journal_entries"
    )
    journal_number = models.CharField(max_length=50)
    accounting_period = models.ForeignKey(
        AccountingPeriod, on_delete=models.PROTECT, related_name="journal_entries"
    )
    entry_date = models.DateField()
    description = models.TextField()
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)
    reference = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="journals_created"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="journals_approved",
    )
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="journals_posted",
    )
    posted_at = models.DateTimeField(null=True, blank=True)
    reversal_of = models.ForeignKey(
        "self", on_delete=models.PROTECT, null=True, blank=True, related_name="reversals"
    )

    class Meta:
        ordering = ("-entry_date", "-journal_number")
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "journal_number"),
                name="uniq_journal_number_per_institution",
            ),
            models.UniqueConstraint(
                fields=("reversal_of",),
                condition=models.Q(reversal_of__isnull=False),
                name="uniq_reversal_per_journal",
            ),
        ]
        indexes = [models.Index(fields=("institution", "status", "entry_date"))]

    def clean(self):
        errors = {}
        if self.accounting_period_id:
            if self.accounting_period.institution_id != self.institution_id:
                errors["accounting_period"] = "Period belongs to another institution."
            elif not (
                self.accounting_period.start_date
                <= self.entry_date
                <= self.accounting_period.end_date
            ):
                errors["entry_date"] = "Entry date must fall within the accounting period."
        if self.reversal_of_id and self.reversal_of.institution_id != self.institution_id:
            errors["reversal_of"] = "Reversed journal belongs to another institution."
        for field in ("created_by", "approved_by", "posted_by"):
            user = getattr(self, field, None)
            if user and not user.memberships.filter(
                institution_id=self.institution_id, status="ACTIVE"
            ).exists():
                errors[field] = "User must be an active institution member."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.pk and JournalEntry.objects.filter(
            pk=self.pk, status__in=(self.Status.POSTED, self.Status.REVERSED)
        ).exists():
            raise ValidationError({"status": "Posted journals are immutable."})
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status in (self.Status.POSTED, self.Status.REVERSED):
            raise ValidationError({"status": "Posted journals cannot be deleted."})
        return super().delete(*args, **kwargs)


class JournalLine(BaseModel):
    journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.CASCADE, related_name="lines"
    )
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="journal_lines")
    description = models.TextField(blank=True)
    debit = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    credit = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    department = models.ForeignKey(
        Department, on_delete=models.PROTECT, null=True, blank=True, related_name="journal_lines"
    )
    location = models.ForeignKey(
        Location, on_delete=models.PROTECT, null=True, blank=True, related_name="journal_lines"
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.PROTECT, null=True, blank=True, related_name="journal_lines"
    )
    cost_centre = models.CharField(max_length=100, null=True, blank=True)
    project = models.CharField(max_length=100, null=True, blank=True)
    fund = models.CharField(max_length=100, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(debit__gt=0, credit=0)
                    | models.Q(credit__gt=0, debit=0)
                ),
                name="journal_line_exactly_one_side_positive",
            )
        ]
        indexes = [models.Index(fields=("account", "created_at"))]

    @property
    def institution_id(self):
        return self.journal_entry.institution_id

    def clean(self):
        errors = {}
        if (self.debit > 0) == (self.credit > 0):
            errors["debit"] = "Exactly one of debit or credit must be positive."
        if self.debit < 0 or self.credit < 0:
            errors["debit"] = "Debit and credit cannot be negative."
        institution_id = self.journal_entry.institution_id
        relations = {
            "account": self.account if self.account_id else None,
            "department": self.department if self.department_id else None,
            "location": self.location if self.location_id else None,
            "employee": self.employee if self.employee_id else None,
        }
        for field, relation in relations.items():
            if relation and relation.institution_id != institution_id:
                errors[field] = "Referenced record belongs to another institution."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.journal_entry.status in (
            JournalEntry.Status.POSTED,
            JournalEntry.Status.REVERSED,
        ):
            raise ValidationError({"journal_entry": "Posted journal lines are immutable."})
        self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.journal_entry.status in (
            JournalEntry.Status.POSTED,
            JournalEntry.Status.REVERSED,
        ):
            raise ValidationError({"journal_entry": "Posted journal lines are immutable."})
        return super().delete(*args, **kwargs)


class Vendor(TenantOwnedModel):
    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="vendors"
    )
    name = models.CharField(max_length=150)
    vendor_code = models.CharField(max_length=50)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    country_code = models.CharField(max_length=2, blank=True)
    tax_identification_number = models.CharField(max_length=80, blank=True)
    tax_residency = models.CharField(max_length=30, blank=True)
    taxpayer_type = models.CharField(max_length=50, blank=True)
    vat_registered = models.BooleanField(default=False)
    withholding_category = models.CharField(max_length=80, blank=True)
    statutory_profile_metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("vendor_code",)
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "vendor_code"),
                name="uniq_vendor_code_per_institution",
            )
        ]
        indexes = [models.Index(fields=("institution", "is_active", "name"))]

    def clean(self):
        self.vendor_code = self.vendor_code.strip().upper()
        self.country_code = self.country_code.strip().upper()
        self.tax_residency = self.tax_residency.strip().upper()
        self.taxpayer_type = self.taxpayer_type.strip().upper()
        self.withholding_category = self.withholding_category.strip().upper()
        if self.country_code and (len(self.country_code) != 2 or not self.country_code.isalpha()):
            raise ValidationError({"country_code": "Use a two-letter ISO country code."})


class VendorBill(TenantOwnedModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING = "PENDING", "Pending approval"
        APPROVED = "APPROVED", "Approved"
        POSTED = "POSTED", "Posted"
        PART_PAID = "PART_PAID", "Part paid"
        PAID = "PAID", "Paid"
        VOID = "VOID", "Void"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="vendor_bills"
    )
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="bills")
    bill_number = models.CharField(max_length=80)
    bill_date = models.DateField()
    due_date = models.DateField()
    currency = models.CharField(max_length=3)
    subtotal = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    tax_total = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    withholding_total = models.DecimalField(
        max_digits=20, decimal_places=2, default=Decimal("0")
    )
    total_amount = models.DecimalField(
        max_digits=20, decimal_places=2, default=Decimal("0")
    )
    amount_payable = models.DecimalField(
        max_digits=20, decimal_places=2, default=Decimal("0")
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    accounting_period = models.ForeignKey(
        AccountingPeriod, on_delete=models.PROTECT, related_name="vendor_bills"
    )
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="vendor_bills",
    )

    class Meta:
        ordering = ("-bill_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "vendor", "bill_number"),
                name="uniq_vendor_bill_number_per_vendor",
            ),
            models.CheckConstraint(
                condition=Q(due_date__gte=models.F("bill_date")),
                name="vendor_bill_due_date_valid",
            ),
            models.CheckConstraint(
                condition=(
                    Q(subtotal__gte=0)
                    & Q(tax_total__gte=0)
                    & Q(withholding_total__gte=0)
                    & Q(total_amount__gte=0)
                    & Q(amount_payable__gte=0)
                ),
                name="vendor_bill_amounts_non_negative",
            ),
        ]
        indexes = [models.Index(fields=("institution", "status", "bill_date"))]

    def clean(self):
        self.bill_number = self.bill_number.strip().upper()
        self.currency = self.currency.strip().upper()
        errors = {}
        if len(self.currency) != 3 or not self.currency.isalpha():
            errors["currency"] = "Use a three-letter ISO currency code."
        if self.due_date < self.bill_date:
            errors["due_date"] = "Due date cannot precede bill date."
        if self.vendor_id and self.vendor.institution_id != self.institution_id:
            errors["vendor"] = "Vendor belongs to another institution."
        if self.accounting_period_id:
            if self.accounting_period.institution_id != self.institution_id:
                errors["accounting_period"] = "Period belongs to another institution."
            elif not (
                self.accounting_period.start_date
                <= self.bill_date
                <= self.accounting_period.end_date
            ):
                errors["bill_date"] = "Bill date must fall within the accounting period."
        if self.journal_entry_id:
            if self.journal_entry.institution_id != self.institution_id:
                errors["journal_entry"] = "Journal belongs to another institution."
            elif self.journal_entry.source != JournalEntry.Source.AP:
                errors["journal_entry"] = "Vendor bill journal must use the AP source."
        if any(
            value < 0
            for value in (
                self.subtotal,
                self.tax_total,
                self.withholding_total,
                self.total_amount,
                self.amount_payable,
            )
        ):
            errors["subtotal"] = "Bill amounts cannot be negative."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.pk and VendorBill.objects.filter(
            pk=self.pk, status__in=(self.Status.POSTED, self.Status.PAID)
        ).exists():
            raise ValidationError({"status": "Posted or paid bills are immutable."})
        super().save(*args, **kwargs)


class VendorBillLine(BaseModel):
    vendor_bill = models.ForeignKey(
        VendorBill, on_delete=models.CASCADE, related_name="lines"
    )
    description = models.TextField()
    expense_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="vendor_bill_lines"
    )
    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    tax_code = models.ForeignKey(
        TaxCode,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="vendor_bill_lines",
    )
    withholding_rule = models.ForeignKey(
        WithholdingRule,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="vendor_bill_lines",
    )
    line_total = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gt=0) & Q(unit_price__gte=0) & Q(line_total__gte=0),
                name="vendor_bill_line_amounts_valid",
            )
        ]

    @property
    def institution_id(self):
        return self.vendor_bill.institution_id

    def clean(self):
        errors = {}
        bill = self.vendor_bill
        if self.expense_account_id:
            if self.expense_account.institution_id != bill.institution_id:
                errors["expense_account"] = "Expense account belongs to another institution."
            elif self.expense_account.account_type != Account.AccountType.EXPENSE:
                errors["expense_account"] = "Expense account must be an expense account."
        configuration = getattr(bill.institution, "accounting_configuration", None)
        preset_version_id = getattr(configuration, "selected_accounting_preset_version_id", None)
        for field, record in (
            ("tax_code", self.tax_code if self.tax_code_id else None),
            ("withholding_rule", self.withholding_rule if self.withholding_rule_id else None),
        ):
            if record is None:
                continue
            if not preset_version_id or record.preset_version_id != preset_version_id:
                errors[field] = "Tax configuration must match the selected accounting preset."
            elif record.effective_from > bill.bill_date or (
                record.effective_to and record.effective_to < bill.bill_date
            ):
                errors[field] = "Tax configuration is not effective on the bill date."
            elif field == "tax_code" and not record.is_active:
                errors[field] = "Tax code is inactive."
        if self.quantity <= 0:
            errors["quantity"] = "Quantity must be positive."
        if self.unit_price < 0 or self.line_total < 0:
            errors["unit_price"] = "Line amounts cannot be negative."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.vendor_bill.status != VendorBill.Status.DRAFT:
            raise ValidationError({"vendor_bill": "Only draft bill lines can be edited."})
        self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.vendor_bill.status != VendorBill.Status.DRAFT:
            raise ValidationError({"vendor_bill": "Only draft bill lines can be edited."})
        return super().delete(*args, **kwargs)


class Customer(TenantOwnedModel):
    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="customers"
    )
    name = models.CharField(max_length=150)
    customer_code = models.CharField(max_length=50)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    country_code = models.CharField(max_length=2, blank=True)
    tax_identification_number = models.CharField(max_length=80, blank=True)
    tax_residency = models.CharField(max_length=30, blank=True)
    taxpayer_type = models.CharField(max_length=50, blank=True)
    vat_registered = models.BooleanField(default=False)
    withholding_category = models.CharField(max_length=80, blank=True)
    statutory_profile_metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("customer_code",)
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "customer_code"),
                name="uniq_customer_code_per_institution",
            )
        ]

    def clean(self):
        self.customer_code = self.customer_code.strip().upper()
        self.country_code = self.country_code.strip().upper()
        self.tax_residency = self.tax_residency.strip().upper()
        self.taxpayer_type = self.taxpayer_type.strip().upper()
        self.withholding_category = self.withholding_category.strip().upper()
        if self.country_code and (len(self.country_code) != 2 or not self.country_code.isalpha()):
            raise ValidationError({"country_code": "Use a two-letter ISO country code."})


class Invoice(TenantOwnedModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ISSUED = "ISSUED", "Issued"
        PART_PAID = "PART_PAID", "Part paid"
        PAID = "PAID", "Paid"
        VOID = "VOID", "Void"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="invoices"
    )
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="invoices")
    invoice_number = models.CharField(max_length=80)
    invoice_date = models.DateField()
    due_date = models.DateField()
    currency = models.CharField(max_length=3)
    subtotal = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    tax_total = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    accounting_period = models.ForeignKey(
        AccountingPeriod, on_delete=models.PROTECT, related_name="invoices"
    )
    journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.PROTECT, null=True, blank=True, related_name="invoices"
    )
    external_tax_reference = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ("-invoice_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "invoice_number"), name="uniq_invoice_number_per_institution"
            ),
            models.CheckConstraint(
                condition=Q(due_date__gte=models.F("invoice_date")), name="invoice_due_date_valid"
            ),
            models.CheckConstraint(
                condition=Q(subtotal__gte=0) & Q(tax_total__gte=0) & Q(total_amount__gte=0),
                name="invoice_amounts_non_negative",
            ),
        ]

    def clean(self):
        self.invoice_number = self.invoice_number.strip().upper()
        self.currency = self.currency.strip().upper()
        errors = {}
        if len(self.currency) != 3 or not self.currency.isalpha():
            errors["currency"] = "Use a three-letter ISO currency code."
        if self.due_date < self.invoice_date:
            errors["due_date"] = "Due date cannot precede invoice date."
        if self.customer_id and self.customer.institution_id != self.institution_id:
            errors["customer"] = "Customer belongs to another institution."
        if self.accounting_period_id and self.accounting_period.institution_id != self.institution_id:
            errors["accounting_period"] = "Period belongs to another institution."
        if self.journal_entry_id:
            if self.journal_entry.institution_id != self.institution_id:
                errors["journal_entry"] = "Journal belongs to another institution."
            elif self.journal_entry.source != JournalEntry.Source.AR:
                errors["journal_entry"] = "Invoice journal must use the AR source."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.pk and Invoice.objects.filter(
            pk=self.pk, status__in=(self.Status.ISSUED, self.Status.PART_PAID, self.Status.PAID)
        ).exists():
            raise ValidationError({"status": "Issued or settled invoices are immutable."})
        super().save(*args, **kwargs)


class InvoiceLine(BaseModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    description = models.TextField()
    income_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="invoice_lines"
    )
    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    unit_price = models.DecimalField(max_digits=20, decimal_places=4)
    tax_code = models.ForeignKey(
        TaxCode, on_delete=models.PROTECT, null=True, blank=True, related_name="invoice_lines"
    )
    line_total = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gt=0) & Q(unit_price__gte=0) & Q(line_total__gte=0),
                name="invoice_line_amounts_valid",
            )
        ]

    def clean(self):
        errors = {}
        if self.income_account_id:
            if self.income_account.institution_id != self.invoice.institution_id:
                errors["income_account"] = "Income account belongs to another institution."
            elif self.income_account.account_type != Account.AccountType.INCOME:
                errors["income_account"] = "Income account must be an income account."
        if self.tax_code_id:
            configuration = getattr(self.invoice.institution, "accounting_configuration", None)
            if not getattr(configuration, "selected_accounting_preset_version_id", None) or (
                self.tax_code.preset_version_id != configuration.selected_accounting_preset_version_id
            ):
                errors["tax_code"] = "Tax code must match the selected accounting preset."
            elif not self.tax_code.is_active or self.tax_code.effective_from > self.invoice.invoice_date or (
                self.tax_code.effective_to and self.tax_code.effective_to < self.invoice.invoice_date
            ):
                errors["tax_code"] = "Tax code is not effective on the invoice date."
        if self.quantity <= 0 or self.unit_price < 0 or self.line_total < 0:
            errors["quantity"] = "Invoice line amounts must be non-negative and quantity positive."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.invoice.status != Invoice.Status.DRAFT:
            raise ValidationError({"invoice": "Only draft invoice lines can be edited."})
        self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.invoice.status != Invoice.Status.DRAFT:
            raise ValidationError({"invoice": "Only draft invoice lines can be edited."})
        return super().delete(*args, **kwargs)


class BankAccount(TenantOwnedModel):
    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="bank_accounts"
    )
    name = models.CharField(max_length=150)
    bank_name = models.CharField(max_length=150)
    masked_account_number = models.CharField(max_length=80)
    currency = models.CharField(max_length=3)
    ledger_account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="bank_accounts"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "name"), name="uniq_bank_account_name_per_institution"
            ),
            models.UniqueConstraint(
                fields=("institution", "ledger_account"),
                name="uniq_bank_ledger_account_per_institution",
            ),
        ]
        indexes = [models.Index(fields=("institution", "is_active", "name"))]

    def clean(self):
        self.currency = self.currency.strip().upper()
        errors = {}
        if len(self.currency) != 3 or not self.currency.isalpha():
            errors["currency"] = "Use a three-letter ISO currency code."
        if not self.masked_account_number.strip():
            errors["masked_account_number"] = "A masked account identifier is required."
        if self.ledger_account_id:
            if self.ledger_account.institution_id != self.institution_id:
                errors["ledger_account"] = "Ledger account belongs to another institution."
            elif self.ledger_account.account_type != Account.AccountType.ASSET:
                errors["ledger_account"] = "Bank ledger account must be an asset account."
            elif not self.ledger_account.is_active or not self.ledger_account.is_postable:
                errors["ledger_account"] = "Bank ledger account must be active and postable."
        if errors:
            raise ValidationError(errors)


class Payment(TenantOwnedModel):
    class Status(models.TextChoices):
        POSTED = "POSTED", "Posted"
        VOID = "VOID", "Void"

    class Method(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK_TRANSFER = "BANK_TRANSFER", "Bank transfer"
        CHEQUE = "CHEQUE", "Cheque"
        CARD = "CARD", "Card"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile money"
        OTHER = "OTHER", "Other"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="payments"
    )
    payment_number = models.CharField(max_length=80)
    payment_date = models.DateField()
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    currency = models.CharField(max_length=3)
    payment_method = models.CharField(max_length=16, choices=Method.choices)
    bank_account = models.ForeignKey(
        BankAccount,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="payments",
    )
    vendor_bill = models.ForeignKey(
        VendorBill,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="payments",
    )
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="payments",
    )
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.POSTED)

    class Meta:
        ordering = ("-payment_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "payment_number"),
                name="uniq_payment_number_per_institution",
            ),
            models.CheckConstraint(condition=Q(amount__gt=0), name="payment_amount_positive"),
        ]
        indexes = [models.Index(fields=("institution", "status", "payment_date"))]

    def clean(self):
        self.payment_number = self.payment_number.strip().upper()
        self.currency = self.currency.strip().upper()
        errors = {}
        if len(self.currency) != 3 or not self.currency.isalpha():
            errors["currency"] = "Use a three-letter ISO currency code."
        if self.amount is None or self.amount <= 0:
            errors["amount"] = "Payment amount must be positive."
        if self.bank_account_id:
            if self.bank_account.institution_id != self.institution_id:
                errors["bank_account"] = "Bank account belongs to another institution."
            elif not self.bank_account.is_active:
                errors["bank_account"] = "Bank account is inactive."
            elif self.bank_account.currency != self.currency:
                errors["currency"] = "Payment currency must match the bank account."
        elif self.payment_method != self.Method.CASH:
            errors["bank_account"] = "A bank account is required for non-cash payments."
        if self.vendor_bill_id and self.vendor_bill.institution_id != self.institution_id:
            errors["vendor_bill"] = "Vendor bill belongs to another institution."
        if self.journal_entry_id:
            if self.journal_entry.institution_id != self.institution_id:
                errors["journal_entry"] = "Journal belongs to another institution."
            elif self.journal_entry.source != JournalEntry.Source.CASH:
                errors["journal_entry"] = "Payment journal must use the CASH source."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.pk and Payment.objects.filter(pk=self.pk, status__in=(self.Status.POSTED, self.Status.VOID)).exists():
            raise ValidationError({"status": "Posted or voided payments are immutable."})
        super().save(*args, **kwargs)


class Receipt(TenantOwnedModel):
    class Status(models.TextChoices):
        POSTED = "POSTED", "Posted"
        VOID = "VOID", "Void"

    class Method(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK_TRANSFER = "BANK_TRANSFER", "Bank transfer"
        CHEQUE = "CHEQUE", "Cheque"
        CARD = "CARD", "Card"
        MOBILE_MONEY = "MOBILE_MONEY", "Mobile money"
        OTHER = "OTHER", "Other"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="receipts"
    )
    receipt_number = models.CharField(max_length=80)
    receipt_date = models.DateField()
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    currency = models.CharField(max_length=3)
    payment_method = models.CharField(max_length=16, choices=Method.choices)
    bank_account = models.ForeignKey(
        BankAccount,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="receipts",
    )
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="receipts",
    )
    journal_entry = models.ForeignKey(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="receipts",
    )
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.POSTED)

    class Meta:
        ordering = ("-receipt_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "receipt_number"),
                name="uniq_receipt_number_per_institution",
            ),
            models.CheckConstraint(condition=Q(amount__gt=0), name="receipt_amount_positive"),
        ]
        indexes = [models.Index(fields=("institution", "status", "receipt_date"))]

    def clean(self):
        self.receipt_number = self.receipt_number.strip().upper()
        self.currency = self.currency.strip().upper()
        errors = {}
        if len(self.currency) != 3 or not self.currency.isalpha():
            errors["currency"] = "Use a three-letter ISO currency code."
        if self.amount is None or self.amount <= 0:
            errors["amount"] = "Receipt amount must be positive."
        if self.bank_account_id:
            if self.bank_account.institution_id != self.institution_id:
                errors["bank_account"] = "Bank account belongs to another institution."
            elif not self.bank_account.is_active:
                errors["bank_account"] = "Bank account is inactive."
            elif self.bank_account.currency != self.currency:
                errors["currency"] = "Receipt currency must match the bank account."
        elif self.payment_method != self.Method.CASH:
            errors["bank_account"] = "A bank account is required for non-cash receipts."
        if self.invoice_id and self.invoice.institution_id != self.institution_id:
            errors["invoice"] = "Invoice belongs to another institution."
        if self.journal_entry_id:
            if self.journal_entry.institution_id != self.institution_id:
                errors["journal_entry"] = "Journal belongs to another institution."
            elif self.journal_entry.source != JournalEntry.Source.CASH:
                errors["journal_entry"] = "Receipt journal must use the CASH source."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.pk and Receipt.objects.filter(pk=self.pk, status__in=(self.Status.POSTED, self.Status.VOID)).exists():
            raise ValidationError({"status": "Posted or voided receipts are immutable."})
        super().save(*args, **kwargs)


class BankStatementLine(TenantOwnedModel):
    """An imported bank movement reconciled to one posted cash journal."""

    class Status(models.TextChoices):
        UNMATCHED = "UNMATCHED", "Unmatched"
        MATCHED = "MATCHED", "Matched"
        EXCEPTION = "EXCEPTION", "Exception"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="bank_statement_lines"
    )
    bank_account = models.ForeignKey(
        BankAccount, on_delete=models.PROTECT, related_name="statement_lines"
    )
    statement_date = models.DateField()
    external_id = models.CharField(max_length=120)
    reference = models.CharField(max_length=150, blank=True)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    currency = models.CharField(max_length=3)
    journal_entry = models.OneToOneField(
        JournalEntry,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="bank_statement_match",
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.UNMATCHED
    )
    reconciled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="bank_statement_lines_reconciled",
    )
    reconciled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-statement_date", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("bank_account", "external_id"),
                name="uniq_bank_statement_external_id",
            ),
            models.CheckConstraint(
                condition=Q(amount__gt=0) | Q(amount__lt=0),
                name="bank_statement_amount_nonzero",
            ),
        ]
        indexes = [
            models.Index(fields=("institution", "status", "statement_date")),
            models.Index(fields=("bank_account", "statement_date")),
        ]

    def clean(self):
        self.external_id = self.external_id.strip().upper()
        self.currency = self.currency.strip().upper()
        errors = {}
        if not self.external_id:
            errors["external_id"] = "A bank-supplied external identifier is required."
        if len(self.currency) != 3 or not self.currency.isalpha():
            errors["currency"] = "Use a three-letter ISO currency code."
        if self.bank_account_id:
            if self.bank_account.institution_id != self.institution_id:
                errors["bank_account"] = "Bank account belongs to another institution."
            elif self.bank_account.currency != self.currency:
                errors["currency"] = "Statement currency must match the bank account."
        if self.journal_entry_id:
            if self.journal_entry.institution_id != self.institution_id:
                errors["journal_entry"] = "Journal belongs to another institution."
            elif self.journal_entry.status != JournalEntry.Status.POSTED:
                errors["journal_entry"] = "Only posted journals can be reconciled."
        if self.status == self.Status.MATCHED and not self.journal_entry_id:
            errors["journal_entry"] = "A matched statement line requires a journal."
        if self.status != self.Status.MATCHED and self.journal_entry_id:
            errors["status"] = "Only matched statement lines can carry a journal."
        if self.reconciled_by_id and not self.reconciled_by.memberships.filter(
            institution_id=self.institution_id, status="ACTIVE"
        ).exists():
            errors["reconciled_by"] = "Reconciler must be an active institution member."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)


class VATWithholdingCertificate(TenantOwnedModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ISSUED = "ISSUED", "Issued"
        VOID = "VOID", "Void"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="vat_withholding_certificates")
    vendor_bill = models.ForeignKey(VendorBill, on_delete=models.PROTECT, related_name="vat_withholding_certificates")
    withholding_rule = models.ForeignKey(WithholdingRule, on_delete=models.PROTECT, related_name="vat_withholding_certificates")
    certificate_number = models.CharField(max_length=100)
    certificate_date = models.DateField()
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.DRAFT)
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="vat_withholding_certificates_issued")
    issued_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="vat_withholding_certificates_voided")
    voided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("institution", "certificate_number"), name="uniq_vat_withholding_certificate_number"),
        ]

    def clean(self):
        self.certificate_number = self.certificate_number.strip().upper()
        errors = {}
        if self.amount is None or self.amount <= 0:
            errors["amount"] = "Certificate amount must be positive."
        if self.vendor_bill_id and self.vendor_bill.institution_id != self.institution_id:
            errors["vendor_bill"] = "Vendor bill belongs to another institution."
        if self.withholding_rule_id:
            if self.withholding_rule.preset_version_id != getattr(getattr(self.institution, "accounting_configuration", None), "selected_accounting_preset_version_id", None):
                errors["withholding_rule"] = "Withholding rule must match the selected accounting preset."
            elif not self.withholding_rule.is_vat_withholding_rule:
                errors["withholding_rule"] = "Certificate requires a VAT withholding rule."
        if errors:
            raise ValidationError(errors)


class GhanaComplianceReminder(TenantOwnedModel):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        COMPLETED = "COMPLETED", "Completed"
        WAIVED = "WAIVED", "Waived"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="ghana_compliance_reminders")
    code = models.CharField(max_length=80)
    title = models.CharField(max_length=200)
    authority = models.CharField(max_length=150, default="Ghana Revenue Authority")
    due_date = models.DateField()
    statutory_reference = models.URLField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="ghana_compliance_reminders_completed")
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("institution", "code", "due_date"), name="uniq_ghana_compliance_reminder")]
        ordering = ("due_date", "code")


class Expense(TenantOwnedModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        POSTED = "POSTED", "Posted"
        REJECTED = "REJECTED", "Rejected"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="expenses")
    expense_date = models.DateField()
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="expenses")
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    currency = models.CharField(max_length=3)
    description = models.TextField()
    attachment = models.ForeignKey(Document, on_delete=models.PROTECT, null=True, blank=True, related_name="expenses")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="expenses_created")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="expenses_approved")
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.PROTECT, null=True, blank=True, related_name="expenses")

    class Meta:
        ordering = ("-expense_date", "-created_at")
        constraints = [models.CheckConstraint(condition=Q(amount__gt=0), name="expense_amount_positive")]
        indexes = [models.Index(fields=("institution", "status", "expense_date"))]

    def clean(self):
        self.currency = self.currency.strip().upper()
        errors = {}
        if len(self.currency) != 3 or not self.currency.isalpha():
            errors["currency"] = "Use a three-letter ISO currency code."
        if self.account_id:
            if self.account.institution_id != self.institution_id:
                errors["account"] = "Expense account belongs to another institution."
            elif self.account.account_type != Account.AccountType.EXPENSE:
                errors["account"] = "Account must be an expense account."
        if self.attachment_id and self.attachment.institution_id != self.institution_id:
            errors["attachment"] = "Attachment belongs to another institution."
        for field in ("created_by", "approved_by"):
            user = getattr(self, field, None)
            if user and not user.memberships.filter(institution_id=self.institution_id, status="ACTIVE").exists():
                errors[field] = "User must be an active institution member."
        if self.journal_entry_id:
            if self.journal_entry.institution_id != self.institution_id:
                errors["journal_entry"] = "Journal belongs to another institution."
            elif self.journal_entry.source != JournalEntry.Source.EXPENSE:
                errors["journal_entry"] = "Expense journal must use the EXPENSE source."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.pk and Expense.objects.filter(pk=self.pk, status__in=(self.Status.POSTED, self.Status.REJECTED)).exists():
            raise ValidationError({"status": "Posted or rejected expenses are immutable."})
        super().save(*args, **kwargs)
