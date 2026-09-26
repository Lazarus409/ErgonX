from dataclasses import dataclass

from django.db.models import CharField, Q
from django.db.models.functions import Cast

from apps.accounting.models import Account, Invoice, JournalEntry, VendorBill
from apps.employees.models import Employee
from apps.leave.models import LeaveRequest
from apps.payroll.models import PayrollRun
from apps.recruitment.models import Candidate, JobPosting, Offer
from common.scoping import LEAVE_BROAD


@dataclass(frozen=True)
class SearchProvider:
    result_type: str
    module: str
    permission: str
    route_hint: str
    query: callable
    # Providers of employee-linked rows accept ``scope(queryset, employee_field, broad)``.
    employee_scoped: bool = False


def _unscoped(queryset, employee_field, broad=None):
    return queryset


def _employee_results(institution, query, limit, scope=_unscoped):
    rows = scope(Employee.objects.for_institution(institution), "").filter(
        Q(employee_number__iexact=query)
        | Q(employee_number__icontains=query)
        | Q(first_name__icontains=query)
        | Q(last_name__icontains=query)
        | Q(work_email__icontains=query)
    ).order_by("employee_number")[:limit]
    return [
        {
            "id": str(row.id), "reference": row.employee_number, "title": row.full_name,
            "subtitle": row.work_email or row.personal_email, "status": row.status,
            "updated_at": row.updated_at,
        }
        for row in rows
    ]


def _job_results(institution, query, limit):
    rows = JobPosting.objects.for_institution(institution).filter(
        Q(code__iexact=query) | Q(code__icontains=query) | Q(title__icontains=query)
    ).order_by("code")[:limit]
    return [
        {"id": str(row.id), "reference": row.code, "title": row.title, "subtitle": "Job posting", "status": row.status, "updated_at": row.updated_at}
        for row in rows
    ]


def _candidate_results(institution, query, limit):
    rows = Candidate.objects.for_institution(institution).filter(
        Q(first_name__icontains=query) | Q(last_name__icontains=query) | Q(email__icontains=query)
    ).order_by("last_name", "first_name")[:limit]
    return [
        {"id": str(row.id), "reference": "", "title": row.full_name, "subtitle": row.email, "status": row.status, "updated_at": row.updated_at}
        for row in rows
    ]


def _offer_results(institution, query, limit):
    rows = Offer.objects.for_institution(institution).select_related("application__candidate").filter(
        Q(application__candidate__first_name__icontains=query)
        | Q(application__candidate__last_name__icontains=query)
        | Q(status__iexact=query)
    ).order_by("-updated_at")[:limit]
    return [
        {"id": str(row.id), "reference": "", "title": f"Offer for {row.application.candidate.full_name}", "subtitle": "Recruitment offer", "status": row.status, "updated_at": row.updated_at}
        for row in rows
    ]


def _payroll_results(institution, query, limit):
    filters = Q(status__iexact=query) | Q(payroll_period__name__icontains=query)
    run_reference = query.upper().removeprefix("PR-")
    if run_reference.isdigit():
        filters |= Q(run_number=int(run_reference))
    rows = PayrollRun.objects.for_institution(institution).filter(filters).select_related("payroll_period").order_by("-started_at")[:limit]
    return [
        {"id": str(row.id), "reference": f"PR-{row.run_number}", "title": f"Payroll: {row.payroll_period.name}", "subtitle": "Payroll run", "status": row.status, "updated_at": row.updated_at}
        for row in rows
    ]


def _leave_request_results(institution, query, limit, scope=_unscoped):
    filters = (
        Q(employee__employee_number__icontains=query)
        | Q(employee__first_name__icontains=query)
        | Q(employee__last_name__icontains=query)
        | Q(leave_type__code__icontains=query)
        | Q(status__iexact=query)
    )
    queryset = scope(LeaveRequest.objects.for_institution(institution), "employee", LEAVE_BROAD)
    if query.upper().startswith("LR-"):
        queryset = queryset.annotate(search_id=Cast("id", output_field=CharField()))
        filters |= Q(search_id__istartswith=query[3:])
    rows = queryset.filter(filters).select_related("employee", "leave_type").order_by("-created_at")[:limit]
    return [
        {"id": str(row.id), "reference": f"LR-{str(row.id)[:8].upper()}", "title": f"{row.leave_type.name} — {row.employee.full_name}", "subtitle": "Leave request", "status": row.status, "updated_at": row.updated_at}
        for row in rows
    ]


