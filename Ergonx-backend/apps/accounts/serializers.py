from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from apps.accounts.models import InstitutionAdminInvitation, User


class UserSerializer(serializers.ModelSerializer):
    is_platform_admin = serializers.SerializerMethodField()

    def get_is_platform_admin(self, user):
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
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


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
