"""Read-only tools the assistant may call.

Every tool runs as the person asking: it checks their role permissions, the
modules their organisation has enabled, and their data scope, exactly as the
matching screen does. A tool never returns Restricted records, secrets, or
personal contact details (personal email, phone, date of birth, bank details).
"""

from datetime import date
from decimal import Decimal

from django.db.models import Count, Q
from django.utils import timezone

from common.scoping import LEAVE_BROAD, INSTITUTION, data_scope, permission_codes, scope_to_employees

MAX_ROWS = 25


class ToolError(Exception):
    """A problem the model should read and explain (wrong input, no access)."""


def _enabled(request, module):
    return request.institution.modules.filter(module_code=module, is_enabled=True).exists()


def _require(request, *, module=None, permission=None):
    if module and not _enabled(request, module):
        raise ToolError(f"The {module.replace('_', ' ').title()} module is not enabled for this organisation.")
    if permission and permission not in permission_codes(request):
        raise ToolError("The person asking does not have access to this information in ErgonX.")


def _own_employee(request):
    from apps.employees.models import Employee

    return Employee.objects.for_institution(request.institution).filter(user=request.user).first()


def _num(value):
    if value is None:
        return None
    value = Decimal(value)
    return int(value) if value == value.to_integral() else float(value)


def _date(value, field):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ToolError(f"{field} must be a date written YYYY-MM-DD.") from exc


def _employment_summary(employment):
    if employment is None:
        return {}
    manager = employment.reports_to.employee if employment.reports_to_id else None
    return {
        "job_title": employment.position.title if employment.position_id else "",
        "department": employment.department.name if employment.department_id else "",
        "manager": manager.full_name if manager else "",
        "employment_type": employment.get_employment_type_display(),
        "start_date": employment.start_date.isoformat() if employment.start_date else None,
    }


def _current_employment(employee):
    return employee.employments.filter(is_current=True).select_related("position", "department", "reports_to__employee").first()


# ---- the tools ---------------------------------------------------------------------------


def get_my_profile(request):
    employee = _own_employee(request)
    if employee is None:
        return {"has_employee_record": False, "note": "This account has no employee record in this organisation."}
    return {
        "has_employee_record": True,
        "name": employee.full_name,
        "employee_number": employee.employee_number,
        "work_email": employee.work_email,
        "office_location": employee.office_location,
        **_employment_summary(_current_employment(employee)),
    }


def get_my_leave(request):
    from apps.leave.models import LeaveBalance, LeaveRequest

    _require(request, module="LEAVE", permission="leave.view")
    employee = _own_employee(request)
    if employee is None:
        return {"note": "This account has no employee record, so it has no leave."}
    year = timezone.localdate().year
    balances = [
        {"leave_type": balance.leave_type.name, "year": balance.year, "available_days": _num(balance.available), "used_days": _num(balance.used)}
        for balance in LeaveBalance.objects.filter(employee=employee, year=year).select_related("leave_type")
    ]
    requests = [
        {"leave_type": item.leave_type.name, "start_date": item.start_date.isoformat(), "end_date": item.end_date.isoformat(), "days": _num(item.requested_days), "status": item.get_status_display()}
        for item in LeaveRequest.objects.filter(employee=employee).select_related("leave_type").order_by("-start_date")[:10]
    ]
    return {"year": year, "balances": balances, "recent_requests": requests}


def get_my_payslips(request, limit=None):
    from apps.payroll.models import Payslip

    _require(request, module="PAYROLL", permission="payslip.view")
    employee = _own_employee(request)
    if employee is None:
        return {"note": "This account has no employee record, so it has no payslips."}
    limit = max(1, min(int(limit or 3), 6))
    payslips = Payslip.objects.filter(institution=request.institution, payroll_record__employee=employee).select_related("payroll_record__payroll_run__payroll_period").order_by("-generated_at")[:limit]
    return {"payslips": [
        {
            "period": payslip.payroll_record.payroll_run.payroll_period.name,
            "gross_pay": str(payslip.payroll_record.gross_pay),
            "total_deductions": str(payslip.payroll_record.total_deductions),
            "net_pay": str(payslip.payroll_record.net_pay),
            "currency": payslip.payroll_record.currency,
        }
        for payslip in payslips
    ]}


