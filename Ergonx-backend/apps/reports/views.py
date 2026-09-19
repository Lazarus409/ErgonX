import csv
from decimal import Decimal

from django.db.models import Count, Sum
from django.http import HttpResponse
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.accounting.models import Expense, Invoice, JournalEntry, VendorBill
from apps.attendance.models import AttendanceRecord
from apps.employees.models import Employee
from apps.leave.models import LeaveRequest
from apps.payroll.models import PayrollRecord
from common.permissions import TenantContextPermission, TenantRBACPermission


class ReportsViewSet(ViewSet):
    permission_classes = (TenantContextPermission, TenantRBACPermission)

    def get_required_permission(self):
        return "report.view"

    def _respond(self, request, name, rows):
        if request.query_params.get("export") != "csv":
            return Response({"report": name, "rows": rows})
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{name}.csv"'
        fieldnames = list(dict.fromkeys(key for row in rows for key in row)) or ["empty"]
        writer = csv.DictWriter(response, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
        return response

    @action(detail=False, methods=("get",), url_path="workforce-cost")
    def workforce_cost(self, request):
        rows = list(Employee.objects.for_institution(request.institution).values("status").annotate(employee_count=Count("id")).order_by("status"))
        payroll = PayrollRecord.objects.filter(institution=request.institution).aggregate(gross=Sum("gross_pay"), net=Sum("net_pay"))
        rows.append({"status": "PAYROLL_TOTAL", "employee_count": "", "gross_pay": payroll["gross"] or Decimal("0"), "net_pay": payroll["net"] or Decimal("0")})
        return self._respond(request, "workforce-cost", rows)

    @action(detail=False, methods=("get",))
    def leave(self, request):
        return self._respond(request, "leave", list(LeaveRequest.objects.filter(institution=request.institution).values("status").annotate(request_count=Count("id"), requested_days=Sum("requested_days")).order_by("status")))

    @action(detail=False, methods=("get",))
    def attendance(self, request):
        return self._respond(request, "attendance", list(AttendanceRecord.objects.filter(institution=request.institution).values("status").annotate(record_count=Count("id"), late_minutes=Sum("late_minutes"), overtime_minutes=Sum("overtime_minutes")).order_by("status")))

    @action(detail=False, methods=("get",))
    def payroll(self, request):
        rows = list(PayrollRecord.objects.filter(institution=request.institution).values("payroll_run__status").annotate(employee_count=Count("id"), gross_pay=Sum("gross_pay"), deductions=Sum("total_deductions"), net_pay=Sum("net_pay")).order_by("payroll_run__status"))
        return self._respond(request, "payroll", rows)

    @action(detail=False, methods=("get",))
    def accounting(self, request):
        rows = list(JournalEntry.objects.filter(institution=request.institution).values("source", "status").annotate(journal_count=Count("id")).order_by("source", "status"))
        return self._respond(request, "accounting", rows)

    @action(detail=False, methods=("get",), url_path="ap-ar")
    def ap_ar(self, request):
        institution = request.institution
        rows = [
            {"area": "AP", "open_amount": VendorBill.objects.filter(institution=institution, status__in=(VendorBill.Status.POSTED, VendorBill.Status.PART_PAID)).aggregate(total=Sum("amount_payable"))["total"] or Decimal("0")},
            {"area": "AR", "open_amount": Invoice.objects.filter(institution=institution, status__in=(Invoice.Status.ISSUED, Invoice.Status.PART_PAID)).aggregate(total=Sum("total_amount"))["total"] or Decimal("0")},
        ]
        return self._respond(request, "ap-ar", rows)

    @action(detail=False, methods=("get",))
    def expenses(self, request):
        return self._respond(request, "expenses", list(Expense.objects.filter(institution=request.institution).values("status").annotate(expense_count=Count("id"), amount=Sum("amount")).order_by("status")))
