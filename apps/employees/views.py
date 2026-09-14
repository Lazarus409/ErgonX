from rest_framework.decorators import action
from rest_framework.response import Response

from apps.employees.filters import EmployeeFilter
from apps.employees.models import Employee, Employment
from apps.employees.selectors import employment_history_for_employee
from apps.employees.serializers import EmployeeSerializer, EmploymentSerializer
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
