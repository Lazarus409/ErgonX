from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import ExtractYear, TruncMonth
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.accounting.models import Account, BankAccount, BankStatementLine, Expense, Invoice, JournalEntry, JournalLine, VendorBill
from apps.attendance.models import AttendanceRecord
from apps.employees.models import Employee, Employment
from apps.leave.models import LeaveBalance, LeaveRequest
from apps.payroll.models import PayrollRecord, PayrollRun
from apps.recruitment.models import Application, Candidate, Interview, JobPosting, Offer, RecruitmentStage
from common.permissions import TenantContextPermission, TenantRBACPermission
from apps.institutions.services import effective_permission_codes
from apps.dashboards.department import department_dashboard
from common.scoping import data_scope
from apps.dashboards.home import home_payload
from apps.dashboards.serializers import HomeSerializer


def _open_balance_aging(records, amount_field):
    """Return a small, tenant-filtered aging summary without storing a projection."""
    today = date.today()
    buckets = {"Current / no due date": Decimal("0"), "1–30 days overdue": Decimal("0"), "31–60 days overdue": Decimal("0"), "Over 60 days overdue": Decimal("0")}
    for row in records.values("due_date", amount_field):
        amount = row[amount_field] or Decimal("0")
        due_date = row["due_date"]
        if due_date is None or due_date >= today:
            bucket = "Current / no due date"
        elif due_date >= today - timedelta(days=30):
            bucket = "1–30 days overdue"
        elif due_date >= today - timedelta(days=60):
            bucket = "31–60 days overdue"
        else:
            bucket = "Over 60 days overdue"
        buckets[bucket] += amount
    return [{"bucket": bucket, "amount": amount} for bucket, amount in buckets.items()]


def _profit_and_loss_trend(institution):
    """Return posted-ledger P&L facts without creating a dashboard projection.

    Revenue follows the income account's credit-normal convention; expenses
    follow the expense account's debit-normal convention. Reversed journals
    are excluded by the posted-journal constraint, so this series represents
    the currently effective posted ledger only.
    """
    rollups = (
        JournalLine.objects.filter(
            journal_entry__institution=institution,
            journal_entry__status=JournalEntry.Status.POSTED,
            account__account_type__in=(
                Account.AccountType.INCOME,
                Account.AccountType.EXPENSE,
            ),
        )
        .annotate(month=TruncMonth("journal_entry__entry_date"))
        .values("month", "account__account_type")
        .annotate(debit=Sum("debit"), credit=Sum("credit"))
        .order_by("month")
    )
    months = {}
    for item in rollups:
        month = item["month"].date() if hasattr(item["month"], "date") else item["month"]
        values = months.setdefault(month, {"income": Decimal("0"), "expenses": Decimal("0")})
        debit = item["debit"] or Decimal("0")
        credit = item["credit"] or Decimal("0")
        if item["account__account_type"] == Account.AccountType.INCOME:
            values["income"] += credit - debit
        else:
            values["expenses"] += debit - credit
    return [
        {
            "month": month.isoformat(),
            "income": values["income"],
            "expenses": values["expenses"],
            "net_income": values["income"] - values["expenses"],
        }
        for month, values in list(sorted(months.items()))[-12:]
    ]


def _bank_cash_position(institution):
    """Return registered-bank facts derived from effective posted ledger lines.

    A generic asset account is not necessarily cash, so this intentionally
    uses only the tenant's active ``BankAccount.ledger_account`` records.
    That makes an unavailable bank configuration explicit instead of treating
    receivables or other assets as cash.
    """
    bank_account_ids = BankAccount.objects.filter(
        institution=institution,
        is_active=True,
    ).values("ledger_account_id")
    lines = JournalLine.objects.filter(
        journal_entry__institution=institution,
        journal_entry__status=JournalEntry.Status.POSTED,
        account_id__in=bank_account_ids,
    )
    balance = lines.aggregate(debit=Sum("debit"), credit=Sum("credit"))
    rollups = (
        lines.annotate(month=TruncMonth("journal_entry__entry_date"))
        .values("month")
        .annotate(debit=Sum("debit"), credit=Sum("credit"))
        .order_by("month")
    )
    trend = []
    for item in list(rollups)[-12:]:
        month = item["month"].date() if hasattr(item["month"], "date") else item["month"]
        inflow = item["debit"] or Decimal("0")
        outflow = item["credit"] or Decimal("0")
        trend.append({
            "month": month.isoformat(),
            "inflow": inflow,
            "outflow": outflow,
            "net_movement": inflow - outflow,
        })
    return {
        "registered_bank_accounts": BankAccount.objects.filter(
            institution=institution,
            is_active=True,
        ).count(),
        "balance": (balance["debit"] or Decimal("0")) - (balance["credit"] or Decimal("0")),
        "cash_flow_trend": trend,
    }


