from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import User


class UserSerializer(serializers.ModelSerializer):
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
