from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.accounts.managers import UserManager
from common.models import BaseModel


class User(BaseModel, AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    is_platform_admin = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def clean(self):
        super().clean()
        self.email = self.__class__.objects.normalize_email(self.email).lower()

    def save(self, *args, **kwargs):
        self.email = self.__class__.objects.normalize_email(self.email).lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class InstitutionAdminInvitation(BaseModel):
    """A platform-issued invitation to establish a new tenant."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        EXPIRED = "EXPIRED", "Expired"
        REVOKED = "REVOKED", "Revoked"

    email = models.EmailField()
    token_hash = models.CharField(max_length=128, unique=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="institution_admin_invitations",
    )

    class Meta:
        indexes = [models.Index(fields=("email", "status"))]

    def __str__(self):
        return f"Institution Admin invitation for {self.email}"
