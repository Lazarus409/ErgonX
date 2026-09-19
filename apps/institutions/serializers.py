from rest_framework import serializers

from apps.institutions.models import (
    Institution,
    InstitutionMembership,
    InstitutionModule,
    Role,
    Permission,
    UserPreference,
    InstitutionOnboarding,
    InstitutionOnboardingStep,
    InstitutionSetting,
)


class RoleSummarySerializer(serializers.ModelSerializer):
    permissions = serializers.SlugRelatedField(many=True, read_only=True, slug_field="code")

    class Meta:
        model = Role
        fields = ("id", "code", "name", "is_system_role", "is_custom", "is_active", "permissions")


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ("code", "name", "module_code", "classification", "description")
        read_only_fields = fields


class RoleSerializer(RoleSummarySerializer):
    class Meta(RoleSummarySerializer.Meta):
        model = Role
        fields = (
            "id", "code", "name", "description", "is_system_role", "is_custom",
            "is_active", "permissions", "created_at", "updated_at",
        )
        read_only_fields = ("id", "code", "is_system_role", "is_custom", "created_at", "updated_at")


class CustomRoleCreateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=150)
    description = serializers.CharField(required=False, allow_blank=True)
    permission_codes = serializers.ListField(
        child=serializers.CharField(max_length=100), required=False, default=list
    )


class CloneRoleSerializer(CustomRoleCreateSerializer):
    source_role_id = serializers.UUIDField()


class CustomRoleUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    permission_codes = serializers.ListField(child=serializers.CharField(max_length=100), required=False)
    is_active = serializers.BooleanField(required=False)


class UserPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreference
        fields = ("id", "preference_key", "value_json", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class InstitutionOnboardingStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstitutionOnboardingStep
        fields = ("code", "sequence", "status", "required_module", "blocker_code", "blocker_message", "completed_at", "is_admin_skipped")
        read_only_fields = fields


class InstitutionOnboardingSerializer(serializers.ModelSerializer):
    steps = InstitutionOnboardingStepSerializer(source="institution.onboarding_steps", many=True, read_only=True)

    class Meta:
        model = InstitutionOnboarding
        fields = ("status", "current_step", "completion_percentage", "started_at", "completed_at", "validation_summary", "steps")
        read_only_fields = fields


class InstitutionSerializer(serializers.ModelSerializer):
    country = serializers.CharField(source="country_code", read_only=True)
    currency = serializers.CharField(source="default_currency", read_only=True)

    class Meta:
        model = Institution
        fields = (
            "id",
            "name",
            "code",
            "email",
            "phone",
            "address",
            "country_code",
            "default_currency",
            "country",
            "currency",
            "timezone",
            "logo",
            "is_active",
        )


class InstitutionProfileUpdateSerializer(serializers.ModelSerializer):
    """The editable profile fields needed by institution onboarding."""

    class Meta:
        model = Institution
        fields = (
            "name",
            "email",
            "phone",
            "address",
            "country_code",
            "default_currency",
            "timezone",
            "logo",
        )


class InstitutionModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstitutionModule
        fields = ("id", "module_code", "is_enabled", "configuration_status")
        read_only_fields = ("id", "module_code", "configuration_status")


class InstitutionSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstitutionSetting
        fields = ("id", "key", "value", "is_sensitive", "updated_at")
        read_only_fields = ("id", "is_sensitive", "updated_at")


class MembershipUserSerializer(serializers.Serializer):
    """Safe user identity shown to institution access administrators."""

    id = serializers.UUIDField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)


class MembershipSerializer(serializers.ModelSerializer):
    institution = InstitutionSerializer(read_only=True)
    role = RoleSummarySerializer(read_only=True)
    user = MembershipUserSerializer(read_only=True)

    class Meta:
        model = InstitutionMembership
        fields = (
            "id",
            "institution",
            "user",
            "role",
            "status",
            "is_primary",
            "joined_at",
            "ended_at",
        )


class MembershipUpdateSerializer(serializers.Serializer):
    role_id = serializers.UUIDField(required=False)
    status = serializers.ChoiceField(choices=InstitutionMembership.Status.choices, required=False)
    is_primary = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Provide at least one membership field to update.")
        return attrs


class MembershipInviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role_id = serializers.UUIDField()
    is_primary = serializers.BooleanField(required=False, default=False)


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role_id = serializers.UUIDField()
    expires_in_hours = serializers.IntegerField(required=False, default=168, min_value=1, max_value=720)


class CurrentInstitutionSerializer(serializers.Serializer):
    institution = InstitutionSerializer()
    membership = MembershipSerializer()
    active_capabilities = serializers.ListField(child=serializers.CharField())
