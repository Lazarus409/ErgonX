"""Employee complaints (grievances).

An employee files a complaint about something at work, optionally naming the
colleague it concerns. It is confidential, not anonymous: HR handlers see who
filed it; the person it names never sees it, and neither do managers. A
complaint moves:

    SUBMITTED -> UNDER_REVIEW -> INVESTIGATING -> RESOLVED -> CLOSED

HR can reopen a resolved complaint, and the employee can withdraw an open one.
Notes are internal (HR only) or shared with the employee.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.employees.models import Employee
from apps.institutions.models import Institution
from common.codes import AutoCodeMixin
from common.models import TenantOwnedModel


class Complaint(AutoCodeMixin, TenantOwnedModel):
    auto_code_field = "code"
    auto_code_prefix = "CMP"
    auto_code_width = 4

    class Category(models.TextChoices):
        HARASSMENT = "HARASSMENT", "Harassment (including sexual harassment)"
        BULLYING = "BULLYING", "Bullying or intimidation"
        DISCRIMINATION = "DISCRIMINATION", "Discrimination"
        MISCONDUCT = "MISCONDUCT", "Misconduct or unethical behaviour"
        HEALTH_SAFETY = "HEALTH_SAFETY", "Health and safety"
        PAY_BENEFITS = "PAY_BENEFITS", "Pay, allowances or benefits"
        WORKING_CONDITIONS = "WORKING_CONDITIONS", "Working conditions or hours"
        MANAGEMENT = "MANAGEMENT", "Management or supervision"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        SUBMITTED = "SUBMITTED", "Submitted"
        UNDER_REVIEW = "UNDER_REVIEW", "Under review"
        INVESTIGATING = "INVESTIGATING", "Investigating"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"
        WITHDRAWN = "WITHDRAWN", "Withdrawn"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    OPEN_STATUSES = (Status.SUBMITTED, Status.UNDER_REVIEW, Status.INVESTIGATING)

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="complaints")
    code = models.CharField(max_length=30, blank=True)
    complainant = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="complaints_filed")
    respondent = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="complaints_received", help_text="The colleague the complaint is about, if any.")
    respondent_description = models.CharField(max_length=200, blank=True, help_text="Who the complaint is about when they are not an employee (a contractor, a customer).")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    subject = models.CharField(max_length=200)
    description = models.TextField()
    incident_date = models.DateField(null=True, blank=True)
    incident_location = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.SUBMITTED)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="complaints_assigned")
    resolution = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    closed_at = models.DateTimeField(null=True, blank=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [models.UniqueConstraint(fields=("institution", "code"), name="uniq_complaint_code")]
        indexes = [models.Index(fields=("institution", "status")), models.Index(fields=("assigned_to", "status"))]

    def clean(self):
        self.subject = (self.subject or "").strip()
        self.description = (self.description or "").strip()
        errors = {}
        if not self.subject:
            errors["subject"] = "Give the complaint a short subject."
        if not self.description:
            errors["description"] = "Describe what happened."
        for name in ("complainant", "respondent"):
            related = getattr(self, name, None)
            if related is not None and related.institution_id != self.institution_id:
                errors[name] = "Referenced record must belong to the same institution."
        if self.respondent_id and self.respondent_id == self.complainant_id:
            errors["respondent"] = "You cannot file a complaint about yourself."
        if self.incident_date and self.incident_date > timezone.localdate():
            errors["incident_date"] = "The incident date cannot be in the future."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.code} {self.subject}".strip()


class ComplaintNote(TenantOwnedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="+")
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    body = models.TextField()
    # Internal notes are for HR only; shared notes are part of the conversation with the employee.
    is_internal = models.BooleanField(default=True)

    class Meta:
        ordering = ("created_at",)

    def clean(self):
        self.body = (self.body or "").strip()
        if not self.body:
            raise ValidationError({"body": "Write a note."})
        if self.complaint_id and self.complaint.institution_id != self.institution_id:
            raise ValidationError({"complaint": "Referenced record must belong to the same institution."})


class ComplaintAttachment(TenantOwnedModel):
    """A file attached to a complaint (photos, messages, letters).

    Kept apart from apps.documents on purpose: anyone holding document.view can
    list every Document, so complaint evidence would leak. These files are only
    reachable through the complaint, which applies its own visibility rules.
    """

    MAX_PER_COMPLAINT = 20

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="+")
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="attachments")
    stored_file = models.FileField(upload_to="complaints/%Y/%m/")
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=150, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    # Internal attachments are HR's own evidence; shared ones are visible to the employee too.
    is_internal = models.BooleanField(default=False)

    class Meta:
        ordering = ("created_at",)

    def clean(self):
        if self.complaint_id and self.complaint.institution_id != self.institution_id:
            raise ValidationError({"complaint": "Referenced record must belong to the same institution."})
