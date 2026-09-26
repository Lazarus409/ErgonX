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


class UserMFA(BaseModel):
    """Optional authenticator-app MFA state for one account."""

    class Method(models.TextChoices):
        AUTHENTICATOR_APP = "AUTHENTICATOR_APP", "Authenticator app"
        EMAIL_OTP = "EMAIL_OTP", "Email one-time code"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="mfa")
    secret = models.CharField(max_length=64)
    method = models.CharField(max_length=24, choices=Method.choices, default=Method.AUTHENTICATOR_APP)
    is_enabled = models.BooleanField(default=False)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"MFA for {self.user.email}"


class EmailOTPChallenge(BaseModel):
    """Short-lived, one-time email MFA challenge; only a digest is persisted."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_otp_challenges")
    code_digest = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    sent_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=("user", "expires_at", "consumed_at"))]


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
    # The organization created by accepting this invitation.
    institution = models.ForeignKey(
        "institutions.Institution",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_invitations",
    )

    class Meta:
        indexes = [models.Index(fields=("email", "status"))]

    def __str__(self):
        return f"Institution Admin invitation for {self.email}"


class InstitutionAccessRequest(BaseModel):
    """A public request from an organization asking to be invited onto ErgonX.

    Submitted without an account from the Get Started page and reviewed by a
    platform administrator, who either issues an Institution Admin invitation
    or declines it.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        INVITED = "INVITED", "Invited"
        DECLINED = "DECLINED", "Declined"

    class Size(models.TextChoices):
        UP_TO_50 = "1-50", "1–50 employees"
        UP_TO_200 = "51-200", "51–200 employees"
        UP_TO_1000 = "201-1000", "201–1,000 employees"
        OVER_1000 = "1000+", "More than 1,000 employees"

    institution_name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=150)
    job_title = models.CharField(max_length=120, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True)
    country_code = models.CharField(max_length=2, default="GH")
    organization_size = models.CharField(max_length=10, choices=Size.choices, blank=True)
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_access_requests")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    decline_reason = models.TextField(blank=True)
    invitation = models.OneToOneField(InstitutionAdminInvitation, on_delete=models.SET_NULL, null=True, blank=True, related_name="access_request")

    class Meta:
        indexes = [models.Index(fields=("status", "created_at")), models.Index(fields=("email", "status"))]

    def __str__(self):
        return f"Access request from {self.institution_name} ({self.email})"
