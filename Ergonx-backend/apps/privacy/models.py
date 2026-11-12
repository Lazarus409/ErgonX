"""Privacy controls (Data Protection Act, 2012): retention, legal holds and data subject requests."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.institutions.models import Institution
from common.models import TenantOwnedModel


class RetentionRule(TenantOwnedModel):
    """How long a category of personal data is kept once it is no longer needed."""

    class Category(models.TextChoices):
        CANDIDATES = "CANDIDATES", "Unsuccessful and withdrawn candidates"
        FORMER_EMPLOYEES = "FORMER_EMPLOYEES", "Former employees' personal contact details"
        ATTENDANCE = "ATTENDANCE", "Attendance records"
        AUDIT = "AUDIT", "Audit trail"

    class Action(models.TextChoices):
        ANONYMISE = "ANONYMISE", "Anonymise when due"
        REVIEW = "REVIEW", "List for review only"

    # What each category may do when due; payroll and tax records are never touched.
    ALLOWED_ACTIONS = {
        Category.CANDIDATES: (Action.ANONYMISE, Action.REVIEW),
        Category.FORMER_EMPLOYEES: (Action.ANONYMISE, Action.REVIEW),
        Category.ATTENDANCE: (Action.REVIEW,),
        Category.AUDIT: (Action.REVIEW,),
    }

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="retention_rules")
    category = models.CharField(max_length=20, choices=Category.choices)
    keep_months = models.PositiveSmallIntegerField()
    action = models.CharField(max_length=10, choices=Action.choices, default=Action.REVIEW)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, max_length=1000)
    last_run_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("category",)
        constraints = [models.UniqueConstraint(fields=("institution", "category"), name="uniq_retention_rule_category")]

    def clean(self):
        if not 1 <= self.keep_months <= 1200:
            raise ValidationError({"keep_months": "Use between 1 and 1200 months."})
        if self.action not in self.ALLOWED_ACTIONS.get(self.category, ()):
            raise ValidationError({"action": "This category can only be listed for review."})


class LegalHold(TenantOwnedModel):
    """Stops retention clean-up for the people it names, e.g. during a dispute or investigation."""

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="legal_holds")
    title = models.CharField(max_length=150)
    reason = models.TextField(max_length=2000)
    employees = models.ManyToManyField("employees.Employee", blank=True, related_name="legal_holds")
    candidates = models.ManyToManyField("recruitment.Candidate", blank=True, related_name="legal_holds")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    released_at = models.DateTimeField(null=True, blank=True)
    released_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        ordering = ("-created_at",)


class DataSubjectRequest(TenantOwnedModel):
    """A person exercising their data protection rights."""

    class Type(models.TextChoices):
        ACCESS = "ACCESS", "Copy of my data"
        RECTIFICATION = "RECTIFICATION", "Correct my data"
        ERASURE = "ERASURE", "Erase my data"
        OBJECTION = "OBJECTION", "Object to processing"

    class Status(models.TextChoices):
        RECEIVED = "RECEIVED", "Received"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        REJECTED = "REJECTED", "Refused"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="data_subject_requests")
    request_type = models.CharField(max_length=14, choices=Type.choices)
    employee = models.ForeignKey("employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="data_subject_requests")
    candidate = models.ForeignKey("recruitment.Candidate", on_delete=models.SET_NULL, null=True, blank=True, related_name="data_subject_requests")
    requester_name = models.CharField(max_length=200)
    requester_email = models.EmailField(blank=True)
    details = models.TextField(blank=True, max_length=4000)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.RECEIVED)
    received_at = models.DateTimeField()
    due_on = models.DateField()
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    handled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    outcome = models.TextField(blank=True, max_length=4000)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-received_at",)
        indexes = [models.Index(fields=("institution", "status"))]

    def clean(self):
        for name in ("employee", "candidate"):
            related = getattr(self, name, None)
            if related is not None and related.institution_id != self.institution_id:
                raise ValidationError({name: "Referenced record must belong to the same institution."})


class PrivacyProfile(TenantOwnedModel):
    """The organisation's standing as a data controller: Data Protection Commission registration and its officer."""

    institution = models.OneToOneField(Institution, on_delete=models.CASCADE, related_name="privacy_profile")
    registration_number = models.CharField(max_length=60, blank=True)
    registered_on = models.DateField(null=True, blank=True)
    registration_expires_on = models.DateField(null=True, blank=True)
    officer_name = models.CharField(max_length=150, blank=True)
    officer_email = models.EmailField(blank=True)
    officer_phone = models.CharField(max_length=30, blank=True)

    def clean(self):
        if self.registered_on and self.registration_expires_on and self.registration_expires_on <= self.registered_on:
            raise ValidationError({"registration_expires_on": "The expiry date must be after the registration date."})


class DataBreach(TenantOwnedModel):
    """A security compromise of personal data, and who was told about it (Data Protection Act, 2012, s.31)."""

    class Severity(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        CONTAINED = "CONTAINED", "Contained"
        CLOSED = "CLOSED", "Closed"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="data_breaches")
    title = models.CharField(max_length=200)
    description = models.TextField(max_length=4000)
    discovered_at = models.DateTimeField()
    occurred_at = models.DateTimeField(null=True, blank=True)
    severity = models.CharField(max_length=8, choices=Severity.choices, default=Severity.MEDIUM)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    # Keys from common.classification.DATA_CATALOGUE.
    data_categories = models.JSONField(default=list, blank=True)
    people_affected = models.PositiveIntegerField(null=True, blank=True)
    containment = models.TextField(blank=True, max_length=4000)
    contained_at = models.DateTimeField(null=True, blank=True)
    commission_notified_at = models.DateTimeField(null=True, blank=True)
    commission_reference = models.CharField(max_length=100, blank=True)
    subjects_notified_at = models.DateTimeField(null=True, blank=True)
    not_notifying_reason = models.TextField(blank=True, max_length=2000)
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    closed_at = models.DateTimeField(null=True, blank=True)
    lessons_learned = models.TextField(blank=True, max_length=4000)

    class Meta:
        ordering = ("-discovered_at",)
        indexes = [models.Index(fields=("institution", "status"))]

    def clean(self):
        from common.classification import DATA_CATALOGUE

        known = {category.key for category in DATA_CATALOGUE}
        if not isinstance(self.data_categories, list) or any(key not in known for key in self.data_categories):
            raise ValidationError({"data_categories": "Choose kinds of data from the data catalogue."})
        if self.occurred_at and self.discovered_at and self.occurred_at > self.discovered_at:
            raise ValidationError({"occurred_at": "A breach can't be discovered before it happened."})
        for name in ("contained_at", "commission_notified_at", "subjects_notified_at", "closed_at"):
            value = getattr(self, name)
            if value and self.discovered_at and value < self.discovered_at:
                raise ValidationError({name: "This can't be before the breach was discovered."})
