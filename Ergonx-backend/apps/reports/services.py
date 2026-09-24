import csv
import io
from datetime import date
from decimal import Decimal

from django.db.models import Count, Sum

from apps.accounting.models import Expense, Invoice, JournalEntry, VendorBill
from apps.attendance.models import AttendanceRecord
from apps.employees.models import Employee
from apps.leave.models import LeaveRequest
from apps.payroll.models import PayrollRecord
from apps.recruitment.models import Application


REPORT_TYPES = {
    "workforce-cost",
    "leave",
    "attendance",
    "payroll",
    "accounting",
    "ap-ar",
    "expenses",
    "recruitment",
}


def normalize_report_type(export_type):
    value = export_type.strip().lower().replace("report_", "").replace("_", "-")
    if value not in REPORT_TYPES:
        raise ValueError(f"Unsupported report export type: {export_type!r}.")
    return value


def build_report_rows(institution, report_type, *, status=None, date_from=None, date_to=None):
    """Build tenant-scoped report rows for both API and queued exports."""
    report_type = normalize_report_type(report_type)
    try:
        start = date.fromisoformat(date_from) if date_from else None
        end = date.fromisoformat(date_to) if date_to else None
    except ValueError as exc:
        raise ValueError("date_from and date_to must use YYYY-MM-DD format.") from exc
    if start and end and start > end:
        raise ValueError("date_from cannot be after date_to.")
    if report_type == "workforce-cost":
        employees = Employee.objects.for_institution(institution)
        if status:
            employees = employees.filter(status=status)
        rows = list(employees.values("status").annotate(employee_count=Count("id")).order_by("status"))
        payroll_records = PayrollRecord.objects.filter(institution=institution)
        if start:
            payroll_records = payroll_records.filter(payroll_run__payroll_period__end_date__gte=start)
        if end:
            payroll_records = payroll_records.filter(payroll_run__payroll_period__start_date__lte=end)
        payroll = payroll_records.aggregate(gross=Sum("gross_pay"), net=Sum("net_pay"))
        rows.append({"status": "PAYROLL_TOTAL", "employee_count": "", "gross_pay": payroll["gross"] or Decimal("0"), "net_pay": payroll["net"] or Decimal("0")})
        return rows
    if report_type == "leave":
        records = LeaveRequest.objects.filter(institution=institution)
        if start:
            records = records.filter(end_date__gte=start)
        if end:
            records = records.filter(start_date__lte=end)
        if status:
            records = records.filter(status=status)
        return list(records.values("status").annotate(request_count=Count("id"), requested_days=Sum("requested_days")).order_by("status"))
    if report_type == "attendance":
        records = AttendanceRecord.objects.filter(institution=institution)
        if start:
            records = records.filter(attendance_date__gte=start)
        if end:
            records = records.filter(attendance_date__lte=end)
        if status:
            records = records.filter(status=status)
        return list(records.values("status").annotate(record_count=Count("id"), late_minutes=Sum("late_minutes"), overtime_minutes=Sum("overtime_minutes")).order_by("status"))
    if report_type == "payroll":
        records = PayrollRecord.objects.filter(institution=institution)
        if start:
            records = records.filter(payroll_run__payroll_period__end_date__gte=start)
        if end:
            records = records.filter(payroll_run__payroll_period__start_date__lte=end)
        if status:
            records = records.filter(payroll_run__status=status)
        return list(records.values("payroll_run__status").annotate(employee_count=Count("id"), gross_pay=Sum("gross_pay"), deductions=Sum("total_deductions"), net_pay=Sum("net_pay")).order_by("payroll_run__status"))
    if report_type == "accounting":
        journals = JournalEntry.objects.filter(institution=institution)
        if start:
            journals = journals.filter(entry_date__gte=start)
        if end:
            journals = journals.filter(entry_date__lte=end)
        if status:
            journals = journals.filter(status=status)
        return list(journals.values("source", "status").annotate(journal_count=Count("id")).order_by("source", "status"))
    if report_type == "ap-ar":
        bills = VendorBill.objects.filter(institution=institution, status__in=(VendorBill.Status.POSTED, VendorBill.Status.PART_PAID))
        invoices = Invoice.objects.filter(institution=institution, status__in=(Invoice.Status.ISSUED, Invoice.Status.PART_PAID))
        if start:
            bills = bills.filter(due_date__gte=start); invoices = invoices.filter(due_date__gte=start)
        if end:
            bills = bills.filter(bill_date__lte=end); invoices = invoices.filter(invoice_date__lte=end)
        return [{"area": "AP", "open_amount": bills.aggregate(total=Sum("amount_payable"))["total"] or Decimal("0")}, {"area": "AR", "open_amount": invoices.aggregate(total=Sum("total_amount"))["total"] or Decimal("0")}]
    if report_type == "expenses":
        expenses = Expense.objects.filter(institution=institution)
        if start:
            expenses = expenses.filter(expense_date__gte=start)
        if end:
            expenses = expenses.filter(expense_date__lte=end)
        if status:
            expenses = expenses.filter(status=status)
        return list(expenses.values("status").annotate(expense_count=Count("id"), amount=Sum("amount")).order_by("status"))
    applications = Application.objects.filter(institution=institution)
    if start:
        applications = applications.filter(applied_at__date__gte=start)
    if end:
        applications = applications.filter(applied_at__date__lte=end)
    if status:
        applications = applications.filter(status=status)
    return list(applications.values("status").annotate(application_count=Count("id")).order_by("status"))


def rows_to_csv(rows):
    fieldnames = list(dict.fromkeys(key for row in rows for key in row)) or ["empty"]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()
