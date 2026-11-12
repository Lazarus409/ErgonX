import re

from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.reports.services import build_report_details, build_report_rows
from apps.institutions.services import effective_permission_codes
from common.classification import CONFIDENTIAL, REPORT_LEVELS
from common.exports import FORMATS, columns_from_rows, humanize, table_response
from common.permissions import TenantContextPermission, TenantRBACPermission
from common.scoping import ATTENDANCE_BROAD, LEAVE_BROAD, scope_to_employees

# Beyond report.view, a report needs the permissions that already guard its data,
# so a role never reads a summary of records it could not open directly. Each
# entry is a list of requirements; a requirement is met by any one of its codes.
# Leave and attendance need a management permission: leave.view and
# attendance.view alone are self-service (every staff member has them for their
# own records), so they do not open the institution-wide reports.
REPORT_PERMISSIONS = {
    "workforce-cost": (("employee.view",), ("payroll.view",)),
    "recruitment": (("candidate.view",),),
    "leave": (LEAVE_BROAD,),
    "attendance": (ATTENDANCE_BROAD,),
    "payroll": (("payroll.view",),),
    "accounting": (("journal.view",),),
    "ap-ar": (("invoice.view",), ("vendor_bill.view",)),
    "expenses": (("expense.view",),),
}


REPORT_TITLES = {
    "workforce-cost": "Workforce cost",
    "recruitment": "Recruitment",
    "leave": "Leave",
    "attendance": "Attendance",
    "payroll": "Payroll",
    "accounting": "Journal activity",
    "ap-ar": "Payables and receivables",
    "expenses": "Expenses",
}


# The module whose records a report reads, beyond the REPORTS module itself.
REPORT_MODULES = {
    "leave": "LEAVE",
    "attendance": "ATTENDANCE",
    "payroll": "PAYROLL",
    "accounting": "ACCOUNTING",
    "ap-ar": "ACCOUNTING",
    "expenses": "ACCOUNTING",
    "recruitment": "RECRUITMENT",
}


def report_scope(request, name):
    """Authorize report ``name`` for the requester and return the data-scope function.

    Shared by the report endpoints and queued exports, so an export never
    reads a report its requester could not open.
    """
    enabled = set(request.institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
    # REPORTS gates every reports surface, as well as the source module (Wave 0 BQ-05).
    if "REPORTS" not in enabled:
        raise PermissionDenied("The REPORTS module is disabled.", code="module_disabled")
    source_module = REPORT_MODULES.get(name)
    if source_module and source_module not in enabled:
        raise PermissionDenied(f"The {source_module} module is disabled.", code="module_disabled")
    granted = set(effective_permission_codes(request.membership))
    # report.all (directors, auditors) opens every report read-only and institution-wide.
    if "report.all" in granted:
        return lambda queryset, field, **options: queryset
    if "report.view" not in granted or not all(granted & set(requirement) for requirement in REPORT_PERMISSIONS[name]):
        raise PermissionDenied("Your role does not include access to this report.")
    return lambda queryset, field, **options: scope_to_employees(queryset, request, field, **options)


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
        scope = report_scope(request, name)
        filters = {
            "status": request.query_params.get("status"),
            "date_from": request.query_params.get("date_from"),
            "date_to": request.query_params.get("date_to"),
        }
        # ?group=<value>[&group=<value>] opens one summary row: the records it counted.
        group = request.query_params.getlist("group")
        try:
            if group:
                rows = build_report_details(
                    request.institution,
                    name,
                    group,
                    scope=scope,
                    **filters,
                )
            else:
                rows = build_report_rows(request.institution, name, scope=scope, **filters)
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        export = request.query_params.get("export")
        if export not in FORMATS:
            return Response({"report": name, "group": group, "rows": rows} if group else {"report": name, "rows": rows})
        # Group values come from the query string, so only safe characters reach the header.
        filename = re.sub(r"[^a-z0-9-]+", "-", "-".join([name, *group]).lower()).strip("-")
        title = REPORT_TITLES.get(name, humanize(name))
        if group:
            title = f"{title}: {' · '.join(humanize(value.lower()) for value in group)}"
        subtitle = " · ".join(part for part in (
            f"Status {humanize(filters['status'].lower())}" if filters["status"] else "",
            f"From {filters['date_from']}" if filters["date_from"] else "",
            f"To {filters['date_to']}" if filters["date_to"] else "",
        ) if part)
        return table_response(
            export, filename=filename, title=title, columns=columns_from_rows(rows), rows=rows,
            institution=request.institution, subtitle=subtitle, classification=REPORT_LEVELS.get(name, CONFIDENTIAL),
        )

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
