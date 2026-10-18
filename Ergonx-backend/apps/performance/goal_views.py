from django.db.models import Count, Q
from django.utils.dateparse import parse_date
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.employees.models import Employee
from apps.organization.models import Department
from apps.performance import goals as goal_service
from apps.performance.models import Goal, GoalCheckIn, KeyResult
from common.scoping import permission_codes
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet


class KeyResultSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)
    progress = serializers.IntegerField(read_only=True)

    class Meta:
        model = KeyResult
        fields = ("id", "title", "unit", "start_value", "target_value", "current_value", "progress")
        extra_kwargs = {"current_value": {"required": False}, "start_value": {"required": False}}


class GoalCheckInSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    health_label = serializers.CharField(source="get_health_display", read_only=True)

    class Meta:
        model = GoalCheckIn
        fields = ("id", "author_name", "health", "health_label", "progress", "note", "created_at")
        read_only_fields = fields

    def get_author_name(self, entry):
        return entry.author.get_full_name() or entry.author.email


class GoalSerializer(serializers.ModelSerializer):
    key_results = KeyResultSerializer(many=True, required=False)
    level_label = serializers.CharField(source="get_level_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    health_label = serializers.CharField(source="get_health_display", read_only=True)
    owner_name = serializers.SerializerMethodField()
    parent_title = serializers.SerializerMethodField()
    children_count = serializers.IntegerField(read_only=True, default=0)
    agreed_by_name = serializers.SerializerMethodField()
    viewer = serializers.SerializerMethodField()
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none(), required=False, allow_null=True)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.none(), required=False, allow_null=True)
    parent = serializers.PrimaryKeyRelatedField(queryset=Goal.objects.none(), required=False, allow_null=True)

    class Meta:
        model = Goal
        fields = (
            "id", "level", "level_label", "employee", "department", "parent", "parent_title", "owner_name", "title", "description",
            "period_start", "period_end", "status", "status_label", "health", "health_label", "progress", "key_results",
            "children_count", "agreed_by_name", "agreed_at", "last_check_in_at", "viewer", "created_at", "updated_at",
        )
        read_only_fields = ("id", "status", "health", "progress", "agreed_at", "last_check_in_at", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        institution = getattr(request, "institution", None)
        if institution is not None:
            self.fields["employee"].queryset = Employee.objects.for_institution(institution)
            self.fields["department"].queryset = Department.objects.for_institution(institution)
            self.fields["parent"].queryset = Goal.objects.for_institution(institution)

    def get_owner_name(self, goal):
        if goal.level == Goal.Level.INDIVIDUAL and goal.employee:
            return goal.employee.full_name
        if goal.level == Goal.Level.DEPARTMENT and goal.department:
            return goal.department.name
        return getattr(self.context.get("request"), "institution", None).name if self.context.get("request") else ""

    def get_parent_title(self, goal):
        return goal.parent.title if goal.parent_id else ""

    def get_agreed_by_name(self, goal):
        return (goal.agreed_by.get_full_name() or goal.agreed_by.email) if goal.agreed_by else ""

    def get_viewer(self, goal):
        access = self.context.get("access")
        if access is None:
            return {}
        return {
            "can_edit": access.can_edit(goal), "can_manage": access.can_manage(goal), "can_check_in": access.can_check_in(goal),
            "is_owner": access.owns(goal),
        }


class GoalCheckInRequestSerializer(serializers.Serializer):
    health = serializers.ChoiceField(choices=Goal.Health.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    values = serializers.DictField(child=serializers.DecimalField(max_digits=16, decimal_places=2), required=False)
    progress = serializers.IntegerField(min_value=0, max_value=100, required=False)


class GoalViewSet(TenantModelViewSet):
    """Goals the caller may see: active company and department goals for everyone,
    individual goals for the person, their manager and HR."""

    model = Goal
    serializer_class = GoalSerializer
    http_method_names = ("get", "post", "patch", "head", "options")
    filterset_fields = ("level", "status", "employee", "department", "parent", "health")
    search_fields = ("title",)
    ordering_fields = ("title", "period_end", "progress", "created_at")
    ordering = ("level", "-period_end", "title")

    def get_required_permission(self):
        # Rows and actions are limited by GoalAccess.
        return "home.view"

    def access(self):
        if not hasattr(self, "_access"):
            self._access = goal_service.GoalAccess(self.request.user, self.request.institution, permission_codes(self.request))
        return self._access

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Goal.objects.none()
        access = self.access()
        queryset = super().get_queryset().select_related("employee", "department", "parent", "agreed_by").prefetch_related("key_results")
        if not access.is_hr_manager:
            shared = Q(level__in=(Goal.Level.COMPANY, Goal.Level.DEPARTMENT)) & ~Q(status=Goal.Status.DRAFT)
            mine = Q(level=Goal.Level.DEPARTMENT, department_id__in=access.headed) | Q(employee__user=self.request.user)
            if access.is_hr_viewer:
                individual = Q(level=Goal.Level.INDIVIDUAL)
            else:
                individual = Q(level=Goal.Level.INDIVIDUAL) & (
                    Q(employee__employments__is_current=True, employee__employments__department_id__in=access.headed)
                    | Q(employee__employments__is_current=True, employee__employments__reports_to__employee__user=self.request.user)
                )
            queryset = queryset.filter(shared | mine | individual).distinct()
        params = self.request.query_params
        if params.get("mine") == "true":
            queryset = queryset.filter(employee__user=self.request.user)
        if params.get("team") == "true":
            queryset = queryset.filter(level=Goal.Level.INDIVIDUAL).exclude(employee__user=self.request.user)
        on = parse_date(params.get("active_on") or "")
        if on:
            queryset = queryset.filter(period_start__lte=on, period_end__gte=on)
        return queryset.annotate(children_count=Count("children", distinct=True))

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if getattr(self.request, "institution", None) is not None and not getattr(self, "swagger_fake_view", False):
            context["access"] = self.access()
        return context

    def retrieve(self, request, *args, **kwargs):
        goal = self.get_object()
        data = self.get_serializer(goal).data
        data["check_ins"] = GoalCheckInSerializer(goal.check_ins.select_related("author")[:20], many=True).data
        data["children"] = [
            {"id": str(child.id), "title": child.title, "level": child.level, "owner_name": GoalSerializer(child, context=self.get_serializer_context()).data["owner_name"], "progress": child.progress, "health": child.health, "status": child.status}
            for child in self.get_queryset().filter(parent=goal)
        ]
        return Response(data)

    def _respond(self, goal, status=200):
        goal = self.get_queryset().get(pk=goal.pk)
        return Response(self.get_serializer(goal).data, status=status)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        key_results = values.pop("key_results", [])
        goal = call_validated_service(goal_service.create_goal, access=self.access(), institution=request.institution, actor=request.user, key_results=key_results, **values)
        return self._respond(goal, status=201)

    def partial_update(self, request, *args, **kwargs):
        goal = self.get_object()
        serializer = self.get_serializer(goal, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        for locked in ("level", "employee", "department"):
            if locked in values and values[locked] != getattr(goal, locked):
                raise ValidationError({locked: "Create a new goal to change who or what it belongs to."})
            values.pop(locked, None)
        key_results = values.pop("key_results", None)
        goal = call_validated_service(goal_service.update_goal, access=self.access(), goal=goal, actor=request.user, key_results=key_results, **values)
        return self._respond(goal)

    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)

    def _status(self, status):
        goal = call_validated_service(goal_service.set_status, access=self.access(), goal=self.get_object(), actor=self.request.user, status=status)
        return self._respond(goal)

    @extend_schema(request=None, responses=GoalSerializer)
    @action(detail=True, methods=("post",))
    def activate(self, request, pk=None):
        return self._status(Goal.Status.ACTIVE)

    @extend_schema(request=None, responses=GoalSerializer)
    @action(detail=True, methods=("post",))
    def complete(self, request, pk=None):
        return self._status(Goal.Status.COMPLETED)

    @extend_schema(request=None, responses=GoalSerializer)
    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        return self._status(Goal.Status.CANCELLED)

    @extend_schema(request=GoalCheckInRequestSerializer, responses=GoalSerializer)
    @action(detail=True, methods=("post",), url_path="check-in")
    def check_in(self, request, pk=None):
        payload = GoalCheckInRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        goal = call_validated_service(goal_service.check_in, access=self.access(), goal=self.get_object(), actor=request.user, **payload.validated_data)
        return self._respond(goal)
