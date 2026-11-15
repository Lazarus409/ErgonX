"""Platform-level security records."""

from django.conf import settings
from django.db import models

from common.models import BaseModel


class RestoreTest(BaseModel):
    """Evidence that a backup was restored and checked. Backups cover the whole platform, so tests are platform records."""

    class Result(models.TextChoices):
        PASSED = "PASSED", "Passed"
        PARTIAL = "PARTIAL", "Passed with issues"
        FAILED = "FAILED", "Failed"

    performed_on = models.DateField()
    backup_reference = models.CharField(max_length=200, help_text="Which backup was restored, e.g. the dump file name or snapshot id.")
    environment = models.CharField(max_length=100, help_text="Where it was restored, e.g. a scratch database.")
    result = models.CharField(max_length=8, choices=Result.choices)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    checks = models.TextField(max_length=4000, help_text="What was verified after restoring.")
    issues = models.TextField(blank=True, max_length=4000)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")

    class Meta:
        ordering = ("-performed_on", "-created_at")


class SecurityIncident(BaseModel):
    """A platform incident (outage, attack, data loss, compromised account), handled by the platform operator.

    Personal data breaches inside one organisation are also recorded in that organisation's
    privacy breach register, which is what the Data Protection Commission cares about.
    """

    class Kind(models.TextChoices):
        OUTAGE = "OUTAGE", "Outage or degraded service"
        ATTACK = "ATTACK", "Attack or intrusion attempt"
        ACCOUNT_COMPROMISE = "ACCOUNT_COMPROMISE", "Compromised account"
        DATA_LOSS = "DATA_LOSS", "Data loss or corruption"
        DATA_EXPOSURE = "DATA_EXPOSURE", "Data exposed to the wrong people"
        VULNERABILITY = "VULNERABILITY", "Vulnerability found"
        OTHER = "OTHER", "Other"

    class Severity(models.TextChoices):
        SEV1 = "SEV1", "Critical: service down or data at risk"
        SEV2 = "SEV2", "Major: important features failing"
        SEV3 = "SEV3", "Minor: limited impact"

    class Status(models.TextChoices):
        DETECTED = "DETECTED", "Detected"
        INVESTIGATING = "INVESTIGATING", "Investigating"
        CONTAINED = "CONTAINED", "Contained"
        RECOVERED = "RECOVERED", "Recovered"
        CLOSED = "CLOSED", "Closed"

    title = models.CharField(max_length=200)
    summary = models.TextField(max_length=4000)
    kind = models.CharField(max_length=20, choices=Kind.choices)
    severity = models.CharField(max_length=4, choices=Severity.choices)
    status = models.CharField(max_length=14, choices=Status.choices, default=Status.DETECTED)
    detected_at = models.DateTimeField()
    contained_at = models.DateTimeField(null=True, blank=True)
    recovered_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    personal_data_affected = models.BooleanField(default=False)
    affected_institutions = models.ManyToManyField("institutions.Institution", blank=True, related_name="security_incidents")
    root_cause = models.TextField(blank=True, max_length=4000)
    lessons_learned = models.TextField(blank=True, max_length=4000)
    lead = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")

    class Meta:
        ordering = ("-detected_at",)


class IncidentUpdate(BaseModel):
    """One entry on an incident's timeline: what was found or done, and any change of status."""

    incident = models.ForeignKey(SecurityIncident, on_delete=models.CASCADE, related_name="updates")
    note = models.TextField(max_length=4000)
    status = models.CharField(max_length=14, choices=SecurityIncident.Status.choices, blank=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")

    class Meta:
        ordering = ("created_at",)