def get_pending_approvals(request):
    from apps.workflows.inbox import approval_inbox

    inbox = approval_inbox(request, permission_codes=permission_codes(request))
    items = [
        {"what": item["title"], "detail": item["subtitle"], "reference": item["reference"], "requested_by": item["requested_by"],
         "submitted": item["submitted_at"].date().isoformat() if item["submitted_at"] else None,
         "amount": f"{item['amount']} {item['currency']}".strip() if item["amount"] else None,
         "you_can_decide": bool(item["actions"]), "why_not": item["blocked_reason"]}
        for item in inbox["items"][:MAX_ROWS]
    ]
    return {"total": inbox["summary"]["total"], "waiting_over_3_days": inbox["summary"]["waiting_over_3_days"], "items": items}


def who_is_on_leave(request, start_date=None, end_date=None):
    from apps.leave.models import LeaveRequest

    _require(request, module="LEAVE", permission="leave.view")
    start = _date(start_date, "start_date") or timezone.localdate()
    end = _date(end_date, "end_date") or start
    if end < start:
        raise ToolError("end_date is before start_date.")
    if (end - start).days > 92:
        raise ToolError("Ask about at most three months at a time.")
    queryset = LeaveRequest.objects.for_institution(request.institution).filter(
        status=LeaveRequest.Status.APPROVED, start_date__lte=end, end_date__gte=start,
    ).select_related("employee", "leave_type").order_by("start_date")
    queryset = scope_to_employees(queryset, request, broad=LEAVE_BROAD)
    rows = [{"name": item.employee.full_name, "leave_type": item.leave_type.name, "from": item.start_date.isoformat(), "to": item.end_date.isoformat()} for item in queryset[:MAX_ROWS + 1]]
    note = "Only your own leave is visible to you." if data_scope(request) != INSTITUTION and not (permission_codes(request) & set(LEAVE_BROAD)) else ""
    return {"from": start.isoformat(), "to": end.isoformat(), "people": rows[:MAX_ROWS], "more_not_shown": len(rows) > MAX_ROWS, "note": note}


def search_policies(request, query):
    from apps.documents.models import Policy

    words = [word for word in (query or "").split() if len(word) > 2][:6]
    policies = Policy.objects.for_institution(request.institution).filter(status=Policy.Status.PUBLISHED)
    if words:
        match = Q()
        for word in words:
            match |= Q(title__icontains=word) | Q(summary__icontains=word) | Q(body__icontains=word)
        policies = policies.filter(match)
    def score(policy):
        # Title matches first, then the summary, then the body.
        haystacks = ((policy.title, 6), (policy.summary, 3), (policy.body or "", 1))
        return sum(weight * text.lower().count(word.lower()) for word in words for text, weight in haystacks)

    ranked = sorted(policies[:50], key=lambda policy: (-score(policy), policy.title))
    results = []
    for policy in ranked[:5]:
        results.append({"title": policy.title, "category": policy.get_category_display(), "version": policy.version, "summary": policy.summary, "text": (policy.body or "")[:6000]})
    return {"query": query, "policies": results, "note": "" if results else "No published policy matches. Policies published only as an attached file are not searchable here."}


def find_colleague(request, name):
    from apps.employees.models import Employee

    _require(request, permission="employee.view")
    words = [word for word in (name or "").split() if word][:3]
    if not words:
        raise ToolError("Give part of the person's name.")
    queryset = Employee.objects.for_institution(request.institution).filter(status=Employee.Status.ACTIVE)
    for word in words:
        queryset = queryset.filter(Q(first_name__icontains=word) | Q(last_name__icontains=word) | Q(preferred_name__icontains=word))
    queryset = scope_to_employees(queryset, request, employee_field="")
    rows = []
    for employee in queryset.order_by("last_name", "first_name")[:10]:
        rows.append({"name": employee.full_name, "employee_number": employee.employee_number, "work_email": employee.work_email,
                     "office_location": employee.office_location, **_employment_summary(_current_employment(employee))})
    return {"matches": rows}


def headcount_by_department(request):
    from apps.employees.models import Employment

    _require(request, permission="employee.view")
    if data_scope(request) != INSTITUTION:
        raise ToolError("Organisation-wide headcount is available only to people who see the whole organisation.")
    rows = (
        Employment.objects.for_institution(request.institution).filter(is_current=True, employee__status="ACTIVE")
        .values("department__name").annotate(people=Count("employee", distinct=True)).order_by("-people")
    )
    departments = [{"department": row["department__name"] or "No department", "people": row["people"]} for row in rows]
    return {"total": sum(row["people"] for row in departments), "departments": departments}