class DashboardViewSet(ViewSet):
    permission_classes = (TenantContextPermission, TenantRBACPermission)

    def get_required_permission(self):
        if self.action == "recruitment":
            return "candidate.view"
        return f"dashboard.{self.action}.view"

    def _employee_metrics(self, institution):
        records = Employee.objects.for_institution(institution)
        return {
            "total_employees": records.count(),
            "active_employees": records.filter(status=Employee.Status.ACTIVE).count(),
            "by_status": list(records.values("status").annotate(count=Count("id")).order_by("status")),
        }

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
        description=(
            "Return tenant-scoped executive metrics, posted-ledger P&L, and "
            "registered-bank balance and movement. Arbitrary asset accounts are not cash."
        ),
    )
    @action(detail=False, methods=("get",))
    def executive(self, request):
        institution = request.institution
        payload = self._employee_metrics(institution)
        enabled_modules = set(
            institution.modules.filter(is_enabled=True).values_list("module_code", flat=True)
        )
        # CORE_HR is the always-on foundation. Every optional rollup is built
        # only when its module is enabled so a disabled module cannot leak
        # counts, labels, or financial facts through the executive endpoint.
        payload.update({
            "currency": institution.default_currency,
            "executive_title": institution.executive_title or "Executive",
        })
        if "LEAVE" in enabled_modules:
            payload["pending_leave_requests"] = LeaveRequest.objects.filter(
                institution=institution, status=LeaveRequest.Status.PENDING
            ).count()
        if "ACCOUNTING" in enabled_modules:
            bank_cash_position = _bank_cash_position(institution)
            payload.update({
                "pending_journals": JournalEntry.objects.filter(
                    institution=institution, status=JournalEntry.Status.PENDING_APPROVAL
                ).count(),
                "financial_position": {
                    "bank_balance": bank_cash_position["balance"],
                    "registered_bank_accounts": bank_cash_position["registered_bank_accounts"],
                    "accounts_payable": VendorBill.objects.filter(
                        institution=institution,
                        status__in=(VendorBill.Status.POSTED, VendorBill.Status.PART_PAID),
                    ).aggregate(total=Sum("amount_payable"))["total"] or 0,
                    "accounts_receivable": Invoice.objects.filter(
                        institution=institution,
                        status__in=(Invoice.Status.ISSUED, Invoice.Status.PART_PAID),
                    ).aggregate(total=Sum("total_amount"))["total"] or 0,
                    "posted_expenses": Expense.objects.filter(
                        institution=institution, status=Expense.Status.POSTED
                    ).aggregate(total=Sum("amount"))["total"] or 0,
                },
                "profit_and_loss_trend": _profit_and_loss_trend(institution),
                "cash_flow_trend": bank_cash_position["cash_flow_trend"],
            })
        if "PAYROLL" in enabled_modules:
            payroll_records = PayrollRecord.objects.filter(
                institution=institution, payroll_run__status=PayrollRun.Status.FINALIZED
            )
            payroll_by_period = list(
                payroll_records.values(
                    "payroll_run__payroll_period__name",
                    "payroll_run__payroll_period__end_date",
                )
                .annotate(total=Sum("gross_pay"))
                .order_by("-payroll_run__payroll_period__end_date")[:6]
            )
            payload.update({
                "payroll_cost": payroll_records.aggregate(total=Sum("gross_pay"))["total"] or 0,
                "payroll_by_period": [
                    {
                        "label": entry["payroll_run__payroll_period__name"],
                        "period_end": entry["payroll_run__payroll_period__end_date"],
                        "gross_pay": entry["total"],
                    }
                    for entry in reversed(payroll_by_period)
                ],
            })
        if "ATTENDANCE" in enabled_modules:
            today_attendance = AttendanceRecord.objects.filter(
                institution=institution, attendance_date=date.today()
            )
            payload["attendance_today"] = {
                "present": today_attendance.filter(status=AttendanceRecord.Status.PRESENT).count(),
                "late": today_attendance.filter(status=AttendanceRecord.Status.LATE).count(),
                "absent": today_attendance.filter(status=AttendanceRecord.Status.ABSENT).count(),
                "on_leave": today_attendance.filter(status=AttendanceRecord.Status.ON_LEAVE).count(),
            }
        if "RECRUITMENT" in enabled_modules:
            payload["recruitment_summary"] = {
                "open_jobs": JobPosting.objects.filter(
                    institution=institution, status=JobPosting.Status.OPEN
                ).count(),
                "active_candidates": Candidate.objects.filter(
                    institution=institution, status=Candidate.Status.ACTIVE
                ).count(),
                "applications": Application.objects.filter(institution=institution).count(),
                "scheduled_interviews": Interview.objects.filter(
                    institution=institution, status=Interview.Status.SCHEDULED
                ).count(),
                "offers_extended": Offer.objects.filter(
                    institution=institution, status=Offer.Status.EXTENDED
                ).count(),
            }
        return Response(payload)

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
        description="Return roster, today's attendance, leave and trends for the departments the user heads.",
    )
    @action(detail=False, methods=("get",))
    def department(self, request):
        payload = department_dashboard(request.user, request.institution)
        enabled = set(request.institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
        if "LEAVE" not in enabled:
            for key in ("on_leave_today", "upcoming_leave", "leave_by_type", "approval_queue"):
                payload[key] = []
            payload["pending_approvals"] = 0
        if "ATTENDANCE" not in enabled:
            payload["attendance_trend"] = []
        return Response(payload)

    @extend_schema(responses={200: OpenApiTypes.OBJECT}, description="Return tenant-scoped workforce dashboard rollups.")
    @action(detail=False, methods=("get",))
    def hr(self, request):
        institution = request.institution
        payload = self._employee_metrics(institution)
        employees = Employee.objects.for_institution(institution)
        current_employments = Employment.objects.for_institution(institution).filter(
            is_current=True,
            employee__status=Employee.Status.ACTIVE,
        )
        payload.update({
            "by_hire_year": list(
                employees.annotate(year=ExtractYear("hire_date"))
                .values("year")
                .annotate(count=Count("id"))
                .order_by("year")
            ),
            "by_department": list(
                current_employments.values("department__name")
                .annotate(count=Count("id"))
                .order_by("department__name")
            ),
            "by_grade": list(
                current_employments.values("grade__name")
                .annotate(count=Count("id"))
                .order_by("grade__name")
            ),
            "by_location": list(
                current_employments.values("location__name")
                .annotate(count=Count("id"))
                .order_by("location__name")
            ),
            "by_employment_type": list(
                current_employments.values("employment_type")
                .annotate(count=Count("id"))
                .order_by("employment_type")
            ),
            "recent_hires": list(
                employees.filter(status=Employee.Status.ACTIVE)
                .values(
                    "id",
                    "first_name",
                    "last_name",
                    "employee_number",
                    "hire_date",
                    "employments__department__name",
                    "employments__position__title",
                )
                .filter(employments__is_current=True)
                .order_by("-hire_date", "-created_at")[:5]
            ),
        })
        return Response(payload)

    @extend_schema(responses={200: OpenApiTypes.OBJECT}, description="Return tenant-scoped leave dashboard rollups.")
    @action(detail=False, methods=("get",))
    def leave(self, request):
        institution = request.institution
        today = date.today()
        records = LeaveRequest.objects.filter(institution=institution)
        approved = records.filter(status=LeaveRequest.Status.APPROVED)
        balance_totals = LeaveBalance.objects.filter(
            institution=institution,
            year=today.year,
        ).aggregate(
            opening_balance=Sum("opening_balance"),
            accrued=Sum("accrued"),
            adjusted=Sum("adjusted"),
            used=Sum("used"),
        )
        entitlement = (
            (balance_totals["opening_balance"] or Decimal("0"))
            + (balance_totals["accrued"] or Decimal("0"))
            + (balance_totals["adjusted"] or Decimal("0"))
        )
        used_days = balance_totals["used"] or Decimal("0")
        first_month = today.replace(day=1)
        for _ in range(5):
            first_month = (first_month - timedelta(days=1)).replace(day=1)
        month_rollups = {
            item["month"].date() if hasattr(item["month"], "date") else item["month"]: item
            for item in approved.filter(start_date__gte=first_month, start_date__lte=today)
            .annotate(month=TruncMonth("start_date"))
            .values("month")
            .annotate(request_count=Count("id"), requested_days=Sum("requested_days"))
            .order_by("month")
        }
        months = []
        month = first_month
        for _ in range(6):
            item = month_rollups.get(month, {})
            months.append({
                "month": month.isoformat(),
                "request_count": item.get("request_count", 0),
                "requested_days": item.get("requested_days", 0) or 0,
            })
            month = (month + timedelta(days=32)).replace(day=1)
        by_department = [
            {"department": row["employee__employments__department__name"] or "Unassigned", "requested_days": row["requested_days"] or 0, "request_count": row["request_count"]}
            for row in approved.filter(start_date__year=today.year, employee__employments__is_current=True)
            .values("employee__employments__department__name")
            .annotate(requested_days=Sum("requested_days"), request_count=Count("id"))
            .order_by("-requested_days")[:8]
        ]
        horizon = today + timedelta(days=27)
        upcoming_spans = list(approved.filter(end_date__gte=today, start_date__lte=horizon).values_list("start_date", "end_date"))
        leave_calendar = []
        for offset in range(28):
            day = today + timedelta(days=offset)
            leave_calendar.append({"date": day.isoformat(), "on_leave": sum(1 for start, end in upcoming_spans if start <= day <= end)})
        return Response({
            "currency": institution.default_currency,
            "pending": records.filter(status=LeaveRequest.Status.PENDING).count(),
            "currently_on_leave": approved.filter(start_date__lte=today, end_date__gte=today).count(),
            "upcoming": approved.filter(start_date__gt=today).count(),
            "by_leave_type": list(
                approved.values("leave_type__name")
                .annotate(request_count=Count("id"), requested_days=Sum("requested_days"))
                .order_by("leave_type__name")
            ),
            "monthly_approved_leave": months,
            "approved_days_by_department": by_department,
            "leave_calendar": leave_calendar,
            "balance_utilisation": {
                "year": today.year,
                "entitlement_days": entitlement,
                "used_days": used_days,
                "available_days": entitlement - used_days,
                "utilisation_percent": (
                    (used_days / entitlement * Decimal("100"))
                    if entitlement > 0
                    else None
                ),
            },
        })

    @extend_schema(responses={200: OpenApiTypes.OBJECT}, description="Return tenant-scoped attendance dashboard rollups.")
    @action(detail=False, methods=("get",))
    def attendance(self, request):
        institution = request.institution
        today = date.today()
        records = AttendanceRecord.objects.filter(institution=institution, attendance_date=today)
        week_start = today - timedelta(days=6)
        weekly_records = AttendanceRecord.objects.filter(
            institution=institution,
            attendance_date__range=(week_start, today),
        )
        daily_rollups = {
            item["attendance_date"]: item
            for item in weekly_records.values("attendance_date").annotate(
                present=Count("id", filter=Q(status=AttendanceRecord.Status.PRESENT)),
                late=Count("id", filter=Q(status=AttendanceRecord.Status.LATE)),
                absent=Count("id", filter=Q(status=AttendanceRecord.Status.ABSENT)),
                on_leave=Count("id", filter=Q(status=AttendanceRecord.Status.ON_LEAVE)),
                overtime_minutes=Sum("overtime_minutes"),
            )
        }
        by_department = list(
            records.filter(employee__employments__is_current=True)
            .values("employee__employments__department__name")
            .annotate(
                present=Count("id", filter=Q(status=AttendanceRecord.Status.PRESENT)),
                late=Count("id", filter=Q(status=AttendanceRecord.Status.LATE)),
                absent=Count("id", filter=Q(status=AttendanceRecord.Status.ABSENT)),
                on_leave=Count("id", filter=Q(status=AttendanceRecord.Status.ON_LEAVE)),
                total=Count("id"),
            )
            .order_by("employee__employments__department__name")
        )
        lateness_start = today - timedelta(days=89)
        late_records = AttendanceRecord.objects.filter(
            institution=institution,
            status=AttendanceRecord.Status.LATE,
            attendance_date__range=(lateness_start, today),
        )
        repeated_lateness = list(
            late_records.filter(employee__employments__is_current=True)
            .values(
                "employee_id",
                "employee__first_name",
                "employee__last_name",
                "employee__employee_number",
                "employee__employments__department__name",
            )
            .annotate(
                late_occurrences=Count("id"),
                total_minutes_late=Sum("late_minutes"),
            )
            .order_by("-late_occurrences", "-total_minutes_late", "employee__last_name")[:20]
        )
        lateness_trend = list(
            late_records.annotate(month=TruncMonth("attendance_date"))
            .values("month")
            .annotate(late_occurrences=Count("id"), total_minutes_late=Sum("late_minutes"))
            .order_by("month")
        )
        lateness_by_department = list(
            late_records.filter(employee__employments__is_current=True)
            .values("employee__employments__department__name")
            .annotate(late_occurrences=Count("id"), total_minutes_late=Sum("late_minutes"))
            .order_by("-late_occurrences", "employee__employments__department__name")
        )
        return Response({
            "present": records.filter(status=AttendanceRecord.Status.PRESENT).count(),
            "late": records.filter(status=AttendanceRecord.Status.LATE).count(),
            "absent": records.filter(status=AttendanceRecord.Status.ABSENT).count(),
            "overtime_minutes": records.aggregate(total=Sum("overtime_minutes"))["total"] or 0,
            "weekly_attendance": [
                {
                    "date": (week_start + timedelta(days=offset)).isoformat(),
                    "present": daily_rollups.get(week_start + timedelta(days=offset), {}).get("present", 0),
                    "late": daily_rollups.get(week_start + timedelta(days=offset), {}).get("late", 0),
                    "absent": daily_rollups.get(week_start + timedelta(days=offset), {}).get("absent", 0),
                    "on_leave": daily_rollups.get(week_start + timedelta(days=offset), {}).get("on_leave", 0),
                    "overtime_minutes": daily_rollups.get(week_start + timedelta(days=offset), {}).get("overtime_minutes", 0) or 0,
                }
                for offset in range(7)
            ],
            "by_department": by_department,
            "repeated_lateness": repeated_lateness,
            "lateness_trend": lateness_trend,
            "lateness_by_department": lateness_by_department,
        })

    @extend_schema(responses={200: OpenApiTypes.OBJECT}, description="Return tenant-scoped payroll dashboard rollups.")
    @action(detail=False, methods=("get",))
    def payroll(self, request):
        runs = PayrollRun.objects.filter(institution=request.institution)
        latest = runs.order_by("-started_at").first()
        finalized_records = PayrollRecord.objects.filter(
            institution=request.institution,
            payroll_run__status=PayrollRun.Status.FINALIZED,
        )
        totals = finalized_records.aggregate(
            gross_pay=Sum("gross_pay"),
            net_pay=Sum("net_pay"),
            total_deductions=Sum("total_deductions"),
            employer_contributions=Sum("employer_contributions"),
        )
        period_rollups = list(
            finalized_records.values(
                "payroll_run__payroll_period__name",
                "payroll_run__payroll_period__end_date",
            )
            .annotate(
                gross_pay=Sum("gross_pay"),
                net_pay=Sum("net_pay"),
                total_deductions=Sum("total_deductions"),
            )
            .order_by("-payroll_run__payroll_period__end_date")[:6]
        )
        latest_finalized = (
            runs.filter(status=PayrollRun.Status.FINALIZED)
            .select_related("payroll_period")
            .order_by("-payroll_period__end_date", "-started_at")
            .first()
        )
        cost_by_department = []
        if latest_finalized:
            cost_by_department = [
                {"department": row["employee__employments__department__name"] or "Unassigned", "gross_pay": row["gross_pay"] or 0}
                for row in PayrollRecord.objects.filter(payroll_run=latest_finalized, employee__employments__is_current=True)
                .values("employee__employments__department__name")
                .annotate(gross_pay=Sum("gross_pay"))
                .order_by("-gross_pay")[:8]
            ]
        return Response({
            "latest_run_id": str(latest.id) if latest else None,
            "latest_run_status": latest.status if latest else None,
            "pending_runs": runs.exclude(status__in=(PayrollRun.Status.FINALIZED, PayrollRun.Status.CANCELLED)).count(),
            "finalized_gross_pay": totals["gross_pay"] or 0,
            "finalized_net_pay": totals["net_pay"] or 0,
            "finalized_deductions": totals["total_deductions"] or 0,
            "employer_contributions": totals["employer_contributions"] or 0,
            "runs_by_status": list(runs.values("status").annotate(count=Count("id")).order_by("status")),
            "payroll_by_period": [
                {
                    "label": item["payroll_run__payroll_period__name"],
                    "period_end": item["payroll_run__payroll_period__end_date"],
                    "gross_pay": item["gross_pay"],
                    "net_pay": item["net_pay"],
                    "total_deductions": item["total_deductions"],
                }
                for item in reversed(period_rollups)
            ],
            "cost_by_department": {
                "period": latest_finalized.payroll_period.name if latest_finalized else None,
                "departments": cost_by_department,
            },
        })

    @extend_schema(responses={200: OpenApiTypes.OBJECT}, description="Return tenant-scoped recruitment dashboard rollups.")
    @action(detail=False, methods=("get",))
    def recruitment(self, request):
        institution = request.institution
        applications = Application.objects.filter(institution=institution)
        today = date.today()
        first_month = today.replace(day=1)
        for _ in range(5):
            first_month = (first_month - timedelta(days=1)).replace(day=1)
        monthly_counts = {
            item["month"].date() if hasattr(item["month"], "date") else item["month"]: item["count"]
            for item in applications.filter(applied_at__date__gte=first_month, applied_at__date__lte=today)
            .annotate(month=TruncMonth("applied_at"))
            .values("month")
            .annotate(count=Count("id"))
        }
        applications_trend = []
        month = first_month
        for _ in range(6):
            applications_trend.append({"month": month.isoformat(), "applications": monthly_counts.get(month, 0)})
            month = (month + timedelta(days=32)).replace(day=1)
        return Response({
            "open_jobs": JobPosting.objects.filter(institution=institution, status=JobPosting.Status.OPEN).count(),
            "active_candidates": Candidate.objects.filter(institution=institution, status=Candidate.Status.ACTIVE).count(),
            "applications": applications.count(),
            "scheduled_interviews": Interview.objects.filter(institution=institution, status=Interview.Status.SCHEDULED).count(),
            "offers_extended": Offer.objects.filter(institution=institution, status=Offer.Status.EXTENDED).count(),
            "pipeline": list(RecruitmentStage.objects.filter(institution=institution, is_active=True).values("name").annotate(count=Count("applications")).order_by("sequence")),
            "applications_by_status": list(applications.values("status").annotate(count=Count("id")).order_by("status")),
            "applications_trend": applications_trend,
            "applications_by_source": [
                {"source": row["candidate__source"] or "Not recorded", "count": row["count"]}
                for row in applications.values("candidate__source").annotate(count=Count("id")).order_by("-count", "candidate__source")[:6]
            ],
            "interviews_by_status": list(
                Interview.objects.filter(institution=institution).values("status").annotate(count=Count("id")).order_by("status")
            ),
            "time_to_hire": _time_to_hire_distribution(institution),
            "top_open_jobs": list(
                JobPosting.objects.filter(institution=institution, status=JobPosting.Status.OPEN)
                .annotate(application_count=Count("applications"))
                .order_by("-application_count", "title")
                .values("title", "application_count")[:5]
            ),
        })

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
        description=(
            "Return tenant-scoped finance metrics, aging, posted-ledger P&L, and "
            "registered-bank balance and movement."
        ),
    )
    @action(detail=False, methods=("get",), url_path="finance")
    def finance(self, request):
        institution = request.institution
        bank_cash_position = _bank_cash_position(institution)
        open_bills = VendorBill.objects.filter(
            institution=institution,
            status__in=(VendorBill.Status.POSTED, VendorBill.Status.PART_PAID),
        )
        open_invoices = Invoice.objects.filter(
            institution=institution,
            status__in=(Invoice.Status.ISSUED, Invoice.Status.PART_PAID),
        )
        journals = JournalEntry.objects.filter(institution=institution)
        expense_rows = list(
            Expense.objects.filter(institution=institution, status=Expense.Status.POSTED)
            .values("account__name")
            .annotate(total=Sum("amount"))
            .order_by("-total", "account__name")
        )
        unreconciled = BankStatementLine.objects.filter(
            institution=institution,
            status__in=(BankStatementLine.Status.UNMATCHED, BankStatementLine.Status.EXCEPTION),
        )
        return Response({
            "pending_journals": journals.filter(status=JournalEntry.Status.PENDING_APPROVAL).count(),
            "accounts_payable": open_bills.aggregate(total=Sum("amount_payable"))["total"] or 0,
            "accounts_receivable": open_invoices.aggregate(total=Sum("total_amount"))["total"] or 0,
            "expenses": Expense.objects.filter(institution=institution, status=Expense.Status.POSTED).aggregate(total=Sum("amount"))["total"] or 0,
            "bank_balance": bank_cash_position["balance"],
            "registered_bank_accounts": bank_cash_position["registered_bank_accounts"],
            "accounts_payable_aging": _open_balance_aging(open_bills, "amount_payable"),
            "accounts_receivable_aging": _open_balance_aging(open_invoices, "total_amount"),
            "journals_by_status": list(journals.values("status").annotate(count=Count("id")).order_by("status")),
            "profit_and_loss_trend": _profit_and_loss_trend(institution),
            "cash_flow_trend": bank_cash_position["cash_flow_trend"],
            "expenses_by_account": _top_with_other(expense_rows, "account__name", "total"),
            "unreconciled_bank_lines": {
                "count": unreconciled.count(),
                "latest": [
                    {
                        "id": str(line["id"]),
                        "statement_date": line["statement_date"],
                        "bank_account": line["bank_account__name"],
                        "reference": line["reference"],
                        "description": line["description"],
                        "amount": line["amount"],
                        "currency": line["currency"],
                        "status": line["status"],
                    }
                    for line in unreconciled.order_by("-statement_date", "-created_at").values(
                        "id", "statement_date", "bank_account__name", "reference", "description", "amount", "currency", "status"
                    )[:5]
                ],
            },
        })


