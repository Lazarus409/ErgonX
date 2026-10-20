from datetime import date

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response

from apps.audit.services import record_audit_event
from apps.organization.holidays import suggested_holidays
from apps.organization.models import Department, Grade, Location, Position, PublicHoliday
from apps.organization.serializers import (
    DepartmentSerializer,
    GradeSerializer,
    LocationSerializer,
    PositionSerializer,
    PublicHolidaySerializer,
)
from common.viewsets import TenantModelViewSet


class DepartmentViewSet(TenantModelViewSet):
    model = Department
    serializer_class = DepartmentSerializer
    permission_resource = "organization"
    search_fields = ("name", "code")
    ordering_fields = ("name", "code", "created_at", "updated_at")

    def get_queryset(self):
        return super().get_queryset().select_related("parent", "head")


class PositionViewSet(TenantModelViewSet):
    model = Position
    serializer_class = PositionSerializer
    permission_resource = "organization"
    search_fields = ("title", "code", "department__name")
    ordering_fields = ("title", "code", "created_at", "updated_at")

    def get_queryset(self):
        return super().get_queryset().select_related("department")


class GradeViewSet(TenantModelViewSet):
    model = Grade
    serializer_class = GradeSerializer
    permission_resource = "organization"
    search_fields = ("name", "code")
    ordering_fields = ("level", "name", "code", "created_at", "updated_at")


class LocationViewSet(TenantModelViewSet):
    model = Location
    serializer_class = LocationSerializer
    permission_resource = "organization"
    search_fields = ("name", "code", "city", "country")
    ordering_fields = ("name", "code", "created_at", "updated_at")


class PublicHolidayViewSet(TenantModelViewSet):
    """Institution holidays: leave, attendance and working-day payroll skip these dates."""

    model = PublicHoliday
    serializer_class = PublicHolidaySerializer
    filterset_fields = {"date": ["gte", "lte", "exact"]}
    search_fields = ("name",)
    ordering_fields = ("date", "name")

    def get_required_permission(self):
        # Everyone who sees schedules sees holidays; organization editors maintain them.
        if self.action in {"list", "retrieve"}:
            return "schedule.view"
        if self.action == "suggestions":
            return "organization.create"
        return {
            "create": "organization.create",
            "update": "organization.update",
            "partial_update": "organization.update",
            "destroy": "organization.delete",
        }.get(self.action)

    def get_queryset(self):
        return super().get_queryset().filter(is_active=True)

    def _audit(self, holiday, action_name):
        record_audit_event(
            actor=self.request.user, institution=self.request.institution, entity=holiday, action=action_name,
            metadata={"date": holiday.date.isoformat(), "name": holiday.name},
        )

    def perform_create(self, serializer):
        self._audit(serializer.save(institution=self.request.institution), "holiday.created")

    def perform_update(self, serializer):
        self._audit(serializer.save(), "holiday.updated")

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=("is_active", "updated_at"))
        self._audit(instance, "holiday.removed")

    @extend_schema(
        summary="Suggested public holidays for a year",
        parameters=[OpenApiParameter("year", OpenApiTypes.INT, required=True)],
        responses=inline_serializer("HolidaySuggestions", {
            "country_code": serializers.CharField(),
            "note": serializers.CharField(),
            "holidays": inline_serializer("HolidaySuggestion", {
                "name": serializers.CharField(), "date": serializers.DateField(),
                "statutory_date": serializers.DateField(allow_null=True), "already_added": serializers.BooleanField(),
            }, many=True),
        }),
        filters=False,
    )
    @action(detail=False, methods=("get",), filter_backends=(), pagination_class=None)
    def suggestions(self, request):
        """Statutory holidays for the institution's country whose dates can be worked out; review before adding."""
        try:
            year = int(request.query_params.get("year", ""))
            date(year, 1, 1)
        except ValueError:
            raise DRFValidationError({"year": "Give a year, e.g. 2027."})
        if not 2000 <= year <= 2100:
            raise DRFValidationError({"year": "Give a year between 2000 and 2100."})
        return Response(suggested_holidays(request.institution, year))
