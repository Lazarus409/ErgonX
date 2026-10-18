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
