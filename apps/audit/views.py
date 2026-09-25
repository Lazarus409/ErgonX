from django.db.models import Q
from django.utils.dateparse import parse_datetime
from uuid import UUID
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView

from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from common.permissions import TenantContextPermission, TenantRBACPermission


class AuditLogListView(ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [TenantContextPermission, TenantRBACPermission]
    required_module = None

    def get_required_permission(self):
        return "audit.view"

    @extend_schema(
        parameters=[
            OpenApiParameter("from", str), OpenApiParameter("to", str), OpenApiParameter("actor", str),
            OpenApiParameter("action", str), OpenApiParameter("entity_type", str), OpenApiParameter("entity_id", str), OpenApiParameter("q", str),
        ],
        responses=AuditLogSerializer(many=True),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AuditLog.objects.none()
        queryset = AuditLog.objects.for_institution(self.request.institution).select_related("actor")
        params = self.request.query_params
        if value := params.get("from"):
            parsed = parse_datetime(value)
            if not parsed:
                raise ValidationError({"from": "Use an ISO-8601 date-time."})
            queryset = queryset.filter(created_at__gte=parsed)
        if value := params.get("to"):
            parsed = parse_datetime(value)
            if not parsed:
                raise ValidationError({"to": "Use an ISO-8601 date-time."})
            queryset = queryset.filter(created_at__lte=parsed)
        if value := params.get("actor"):
            queryset = queryset.filter(actor__email__icontains=value)
        if value := params.get("action"):
            queryset = queryset.filter(action__icontains=value)
        if value := params.get("entity_type"):
            queryset = queryset.filter(entity_type__icontains=value)
        if value := params.get("entity_id"):
            try:
                queryset = queryset.filter(entity_id=UUID(value))
            except ValueError as error:
                raise ValidationError({"entity_id": "Use a UUID."}) from error
        if value := params.get("q"):
            queryset = queryset.filter(Q(action__icontains=value) | Q(entity_type__icontains=value) | Q(actor__email__icontains=value))
        return queryset
