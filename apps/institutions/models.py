from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from common.models import BaseModel, TenantOwnedModel


class Institution(BaseModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    country_code = models.CharField(max_length=2, default="GH")
    default_currency = models.CharField(max_length=3, default="GHS")
    timezone = models.CharField(max_length=64, default="Africa/Accra")
    logo = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name",)

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        self.country_code = self.country_code.strip().upper()
        self.default_currency = self.default_currency.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Permission(BaseModel):
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=150)
    module_code = models.CharField(max_length=50, default="CORE_HR")
    description = models.TextField(blank=True)

    class Meta:
        ordering = ("code",)

    def __str__(self):
        return self.code


class Role(TenantOwnedModel):
    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="roles",
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    is_system_role = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    permissions = models.ManyToManyField(Permission, related_name="roles", blank=True)

    class Meta:
        ordering = ("institution", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "code"), name="uniq_role_code_per_institution"
            ),
            models.UniqueConstraint(
                fields=("code",),
                condition=models.Q(institution__isnull=True),
                name="uniq_global_role_code",
            ),
        ]
        indexes = [models.Index(fields=("institution", "is_active"))]

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        scope = self.institution.code if self.institution_id else "GLOBAL"
        return f"{scope}: {self.name}"


class InstitutionMembership(TenantOwnedModel):
    class Status(models.TextChoices):
        INVITED = "INVITED", "Invited"
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"
        INACTIVE = "INACTIVE", "Inactive"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="memberships")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.INVITED)
    is_primary = models.BooleanField(default=False)
    joined_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "institution"), name="uniq_user_institution_membership"
            ),
            models.UniqueConstraint(
                fields=("user",),
                condition=models.Q(is_primary=True, status="ACTIVE"),
                name="uniq_active_primary_membership_per_user",
            ),
        ]
        indexes = [
            models.Index(fields=("institution", "status")),
            models.Index(fields=("user", "status")),
        ]

    def clean(self):
        errors = {}
        if self.role_id and self.institution_id:
            if self.role.institution_id != self.institution_id:
                errors["role"] = "The role must belong to the membership institution."
        if self.ended_at and self.joined_at and self.ended_at < self.joined_at:
            errors["ended_at"] = "End date cannot precede join date."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.user} @ {self.institution}"


class InstitutionModule(TenantOwnedModel):
    class ModuleCode(models.TextChoices):
        CORE_HR = "CORE_HR", "Core HR"
        LEAVE = "LEAVE", "Leave"
        ATTENDANCE = "ATTENDANCE", "Attendance"
        PAYROLL = "PAYROLL", "Payroll"
        ACCOUNTING = "ACCOUNTING", "Accounting"
        RECRUITMENT = "RECRUITMENT", "Recruitment"
        REPORTS = "REPORTS", "Reports"

    class ConfigurationStatus(models.TextChoices):
        NOT_CONFIGURED = "NOT_CONFIGURED", "Not configured"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        READY = "READY", "Ready"
        BLOCKED = "BLOCKED", "Blocked"

    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="modules"
    )
    module_code = models.CharField(max_length=20, choices=ModuleCode.choices)
    is_enabled = models.BooleanField(default=False)
    enabled_at = models.DateTimeField(null=True, blank=True)
    enabled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enabled_institution_modules",
    )
    configuration_status = models.CharField(
        max_length=20,
        choices=ConfigurationStatus.choices,
        default=ConfigurationStatus.NOT_CONFIGURED,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "module_code"),
                name="uniq_module_per_institution",
            )
        ]
        indexes = [models.Index(fields=("institution", "is_enabled"))]

    def clean(self):
        if self.enabled_by_id and self.institution_id:
            if not self.enabled_by.memberships.filter(
                institution_id=self.institution_id
            ).exists():
                raise ValidationError(
                    {"enabled_by": "Enabling user must belong to the same institution."}
                )

    def __str__(self):
        return f"{self.institution.code}: {self.module_code}"


class InstitutionOnboarding(BaseModel):
    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not started"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        BLOCKED = "BLOCKED", "Blocked"
        READY = "READY", "Ready"

    institution = models.OneToOneField(
        Institution, on_delete=models.CASCADE, related_name="onboarding"
    )
    current_step = models.CharField(max_length=100, default="ORGANIZATION_SETUP")
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.NOT_STARTED
    )
    completion_percentage = models.PositiveSmallIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="completed_institution_onboarding",
    )
    validation_summary = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(completion_percentage__lte=100),
                name="onboarding_completion_lte_100",
            )
        ]

    def clean(self):
        if self.completed_by_id and self.institution_id:
            if not self.completed_by.memberships.filter(
                institution_id=self.institution_id
            ).exists():
                raise ValidationError(
                    {"completed_by": "Completing user must belong to the institution."}
                )

    def save(self, *args, **kwargs):
        if not kwargs.get("raw", False):
            self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.institution.code}: {self.status}"


class SystemFeatureFlag(BaseModel):
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    is_enabled = models.BooleanField(default=False)
    rollout_metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("code",)

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.code


class InstitutionFeatureOverride(TenantOwnedModel):
    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="feature_overrides"
    )
    feature_flag = models.ForeignKey(
        SystemFeatureFlag, on_delete=models.PROTECT, related_name="institution_overrides"
    )
    is_enabled = models.BooleanField()
    reason = models.TextField(blank=True)
    set_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feature_overrides_set",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "feature_flag"),
                name="uniq_feature_override_per_institution",
            )
        ]
        indexes = [models.Index(fields=("institution", "is_enabled"))]

    def clean(self):
        if self.set_by_id and self.institution_id:
            if not self.set_by.memberships.filter(
                institution_id=self.institution_id
            ).exists():
                raise ValidationError(
                    {"set_by": "Setting user must belong to the same institution."}
                )


class InstitutionSetting(TenantOwnedModel):
    institution = models.ForeignKey(
        Institution, on_delete=models.CASCADE, related_name="settings"
    )
    key = models.CharField(max_length=150)
    value = models.JSONField(default=dict, blank=True)
    is_sensitive = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="institution_settings_updated",
    )

    class Meta:
        ordering = ("key",)
        constraints = [
            models.UniqueConstraint(
                fields=("institution", "key"), name="uniq_setting_key_per_institution"
            )
        ]

    def clean(self):
        if self.updated_by_id and self.institution_id:
            if not self.updated_by.memberships.filter(
                institution_id=self.institution_id
            ).exists():
                raise ValidationError(
                    {"updated_by": "Updating user must belong to the same institution."}
                )

    def save(self, *args, **kwargs):
        self.key = self.key.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.institution.code}: {self.key}"
