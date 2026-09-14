from rest_framework import serializers

from apps.institutions.models import (
    Institution,
    InstitutionMembership,
    InstitutionModule,
    Role,
)


class RoleSummarySerializer(serializers.ModelSerializer):
    permissions = serializers.SlugRelatedField(many=True, read_only=True, slug_field="code")

    class Meta:
        model = Role
        fields = ("id", "code", "name", "permissions")


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


class InstitutionModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstitutionModule
        fields = ("module_code", "is_enabled", "configuration_status")


class MembershipSerializer(serializers.ModelSerializer):
    institution = InstitutionSerializer(read_only=True)
    role = RoleSummarySerializer(read_only=True)

    class Meta:
        model = InstitutionMembership
        fields = (
            "id",
            "institution",
            "role",
            "status",
            "is_primary",
            "joined_at",
            "ended_at",
        )


class CurrentInstitutionSerializer(serializers.Serializer):
    institution = InstitutionSerializer()
    membership = MembershipSerializer()
    active_capabilities = serializers.ListField(child=serializers.CharField())
