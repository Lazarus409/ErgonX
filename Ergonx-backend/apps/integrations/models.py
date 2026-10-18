"""API keys, webhooks and calendar feeds.

Secrets that ErgonX only needs to recognise (API keys, calendar feed tokens)
are stored as SHA-256 hashes and shown once. A webhook's signing secret must be
readable to sign each delivery, so it is stored as given and never returned
after creation.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.institutions.models import Institution
from common.models import TenantOwnedModel


class ApiKey(TenantOwnedModel):
    class Scope(models.TextChoices):
        ATTENDANCE_PUNCH = "attendance.punch", "Send clock-ins from attendance devices"
        EMPLOYEES_READ = "employees.read", "Read the employee directory"
        LEAVE_READ = "leave.read", "Read approved leave"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=100)
    prefix = models.CharField(max_length=12, db_index=True)
    key_hash = models.CharField(max_length=64, unique=True)
    scopes = models.JSONField(default=list)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    last_used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def clean(self):
        allowed = set(self.Scope.values)
        if not self.scopes or not isinstance(self.scopes, list) or any(scope not in allowed for scope in self.scopes):
            raise ValidationError({"scopes": f"Choose scopes from: {', '.join(sorted(allowed))}."})


class WebhookEndpoint(TenantOwnedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="webhook_endpoints")
    url = models.URLField(max_length=500)
    description = models.CharField(max_length=200, blank=True)
    secret = models.CharField(max_length=100)
    events = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    consecutive_failures = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("-created_at",)


class WebhookDelivery(TenantOwnedModel):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCEEDED = "SUCCEEDED", "Delivered"
        FAILED = "FAILED", "Failed"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="+")
    endpoint = models.ForeignKey(WebhookEndpoint, on_delete=models.CASCADE, related_name="deliveries")
    event = models.CharField(max_length=60)
    payload = models.JSONField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    last_error = models.CharField(max_length=300, blank=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("status", "next_attempt_at"))]


class CalendarFeed(TenantOwnedModel):
    """A private calendar subscription link for one member of one institution."""

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="+")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="calendar_feeds")
    token_hash = models.CharField(max_length=64, unique=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
