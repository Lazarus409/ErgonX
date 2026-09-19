from rest_framework.decorators import action
from rest_framework.response import Response

from apps.employees.filters import EmployeeFilter
from apps.employees.models import Employee, Employment
from apps.employees.selectors import employment_history_for_employee
from apps.employees.serializers import EmployeeOffboardingSerializer, EmployeeOffboardingStartSerializer, EmployeeOnboardingSerializer, EmployeeSerializer, EmploymentSerializer
from apps.employees.services import complete_employee_offboarding, complete_employee_onboarding, initiate_employee_offboarding, start_employee_onboarding
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet


class EmployeeViewSet(TenantModelViewSet):
    model = Employee
    serializer_class = EmployeeSerializer
    permission_resource = "employee"
    filterset_class = EmployeeFilter
    search_fields = (
        "employee_number",
        "first_name",
        "middle_name",
        "last_name",
        "work_email",
    )
    ordering_fields = (
        "employee_number",
        "first_name",
        "last_name",
        "hire_date",
        "created_at",
        "updated_at",
    )

    def get_queryset(self):
        return super().get_queryset().select_related("user")

    def get_required_permission(self):
        if self.action == "employment_history":
            return "employment.view"
        if self.action in ("onboarding_start", "onboarding_complete", "offboarding_start", "offboarding_complete"):
            return "employee.update"
        return super().get_required_permission()

    def perform_destroy(self, instance):
        instance.status = Employee.Status.INACTIVE
        instance.save(update_fields=("status", "updated_at"))

    @action(detail=True, methods=("get",), url_path="employment-history")
    def employment_history(self, request, pk=None):
        employee = self.get_object()
        history = employment_history_for_employee(
            institution=request.institution, employee=employee
        )
        page = self.paginate_queryset(history)
        if page is not None:
            serializer = EmploymentSerializer(page, many=True, context=self.get_serializer_context())
            return self.get_paginated_response(serializer.data)
        serializer = EmploymentSerializer(
            history, many=True, context=self.get_serializer_context()
        )
        return Response(serializer.data)

    @action(detail=True, methods=("post",), url_path="onboarding/start")
    def onboarding_start(self, request, pk=None):
        record = call_validated_service(start_employee_onboarding, institution=request.institution, employee=self.get_object(), actor=request.user)
        return Response(EmployeeOnboardingSerializer(record).data)

    @action(detail=True, methods=("post",), url_path="onboarding/complete")
    def onboarding_complete(self, request, pk=None):
        record = call_validated_service(complete_employee_onboarding, institution=request.institution, employee=self.get_object(), actor=request.user)
        return Response(EmployeeOnboardingSerializer(record).data)

    @action(detail=True, methods=("post",), url_path="offboarding/start")
    def offboarding_start(self, request, pk=None):
        payload = EmployeeOffboardingStartSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        record = call_validated_service(initiate_employee_offboarding, institution=request.institution, employee=self.get_object(), actor=request.user, **payload.validated_data)
        return Response(EmployeeOffboardingSerializer(record).data)

    @action(detail=True, methods=("post",), url_path="offboarding/complete")
    def offboarding_complete(self, request, pk=None):
        record = call_validated_service(complete_employee_offboarding, institution=request.institution, employee=self.get_object(), actor=request.user)
        return Response(EmployeeOffboardingSerializer(record).data)


class EmploymentViewSet(TenantModelViewSet):
    model = Employment
    serializer_class = EmploymentSerializer
    permission_resource = "employment"
    http_method_names = ("get", "post", "put", "patch", "head", "options")
    search_fields = (
        "employee__employee_number",
        "employee__first_name",
        "employee__last_name",
        "department__name",
        "position__title",
    )
    ordering_fields = ("start_date", "end_date", "created_at", "updated_at")

    def get_queryset(self):
        return super().get_queryset().select_related(
            "employee", "department", "position", "grade", "location", "reports_to"
        )
