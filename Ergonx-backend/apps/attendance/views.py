from rest_framework.decorators import action
from django.utils.dateparse import parse_date
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.response import Response

from apps.attendance.models import AttendanceAdjustment, AttendanceRecord, OvertimeRecord
from apps.attendance.serializers import (
    AttendanceAdjustmentSerializer,
    AttendanceClassificationSerializer,
    AttendanceRecordSerializer,
    ClockInSerializer,
    ClockOutSerializer,
    OvertimeDecisionSerializer,
    OvertimeRecordSerializer,
)
from apps.attendance.services import (
    classify_attendance_date,
    clock_in,
    clock_out,
    decide_adjustment,
    decide_overtime,
)
from common.scoping import ATTENDANCE_BROAD, scope_to_employees
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet


class EmployeeScopedQuerysetMixin:
    def scope_to_employee(self, queryset, employee_field="employee"):
        return scope_to_employees(queryset, self.request, employee_field, broad=ATTENDANCE_BROAD)


class AttendanceRecordViewSet(EmployeeScopedQuerysetMixin, TenantModelViewSet):
    model = AttendanceRecord
    serializer_class = AttendanceRecordSerializer
    required_module = "ATTENDANCE"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("employee", "attendance_date", "status", "source")
    search_fields = ("employee__employee_number", "employee__first_name", "employee__last_name")
    ordering_fields = ("attendance_date", "check_in", "check_out", "created_at")

    def get_required_permission(self):
        if self.action == "classify":
            return "attendance.manage"
        if self.action in {"clock_in", "clock_out"}:
            return "attendance.clock"
        return "attendance.view"

    def get_queryset(self):
        queryset = super().get_queryset().select_related("employee", "schedule_assignment")
        queryset = self.scope_to_employee(queryset)
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            parsed = parse_date(date_from)
            if parsed is None:
                raise ValidationError({"date_from": "Use YYYY-MM-DD."})
            queryset = queryset.filter(attendance_date__gte=parsed)
        if date_to:
            parsed = parse_date(date_to)
            if parsed is None:
                raise ValidationError({"date_to": "Use YYYY-MM-DD."})
            queryset = queryset.filter(attendance_date__lte=parsed)
        return queryset

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed("POST", detail="Use the clock-in action.")

    @action(detail=False, methods=("get",))
    def calendar(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=("post",), url_path="clock-in")
    def clock_in(self, request):
        payload = ClockInSerializer(data=request.data, context=self.get_serializer_context())
        payload.is_valid(raise_exception=True)
        record = call_validated_service(
            clock_in, actor=request.user, **payload.validated_data
        )
        return Response(self.get_serializer(record).data)

    @action(detail=False, methods=("post",))
    def classify(self, request):
        payload = AttendanceClassificationSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        payload.is_valid(raise_exception=True)
        record = call_validated_service(
            classify_attendance_date,
            actor=request.user,
            **payload.validated_data,
        )
        return Response(self.get_serializer(record).data)

    @action(detail=True, methods=("post",), url_path="clock-out")
    def clock_out(self, request, pk=None):
        payload = ClockOutSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        record = call_validated_service(
            clock_out,
            attendance_record=self.get_object(),
            actor=request.user,
            **payload.validated_data,
        )
        return Response(self.get_serializer(record).data)


class AttendanceAdjustmentViewSet(EmployeeScopedQuerysetMixin, TenantModelViewSet):
    model = AttendanceAdjustment
    serializer_class = AttendanceAdjustmentSerializer
    required_module = "ATTENDANCE"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("attendance_record", "requested_by", "status")
    ordering_fields = ("created_at", "acted_at")

    def get_required_permission(self):
        if self.action in {"approve", "reject"}:
            return "attendance.approve"
        if self.action == "create":
            return "attendance.adjust"
        return "attendance.view"

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            "attendance_record__employee", "requested_by", "approved_by"
        )
        return self.scope_to_employee(queryset, "attendance_record__employee")

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        adjustment = call_validated_service(
            decide_adjustment, adjustment=self.get_object(), actor=request.user, approve=True
        )
        return Response(self.get_serializer(adjustment).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        adjustment = call_validated_service(
            decide_adjustment, adjustment=self.get_object(), actor=request.user, approve=False
        )
        return Response(self.get_serializer(adjustment).data)


class OvertimeRecordViewSet(EmployeeScopedQuerysetMixin, TenantModelViewSet):
    model = OvertimeRecord
    serializer_class = OvertimeRecordSerializer
    required_module = "ATTENDANCE"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("employee", "status")
    ordering_fields = ("created_at", "approved_at", "calculated_minutes")

    def get_required_permission(self):
        if self.action in {"approve", "reject"}:
            return "attendance.approve"
        return "attendance.view"

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            "employee", "attendance_record", "approved_by"
        )
        return self.scope_to_employee(queryset)

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed("POST", detail="Overtime is generated from attendance.")

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        payload = OvertimeDecisionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        overtime = call_validated_service(
            decide_overtime,
            overtime_record=self.get_object(),
            actor=request.user,
            approve=True,
            **payload.validated_data,
        )
        return Response(self.get_serializer(overtime).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        overtime = call_validated_service(
            decide_overtime,
            overtime_record=self.get_object(),
            actor=request.user,
            approve=False,
        )
        return Response(self.get_serializer(overtime).data)
