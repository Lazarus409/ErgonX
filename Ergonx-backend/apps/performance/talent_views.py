"""Talent and succession: critical positions, successors and the 9-box talent grid.

All of this is confidential HR data: ``talent.view`` reads it (HR, Directors,
Auditors) and ``talent.manage`` changes it. Employees never see it.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_audit_event
from apps.employees.models import Employee, Employment
from apps.organization.models import Position
from apps.performance.models import PerformanceReview, SuccessionPlan, Successor, TalentProfile
from common.permissions import TenantContextPermission, TenantRBACPermission
from common.scoping import scope_to_employees
from common.serializers import ValidatedModelSerializer, call_validated_service
from common.viewsets import TenantModelViewSet

LEVELS = ("LOW", "MEDIUM", "HIGH")


def rating_level(rating):
    """Map a 1-5 final review rating onto the grid's three performance bands."""
    if not rating:
        return ""
    return "LOW" if rating <= 2 else "MEDIUM" if rating == 3 else "HIGH"


def latest_ratings(employee_ids):
    """The final rating of each employee's most recently signed-off review."""
    ratings = {}
    reviews = PerformanceReview.objects.filter(employee_id__in=employee_ids, status=PerformanceReview.Status.COMPLETED).order_by("employee_id", "-signed_off_at")
    for review in reviews:
        ratings.setdefault(review.employee_id, review.final_rating)
    return ratings


class SuccessorSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    employee_number = serializers.CharField(source="employee.employee_number", read_only=True)
    readiness_label = serializers.CharField(source="get_readiness_display", read_only=True)
    current_position = serializers.SerializerMethodField()
    latest_rating = serializers.SerializerMethodField()

    class Meta:
        model = Successor
        fields = ("id", "employee", "employee_name", "employee_number", "current_position", "readiness", "readiness_label", "development_notes", "latest_rating", "sort_order")
        read_only_fields = ("id", "employee_name", "employee_number", "current_position", "readiness_label", "latest_rating")

    def get_current_position(self, successor):
        return self.context.get("positions", {}).get(successor.employee_id, "")

    def get_latest_rating(self, successor):
        return self.context.get("ratings", {}).get(successor.employee_id)


class SuccessionPlanSerializer(ValidatedModelSerializer):
    position_title = serializers.CharField(source="position.title", read_only=True)
    department_name = serializers.CharField(source="position.department.name", read_only=True, default="")
    risk_of_loss_label = serializers.CharField(source="get_risk_of_loss_display", read_only=True)
    impact_of_loss_label = serializers.CharField(source="get_impact_of_loss_display", read_only=True)
    incumbents = serializers.SerializerMethodField()
    successors = serializers.SerializerMethodField()
    cover = serializers.SerializerMethodField()

    class Meta:
        model = SuccessionPlan
        fields = (
            "id", "position", "position_title", "department_name", "is_critical", "risk_of_loss", "risk_of_loss_label", "impact_of_loss",
            "impact_of_loss_label", "notes", "reviewed_at", "incumbents", "successors", "cover", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if getattr(request, "institution", None) is not None:
            self.fields["position"].queryset = Position.objects.for_institution(request.institution)

    def get_incumbents(self, plan):
        return [{"id": str(employee.id), "name": employee.full_name} for employee in self.context.get("incumbents", {}).get(plan.position_id, [])]

    def get_successors(self, plan):
        return SuccessorSerializer(plan.successors.all(), many=True, context=self.context).data

    def get_cover(self, plan):
        """Bench strength: who is ready when."""
        readiness = [successor.readiness for successor in plan.successors.all()]
        counts = {value: readiness.count(value) for value in Successor.Readiness.values}
        status = "READY" if counts["READY_NOW"] else "DEVELOPING" if readiness else "NONE"
        return {"status": status, **counts}


class SuccessorInputSerializer(serializers.Serializer):
    employee = serializers.UUIDField()
    readiness = serializers.ChoiceField(choices=Successor.Readiness.choices)
    development_notes = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class SuccessionPlanViewSet(TenantModelViewSet):
    model = SuccessionPlan
    serializer_class = SuccessionPlanSerializer
    http_method_names = ("get", "post", "patch", "delete", "head", "options")
    filterset_fields = ("is_critical", "risk_of_loss", "impact_of_loss")
    ordering = ("position__title",)

    def get_required_permission(self):
        return "talent.view" if self.action in ("list", "retrieve") else "talent.manage"

    def get_queryset(self):
        return super().get_queryset().select_related("position__department").prefetch_related("successors__employee")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        institution = getattr(self.request, "institution", None)
        if institution is None or getattr(self, "swagger_fake_view", False):
            return context
        current = Employment.objects.filter(institution=institution, is_current=True, employee__status=Employee.Status.ACTIVE).select_related("employee", "position")
        incumbents, positions = {}, {}
        for employment in current:
            incumbents.setdefault(employment.position_id, []).append(employment.employee)
            positions[employment.employee_id] = employment.position.title if employment.position_id else ""
        successor_ids = Successor.objects.filter(institution=institution).values_list("employee_id", flat=True)
        return {**context, "incumbents": incumbents, "positions": positions, "ratings": latest_ratings(list(successor_ids))}

    def _audit(self, plan, action, **metadata):
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=plan, action=f"talent.succession.{action}", metadata={"position": plan.position.title, **metadata})

    def perform_create(self, serializer):
        self._audit(serializer.save(institution=self.request.institution), "created")

    def perform_update(self, serializer):
        self._audit(serializer.save(), "updated")

    def perform_destroy(self, instance):
        self._audit(instance, "deleted")
        instance.delete()

    def _respond(self, plan):
        return Response(self.get_serializer(self.get_queryset().get(pk=plan.pk)).data)

    @extend_schema(request=SuccessorInputSerializer, responses=SuccessionPlanSerializer)
    @action(detail=True, methods=("post",))
    def successors(self, request, pk=None):
        """Adds a successor, or updates their readiness if already named."""
        plan = self.get_object()
        payload = SuccessorInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = payload.validated_data
        employee = get_object_or_404(Employee.objects.for_institution(request.institution), pk=values["employee"])
        if employee.status != Employee.Status.ACTIVE:
            raise ValidationError({"employee": "Choose an active employee."})
        with transaction.atomic():
            successor = Successor.objects.filter(plan=plan, employee=employee).first() or Successor(institution=request.institution, plan=plan, employee=employee, sort_order=plan.successors.count() + 1)
            successor.readiness = values["readiness"]
            successor.development_notes = values.get("development_notes", successor.development_notes)
            call_validated_service(successor.save)
        self._audit(plan, "successor_saved", employee_id=str(employee.id), readiness=successor.readiness)
        return self._respond(plan)

    @extend_schema(request=None, responses=SuccessionPlanSerializer)
    @action(detail=True, methods=("delete",), url_path=r"successors/(?P<successor_id>[0-9a-f-]+)")
    def remove_successor(self, request, pk=None, successor_id=None):
        plan = self.get_object()
        successor = get_object_or_404(plan.successors, pk=successor_id)
        self._audit(plan, "successor_removed", employee_id=str(successor.employee_id))
        successor.delete()
        return self._respond(plan)