def _account_results(institution, query, limit):
    rows = Account.objects.for_institution(institution).filter(
        Q(code__iexact=query) | Q(code__icontains=query) | Q(name__icontains=query)
    ).order_by("code")[:limit]
    return [
        {"id": str(row.id), "reference": row.code, "title": row.name, "subtitle": "Account", "status": "ACTIVE" if row.is_active else "INACTIVE", "updated_at": row.updated_at}
        for row in rows
    ]


def _journal_results(institution, query, limit):
    rows = JournalEntry.objects.for_institution(institution).filter(
        Q(reference__iexact=query) | Q(reference__icontains=query) | Q(description__icontains=query)
    ).order_by("-entry_date")[:limit]
    return [
        {"id": str(row.id), "reference": row.reference, "title": row.description or "Journal entry", "subtitle": "Journal", "status": row.status, "updated_at": row.updated_at}
        for row in rows
    ]


def _invoice_results(institution, query, limit):
    rows = Invoice.objects.for_institution(institution).filter(
        Q(invoice_number__iexact=query) | Q(invoice_number__icontains=query)
    ).order_by("-invoice_date")[:limit]
    return [
        {"id": str(row.id), "reference": row.invoice_number, "title": f"Invoice {row.invoice_number}", "subtitle": "Accounts receivable", "status": row.status, "updated_at": row.updated_at}
        for row in rows
    ]


def _vendor_bill_results(institution, query, limit):
    rows = VendorBill.objects.for_institution(institution).filter(
        Q(bill_number__iexact=query) | Q(bill_number__icontains=query)
    ).order_by("-bill_date")[:limit]
    return [
        {"id": str(row.id), "reference": row.bill_number, "title": f"Vendor bill {row.bill_number}", "subtitle": "Accounts payable", "status": row.status, "updated_at": row.updated_at}
        for row in rows
    ]


SEARCH_PROVIDERS = (
    SearchProvider("EMPLOYEE", "CORE_HR", "employee.view", "/hr/employees/{id}", _employee_results, employee_scoped=True),
    SearchProvider("JOB_POSTING", "RECRUITMENT", "job_posting.view", "/recruitment/job-postings/{id}", _job_results),
    SearchProvider("CANDIDATE", "RECRUITMENT", "candidate.view", "/recruitment/candidates/{id}", _candidate_results),
    SearchProvider("OFFER", "RECRUITMENT", "offer.view", "/recruitment/offers/{id}", _offer_results),
    SearchProvider("PAYROLL_RUN", "PAYROLL", "payroll.view", "/payroll/runs/{id}", _payroll_results),
    SearchProvider("LEAVE_REQUEST", "LEAVE", "leave.view", "/leave/requests/{id}", _leave_request_results, employee_scoped=True),
    SearchProvider("ACCOUNT", "ACCOUNTING", "account.view", "/accounting/accounts/{id}", _account_results),
    SearchProvider("JOURNAL", "ACCOUNTING", "journal.view", "/accounting/journals/{id}", _journal_results),
    SearchProvider("INVOICE", "ACCOUNTING", "invoice.view", "/accounting/invoices/{id}", _invoice_results),
    SearchProvider("VENDOR_BILL", "ACCOUNTING", "vendor_bill.view", "/accounting/vendor-bills/{id}", _vendor_bill_results),
)


def universal_search(*, institution, permission_codes, query, result_types=(), module=None, limit=20, scope=_unscoped):
    enabled_modules = set(institution.modules.filter(is_enabled=True).values_list("module_code", flat=True)) | {"CORE_HR"}
    requested_types = set(result_types)
    results = []
    for provider in SEARCH_PROVIDERS:
        if requested_types and provider.result_type not in requested_types:
            continue
        if module and provider.module != module:
            continue
        if provider.module not in enabled_modules or provider.permission not in permission_codes:
            continue
        rows = provider.query(institution, query, limit, scope) if provider.employee_scoped else provider.query(institution, query, limit)
        for row in rows:
            results.append({"type": provider.result_type, "module": provider.module, "route_hint": provider.route_hint.format(id=row["id"]), **row})
    return results[:limit]
