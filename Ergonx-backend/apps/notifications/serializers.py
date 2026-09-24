from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """Safe, recipient-scoped representation for the in-app notification UI."""

    route_hint = serializers.SerializerMethodField()

    ALLOWED_ROUTE_PREFIXES = (
        "/leave/requests/", "/payroll/runs/", "/recruitment/interviews/",
        "/recruitment/applications/", "/accounting/journals/", "/attendance/",
    )

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_route_hint(self, obj) -> str | None:
        value = obj.metadata.get("route_hint") if isinstance(obj.metadata, dict) else None
        return value if isinstance(value, str) and value.startswith(self.ALLOWED_ROUTE_PREFIXES) else None
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id", "notification_type", "title", "message", "status", "is_read", "route_hint",
            "created_at", "read_at", "metadata",
        )
        read_only_fields = fields

    def get_is_read(self, instance) -> bool:
        return instance.status == Notification.Status.READ or instance.read_at is not None