TIME_TO_HIRE_BUCKETS = (("0–14 days", 0, 14), ("15–30 days", 15, 30), ("31–60 days", 31, 60), ("61+ days", 61, None))


def _time_to_hire_distribution(institution):
    """Days from application to accepted offer, bucketed for a distribution chart."""
    pairs = Offer.objects.filter(
        institution=institution,
        accepted_at__isnull=False,
        application__applied_at__isnull=False,
    ).values_list("application__applied_at", "accepted_at")
    counts = {label: 0 for label, _, _ in TIME_TO_HIRE_BUCKETS}
    for applied_at, accepted_at in pairs:
        days = max((accepted_at - applied_at).days, 0)
        for label, low, high in TIME_TO_HIRE_BUCKETS:
            if days >= low and (high is None or days <= high):
                counts[label] += 1
                break
    return [{"bucket": label, "hires": counts[label]} for label, _, _ in TIME_TO_HIRE_BUCKETS]


def _top_with_other(rows, label_key, value_key, limit=5):
    """Keep the largest `limit` rows and fold the remainder into "Other"."""
    top = rows[:limit]
    rest = sum((row[value_key] or 0) for row in rows[limit:])
    result = [{"label": row[label_key] or "Unassigned", "value": row[value_key] or 0} for row in top]
    if rest:
        result.append({"label": "Other", "value": rest})
    return result


class HomeViewSet(ViewSet):
    permission_classes = (TenantContextPermission, TenantRBACPermission)

    def get_required_permission(self):
        return "home.view"

    @extend_schema(responses=HomeSerializer)
    def list(self, request):
        payload = home_payload(
            user=request.user,
            institution=request.institution,
            permission_codes=effective_permission_codes(request.membership),
            data_scope=data_scope(request),
        )
        return Response(HomeSerializer(payload).data)
