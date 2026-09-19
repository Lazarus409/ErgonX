from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.institutions.models import Institution
from common.models import TenantOwnedModel


class Document(TenantOwnedModel):
    class Classification(models.TextChoices):
        INTERNAL = "INTERNAL", "Internal"
        CONFIDENTIAL = "CONFIDENTIAL", "Confidential"
        RESTRICTED = "RESTRICTED", "Restricted"

    institution = models.ForeignKey(
        Institution, on_delete=models.PROTECT, related_name="documents"
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_documents",
    )
    file_reference = models.CharField(max_length=500)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=150)
    size_bytes = models.PositiveBigIntegerField()
    category = models.CharField(max_length=100, blank=True)
    classification = models.CharField(
        max_length=20,
        choices=Classification.choices,
        default=Classification.CONFIDENTIAL,
    )
    checksum = models.CharField(max_length=128, blank=True)
    entity_type = models.CharField(max_length=150, blank=True)
    entity_id = models.UUIDField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("institution", "is_active")),
            models.Index(fields=("institution", "category")),
            models.Index(fields=("entity_type", "entity_id")),
        ]

    def clean(self):
        if self.uploaded_by_id and self.institution_id:
            if not self.uploaded_by.memberships.filter(
                institution_id=self.institution_id
            ).exists():
                raise ValidationError(
                    {"uploaded_by": "Uploader must belong to the same institution."}
                )

    def __str__(self):
        return self.original_filename
