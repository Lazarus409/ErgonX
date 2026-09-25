from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import secrets
import base64
import hashlib
import hmac
import struct
import time
from apps.accounts.models import EmailOTPChallenge, InstitutionAdminInvitation, User, UserMFA
from apps.accounts.emails import send_email_mfa_code
from django.utils.crypto import salted_hmac


def _totp(secret: str, timestamp: int | None = None) -> str:
    counter = int((timestamp or time.time()) // 30)
    key = base64.b32decode(secret, casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 1_000_000:06d}"


def verify_totp(secret: str, code: str) -> bool:
    normalized = str(code).strip()
    return bool(normalized) and any(hmac.compare_digest(_totp(secret, int(time.time()) + drift * 30), normalized) for drift in (-1, 0, 1))


class MFARequired(AuthenticationFailed):
    api_code = "mfa_required"


class EmailOTPRequired(AuthenticationFailed):
    api_code = "email_otp_required"


class UserSerializer(serializers.ModelSerializer):
    is_platform_admin = serializers.SerializerMethodField()

    def get_is_platform_admin(self, user) -> bool:
        return bool(user.is_platform_admin or user.is_superuser)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "is_platform_admin",
            "created_at",
        )
        read_only_fields = fields


class AuthBootstrapSerializer(serializers.Serializer):
    user = UserSerializer()
    active_institution = serializers.DictField()
    active_membership = serializers.DictField()
    effective_permissions = serializers.ListField(child=serializers.CharField())
    enabled_modules = serializers.ListField(child=serializers.CharField())
    onboarding_ready = serializers.BooleanField()
    onboarding_status = serializers.CharField()
    default_landing = serializers.CharField()
    available_dashboards = serializers.ListField(child=serializers.CharField())


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    mfa_code = serializers.CharField(required=False, write_only=True, allow_blank=True)
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        mfa = UserMFA.objects.filter(user=self.user, is_enabled=True).first()
        if mfa and mfa.method == UserMFA.Method.EMAIL_OTP:
            code = str(attrs.get("mfa_code", "")).strip()
            if not code:
                if not settings.EMAIL_DELIVERY_ENABLED:
                    raise AuthenticationFailed("Email MFA delivery is not configured.", code="email_otp_unavailable")
                EmailOTPChallenge.objects.filter(user=self.user, consumed_at__isnull=True).update(consumed_at=timezone.now())
                plain_code = f"{secrets.randbelow(1_000_000):06d}"
                expires_at = timezone.now() + timedelta(minutes=5)
                challenge = EmailOTPChallenge.objects.create(
                    user=self.user,
                    code_digest=salted_hmac("ergonx-email-mfa", plain_code).hexdigest(),
                    expires_at=expires_at,
                    sent_at=timezone.now(),
                )
                try:
                    send_email_mfa_code(recipient_email=self.user.email, code=plain_code, expires_at=expires_at)
                except Exception:
                    challenge.delete()
                    raise AuthenticationFailed("Email MFA delivery failed.", code="email_otp_unavailable")
                raise EmailOTPRequired("Enter the verification code sent to your email.")
            challenge = EmailOTPChallenge.objects.filter(user=self.user, consumed_at__isnull=True).order_by("-created_at").first()
            if not challenge or challenge.expires_at <= timezone.now() or challenge.attempts >= 5:
                raise AuthenticationFailed("The email verification code is invalid or expired.", code="email_otp_invalid")
            challenge.attempts += 1
            challenge.save(update_fields=("attempts", "updated_at"))
            if not hmac.compare_digest(challenge.code_digest, salted_hmac("ergonx-email-mfa", code).hexdigest()):
                raise AuthenticationFailed("The email verification code is invalid or expired.", code="email_otp_invalid")
            challenge.consumed_at = timezone.now()
            challenge.save(update_fields=("consumed_at", "updated_at"))
        elif mfa and not verify_totp(mfa.secret, attrs.get("mfa_code", "")):
            raise MFARequired("Enter the six-digit authenticator code to continue.")
        data["user"] = UserSerializer(self.user).data
        return data


class MFASetupSerializer(serializers.Serializer):
    code = serializers.RegexField(regex=r"^\d{6}$", required=False)

    def validate_code(self, value):
        mfa = UserMFA.objects.filter(user=self.context["request"].user).first()
        if not mfa or not verify_totp(mfa.secret, value):
            raise serializers.ValidationError("The authenticator code is invalid or expired.")
        return value


class SelfServiceRegistrationSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    institution_name = serializers.CharField(max_length=255)
    country_code = serializers.CharField(max_length=2, required=False, default="GH")
    default_currency = serializers.CharField(max_length=3, required=False, default="GHS")
    timezone = serializers.CharField(max_length=64, required=False, default="Africa/Accra")

    def validate_email(self, value):
        email = User.objects.normalize_email(value).lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("An account with this email already exists. Sign in instead.")
        return email

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages)) from error
        return value

    def validate_institution_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Institution name is required.")
        return value


class InstitutionAdminInvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    expires_in_hours = serializers.IntegerField(required=False, default=168, min_value=1, max_value=720)

    def validate_email(self, value):
        email = User.objects.normalize_email(value).lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("This email already has an ErgonX account.")
        return email


class InstitutionAdminInvitationSerializer(serializers.ModelSerializer):
    invited_by_email = serializers.EmailField(source="invited_by.email", read_only=True)

    class Meta:
        model = InstitutionAdminInvitation
        fields = ("id", "email", "status", "expires_at", "accepted_at", "invited_by_email", "created_at")
        read_only_fields = fields


class InstitutionAdminInvitationAcceptanceSerializer(SelfServiceRegistrationSerializer):
    """Invitees establish their tenant and the first administrator account."""

    email = serializers.EmailField(read_only=True)


class AccountProfileSerializer(serializers.ModelSerializer):
    """Authenticated account profile; users may update only their own identity."""

    class Meta:
        model = User
        fields = ("email", "first_name", "last_name")

    def validate_email(self, value):
        email = User.objects.normalize_email(value).lower()
        if User.objects.exclude(pk=self.instance.pk).filter(email=email).exists():
            raise serializers.ValidationError("This email address is already in use.")
        return email


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Your current password is incorrect.")
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value, self.context["request"].user)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages)) from error
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return User.objects.normalize_email(value).lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages)) from error
        return value
