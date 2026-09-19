from django.conf import settings
from django.db import models

from apps.institutions.models import Institution
from common.models import TenantOwnedModel


class AuditLog(TenantOwnedModel):
    institution = models.ForeignKey(
        Institution,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events",
    )
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=150, blank=True)
    entity_id = models.UUIDField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("institution", "created_at")),
            models.Index(fields=("institution", "action")),
            models.Index(fields=("entity_type", "entity_id")),
        ]

    def __str__(self):
        return f"{self.action} at {self.created_at}"

    @property
    def timestamp(self):
        """Canonical audit event time; backed by immutable BaseModel.created_at."""
        return self.created_at
