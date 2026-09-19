from datetime import date

from django.db.models import Count, Sum
from django.db.models.functions import ExtractYear
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.accounting.models import Expense, Invoice, JournalEntry, VendorBill
from apps.attendance.models import AttendanceRecord
from apps.employees.models import Employee
from apps.leave.models import LeaveRequest
from apps.payroll.models import PayrollRecord, PayrollRun
from common.permissions import TenantContextPermission, TenantRBACPermission
from apps.institutions.services import effective_permission_codes
from apps.dashboards.home import home_payload
from apps.dashboards.serializers import HomeSerializer


class DashboardViewSet(ViewSet):
    permission_classes = (TenantContextPermission, TenantRBACPermission)

    def get_required_permission(self):
        return f"dashboard.{self.action}.view"

    def _employee_metrics(self, institution):
        records = Employee.objects.for_institution(institution)
        return {
            "total_employees": records.count(),
            "active_employees": records.filter(status=Employee.Status.ACTIVE).count(),
            "by_status": list(records.values("status").annotate(count=Count("id")).order_by("status")),
        }

    @action(detail=False, methods=("get",))
    def executive(self, request):
        institution = request.institution
        payload = self._employee_metrics(institution)
        payload.update({
            "pending_leave_requests": LeaveRequest.objects.filter(institution=institution, status=LeaveRequest.Status.PENDING).count(),
            "pending_journals": JournalEntry.objects.filter(institution=institution, status=JournalEntry.Status.PENDING_APPROVAL).count(),
            "payroll_cost": PayrollRecord.objects.filter(institution=institution, payroll_run__status=PayrollRun.Status.FINALIZED).aggregate(total=Sum("gross_pay"))["total"] or 0,
        })
        return Response(payload)

    @action(detail=False, methods=("get",))
    def hr(self, request):
        institution = request.institution
        payload = self._employee_metrics(institution)
        payload["by_hire_year"] = list(Employee.objects.for_institution(institution).annotate(year=ExtractYear("hire_date")).values("year").annotate(count=Count("id")).order_by("year"))
        return Response(payload)

    @action(detail=False, methods=("get",))
    def leave(self, request):
        institution = request.institution
        today = date.today()
        records = LeaveRequest.objects.filter(institution=institution)
        return Response({"pending": records.filter(status=LeaveRequest.Status.PENDING).count(), "currently_on_leave": records.filter(status=LeaveRequest.Status.APPROVED, start_date__lte=today, end_date__gte=today).count(), "upcoming": records.filter(status=LeaveRequest.Status.APPROVED, start_date__gt=today).count()})

    @action(detail=False, methods=("get",))
    def attendance(self, request):
        records = AttendanceRecord.objects.filter(institution=request.institution, attendance_date=date.today())
        return Response({"present": records.filter(status=AttendanceRecord.Status.PRESENT).count(), "late": records.filter(status=AttendanceRecord.Status.LATE).count(), "absent": records.filter(status=AttendanceRecord.Status.ABSENT).count(), "overtime_minutes": records.aggregate(total=Sum("overtime_minutes"))["total"] or 0})

    @action(detail=False, methods=("get",))
    def payroll(self, request):
        runs = PayrollRun.objects.filter(institution=request.institution)
        latest = runs.order_by("-started_at").first()
        return Response({"latest_run_id": str(latest.id) if latest else None, "latest_run_status": latest.status if latest else None, "pending_runs": runs.exclude(status__in=(PayrollRun.Status.FINALIZED, PayrollRun.Status.CANCELLED)).count(), "finalized_gross_pay": PayrollRecord.objects.filter(institution=request.institution, payroll_run__status=PayrollRun.Status.FINALIZED).aggregate(total=Sum("gross_pay"))["total"] or 0})

    @action(detail=False, methods=("get",), url_path="finance")
    def finance(self, request):
        institution = request.institution
        return Response({"pending_journals": JournalEntry.objects.filter(institution=institution, status=JournalEntry.Status.PENDING_APPROVAL).count(), "accounts_payable": VendorBill.objects.filter(institution=institution, status__in=(VendorBill.Status.POSTED, VendorBill.Status.PART_PAID)).aggregate(total=Sum("amount_payable"))["total"] or 0, "accounts_receivable": Invoice.objects.filter(institution=institution, status__in=(Invoice.Status.ISSUED, Invoice.Status.PART_PAID)).aggregate(total=Sum("total_amount"))["total"] or 0, "expenses": Expense.objects.filter(institution=institution, status=Expense.Status.POSTED).aggregate(total=Sum("amount"))["total"] or 0})


class HomeViewSet(ViewSet):
    permission_classes = (TenantContextPermission, TenantRBACPermission)

    def get_required_permission(self):
        return "home.view"

    def list(self, request):
        payload = home_payload(
            user=request.user,
            institution=request.institution,
            permission_codes=effective_permission_codes(request.membership),
        )
        return Response(HomeSerializer(payload).data)
