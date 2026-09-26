from django.http import HttpResponse
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.reports.services import build_report_rows, rows_to_csv
from apps.institutions.services import effective_permission_codes
from common.permissions import TenantContextPermission, TenantRBACPermission

# Beyond report.view, a report needs the permissions that already guard its data,
# so a role never reads a summary of records it could not open directly.
REPORT_PERMISSIONS = {
    "workforce-cost": ("employee.view", "payroll.view"),
    "recruitment": ("candidate.view",),
    "leave": ("leave.view",),
    "attendance": ("attendance.view",),
    "payroll": ("payroll.view",),
    "accounting": ("journal.view",),
    "ap-ar": ("invoice.view", "vendor_bill.view"),
    "expenses": ("expense.view",),
}


@extend_schema(responses={200: OpenApiTypes.OBJECT})
class ReportsViewSet(ViewSet):
    permission_classes = (TenantContextPermission, TenantRBACPermission)

    @property
    def required_module(self):
        return {
            "leave": "LEAVE",
            "attendance": "ATTENDANCE",
            "payroll": "PAYROLL",
            "accounting": "ACCOUNTING",
            "ap_ar": "ACCOUNTING",
            "expenses": "ACCOUNTING",
            "recruitment": "RECRUITMENT",
        }.get(self.action)

    def get_required_permission(self):
        return "report.view"

    def _respond(self, request, name):
        granted = set(effective_permission_codes(request.membership))
        missing = [code for code in REPORT_PERMISSIONS[name] if code not in granted]
        if missing:
            raise PermissionDenied("Your role does not include access to this report.")
        rows = build_report_rows(
            request.institution,
            name,
            status=request.query_params.get("status"),
            date_from=request.query_params.get("date_from"),
            date_to=request.query_params.get("date_to"),
        )
        if request.query_params.get("export") != "csv":
            return Response({"report": name, "rows": rows})
        response = HttpResponse(rows_to_csv(rows), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{name}.csv"'
        return response

    @action(detail=False, methods=("get",), url_path="workforce-cost")
    def workforce_cost(self, request):
        return self._respond(request, "workforce-cost")

    @action(detail=False, methods=("get",))
    def leave(self, request):
        return self._respond(request, "leave")

    @action(detail=False, methods=("get",))
    def attendance(self, request):
        return self._respond(request, "attendance")

    @action(detail=False, methods=("get",))
    def payroll(self, request):
        return self._respond(request, "payroll")

    @action(detail=False, methods=("get",))
    def accounting(self, request):
        return self._respond(request, "accounting")

    @action(detail=False, methods=("get",), url_path="ap-ar")
    def ap_ar(self, request):
        return self._respond(request, "ap-ar")

    @action(detail=False, methods=("get",))
    def expenses(self, request):
        return self._respond(request, "expenses")

    @action(detail=False, methods=("get",))
    def recruitment(self, request):
        return self._respond(request, "recruitment")