def get_my_requests(request):
    result = {}
    if _enabled(request, "ACCOUNTING") and "expense.claim_own" in permission_codes(request):
        from apps.accounting.models import Expense

        claims = Expense.objects.for_institution(request.institution).filter(claimant__user=request.user).order_by("-created_at")[:10]
        result["expense_claims"] = [{"description": claim.description[:120], "amount": f"{claim.amount} {claim.currency}", "date": claim.expense_date.isoformat(), "status": claim.get_status_display()} for claim in claims]
    if _enabled(request, "PROCUREMENT") and "requisition.create_own" in permission_codes(request):
        from apps.procurement.models import PurchaseRequisition

        requisitions = PurchaseRequisition.objects.for_institution(request.institution).filter(requested_by=request.user).order_by("-created_at")[:10]
        result["purchase_requests"] = [{"reference": item.requisition_number, "title": item.title, "estimated_total": f"{item.estimated_total} {item.currency}", "status": item.get_status_display()} for item in requisitions]
    if not result:
        result["note"] = "Expense claims and purchase requests are not available to this person."
    return result


def _schema(properties=None, required=None):
    return {"type": "object", "properties": properties or {}, "required": required or [], "additionalProperties": False}


NULLABLE_DATE = {"type": ["string", "null"], "description": "A date as YYYY-MM-DD, or null for today."}

# (definition, function). Order is fixed so the request prefix stays cacheable.
TOOLS = (
    ({"name": "get_my_profile", "description": "The asking person's own job title, department, manager, start date, employment type, work email and office.", "input_schema": _schema()}, get_my_profile),
    ({"name": "get_my_leave", "description": "The asking person's leave balances for this year and their ten most recent leave requests with status.", "input_schema": _schema()}, get_my_leave),
    ({"name": "get_my_payslips", "description": "The asking person's most recent payslips: period, gross pay, deductions and net pay. Only their own.",
      "input_schema": _schema({"limit": {"type": ["integer", "null"], "description": "How many recent payslips, 1 to 6. Null for 3."}}, ["limit"])}, get_my_payslips),
    ({"name": "get_pending_approvals", "description": "Requests waiting for the asking person to approve across modules (leave, expenses, bills, purchase orders and more), oldest first.", "input_schema": _schema()}, get_pending_approvals),
    ({"name": "who_is_on_leave", "description": "Approved leave overlapping a date range, limited to the people the asking person may see (themselves, their team, or everyone, as in ErgonX).",
      "input_schema": _schema({"start_date": NULLABLE_DATE, "end_date": NULLABLE_DATE}, ["start_date", "end_date"])}, who_is_on_leave),
    ({"name": "search_policies", "description": "Search the organisation's published workplace policies (leave, conduct, travel, IT and others) and return the matching policy text.",
      "input_schema": _schema({"query": {"type": "string", "description": "Words to look for, e.g. 'maternity leave' or 'travel per diem'."}}, ["query"])}, search_policies),
    ({"name": "find_colleague", "description": "Look up active colleagues by name: job title, department, manager, work email and office. No personal contact details.",
      "input_schema": _schema({"name": {"type": "string", "description": "All or part of the person's name."}}, ["name"])}, find_colleague),
    ({"name": "headcount_by_department", "description": "Number of active employees per department, for people who see the whole organisation.", "input_schema": _schema()}, headcount_by_department),
    ({"name": "get_my_requests", "description": "The asking person's own expense claims and purchase requests with their status.", "input_schema": _schema()}, get_my_requests),
)
TOOL_DEFINITIONS = [{**definition, "strict": True} for definition, _ in TOOLS]
TOOL_FUNCTIONS = {definition["name"]: function for definition, function in TOOLS}


def run_tool(request, name, arguments):
    """(result dict, is_error). Unknown tools and bad input come back as errors the model can explain."""
    function = TOOL_FUNCTIONS.get(name)
    if function is None:
        return {"error": f"There is no tool called {name}."}, True
    try:
        arguments = {key: value for key, value in (arguments or {}).items() if value is not None}
        return function(request, **arguments), False
    except ToolError as exc:
        return {"error": str(exc)}, True
    except TypeError:
        return {"error": "The tool was called with the wrong arguments."}, True