class TalentAssessmentSerializer(serializers.Serializer):
    employee = serializers.UUIDField()
    potential = serializers.ChoiceField(choices=TalentProfile.Level.choices, required=False, allow_blank=True)
    performance_override = serializers.ChoiceField(choices=TalentProfile.Level.choices, required=False, allow_blank=True)
    flight_risk = serializers.ChoiceField(choices=TalentProfile.Level.choices, required=False, allow_blank=True)
    in_talent_pool = serializers.BooleanField(required=False)
    career_aspiration = serializers.CharField(required=False, allow_blank=True, max_length=300)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=3000)


class TalentGridView(APIView):
    """GET: every active employee in scope on the 9-box grid. POST: save one employee's assessment."""

    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "CORE_HR"

    def get_required_permission(self):
        return "talent.manage" if self.request.method == "POST" else "talent.view"

    def _rows(self, request):
        employees = list(scope_to_employees(Employee.objects.for_institution(request.institution).filter(status=Employee.Status.ACTIVE), request, "").order_by("first_name", "last_name"))
        ids = [employee.id for employee in employees]
        profiles = {profile.employee_id: profile for profile in TalentProfile.objects.filter(employee_id__in=ids).select_related("assessed_by")}
        ratings = latest_ratings(ids)
        employments = {row.employee_id: row for row in Employment.objects.filter(employee_id__in=ids, is_current=True).select_related("department", "position")}
        rows = []
        for employee in employees:
            profile = profiles.get(employee.id)
            employment = employments.get(employee.id)
            performance = (profile.performance_override if profile and profile.performance_override else "") or rating_level(ratings.get(employee.id))
            rows.append({
                "employee_id": str(employee.id), "employee": employee.full_name, "employee_number": employee.employee_number,
                "department": employment.department.name if employment and employment.department_id else "",
                "position": employment.position.title if employment and employment.position_id else "",
                "latest_rating": ratings.get(employee.id), "performance": performance,
                "performance_overridden": bool(profile and profile.performance_override),
                "potential": profile.potential if profile else "", "flight_risk": profile.flight_risk if profile else "",
                "in_talent_pool": bool(profile and profile.in_talent_pool), "career_aspiration": profile.career_aspiration if profile else "",
                "notes": profile.notes if profile else "", "assessed_at": profile.assessed_at if profile else None,
                "assessed_by": (profile.assessed_by.get_full_name() or profile.assessed_by.email) if profile and profile.assessed_by else "",
            })
        return rows

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        rows = self._rows(request)
        boxes = {f"{performance}:{potential}": 0 for performance in LEVELS for potential in LEVELS}
        for row in rows:
            if row["performance"] and row["potential"]:
                boxes[f"{row['performance']}:{row['potential']}"] += 1
        return Response({
            "employees": rows, "boxes": boxes,
            "summary": {
                "employees": len(rows), "placed": sum(boxes.values()), "talent_pool": sum(1 for row in rows if row["in_talent_pool"]),
                "high_flight_risk": sum(1 for row in rows if row["flight_risk"] == "HIGH"),
            },
        })

    @extend_schema(request=TalentAssessmentSerializer, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        payload = TalentAssessmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        employee = get_object_or_404(scope_to_employees(Employee.objects.for_institution(request.institution), request, ""), pk=values.pop("employee"))
        if employee.user_id == request.user.id:
            raise ValidationError({"employee": "You can't assess your own talent profile."})
        profile = TalentProfile.objects.filter(employee=employee).first() or TalentProfile(institution=request.institution, employee=employee)
        for field, value in values.items():
            setattr(profile, field, value)
        profile.assessed_by, profile.assessed_at = request.user, timezone.now()
        call_validated_service(profile.save)
        record_audit_event(actor=request.user, institution=request.institution, entity=profile, action="talent.profile.assessed", metadata={"employee_id": str(employee.id), "changes": sorted(values)})
        row = next(row for row in self._rows(request) if row["employee_id"] == str(employee.id))
        return Response(row)
