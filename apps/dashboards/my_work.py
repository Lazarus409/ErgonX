"""My Work: one list of everything waiting on the signed-in user, across modules.

Sections, each shown only when it applies to the caller:

* ``approvals``  - decisions the caller can take now (from the approvals inbox);
* ``to_do``      - the caller's own tasks: policies to sign, checklist items they
                   own, performance reviews to write, training to finish and
                   certificates to renew;
* ``team``       - onboarding and offboarding items for the people the caller
                   looks after (HR sees every role's items, line managers see
                   the items marked for the line manager);
* ``waiting``    - the caller's own requests that are waiting on someone else.

Each item carries a route to the screen where it is handled, so this page never
decides anything itself. Overdue items sort first.
"""

from datetime import timedelta

from django.utils import timezone

from apps.employees.models import Employee

ITEM_LIMIT = 50
DUE_SOON_DAYS = 7
STALE_APPROVAL = timedelta(days=3)


def _item(*, kind, key, title, subtitle="", route, due_date=None, waiting_since=None, today):
    overdue = bool(due_date and due_date < today)
    return {
        "id": f"{kind}:{key}",
        "kind": kind,
        "title": title,
        "subtitle": subtitle,
        "route": route,
        "due_date": due_date,
        "waiting_since": waiting_since,
        "overdue": overdue,
        "due_soon": bool(due_date and not overdue and due_date <= today + timedelta(days=DUE_SOON_DAYS)),
    }


def _sort(items):
    far = timezone.localdate() + timedelta(days=36500)
    return sorted(items, key=lambda row: (not row["overdue"], row["due_date"] or far, row["title"]))


def _section(key, title, help_text, items, *, route=""):
    items = _sort(items)
    return {
        "key": key, "title": title, "help": help_text, "route": route, "count": len(items),
        "overdue": sum(1 for row in items if row["overdue"]), "items": items[:ITEM_LIMIT],
    }


def _approvals(request, permission_codes, today):
    from apps.workflows.inbox import approval_inbox

    inbox = approval_inbox(request, permission_codes=permission_codes)
    now = timezone.now()
    items = []
    for row in inbox["items"]:
        if not row["actions"]:
            continue
        waiting = now - row["submitted_at"]
        item = _item(
            kind=f"approval.{row['kind']}".lower(), key=row["id"], title=row["title"],
            subtitle=" · ".join(part for part in (row["subtitle"], f"from {row['requested_by']}" if row["requested_by"] else "") if part),
            route=row["route"] or "/approvals", waiting_since=row["submitted_at"], today=today,
        )
        # Approvals have no due date; anything waiting over three days counts as overdue.
        item["overdue"] = waiting > STALE_APPROVAL
        items.append(item)
    return items


def _to_do(institution, user, employee, permissions, today):
    from apps.documents.policies import OVERDUE, PENDING, policies_for_employee
    from apps.employees.lifecycle import employee_can_complete, policy_items_are_automatic
    from apps.employees.models import LifecycleTask
    from apps.performance.models import PerformanceReview
    from apps.training.models import TrainingEnrollment

    items = []
    if employee is not None:
        for policy, status, due, _ in policies_for_employee(institution, employee, today=today):
            if status in (PENDING, OVERDUE):
                items.append(_item(kind="policy", key=policy.id, title=f"Read and sign: {policy.title}", subtitle=policy.get_category_display(), route="/me/policies", due_date=due, today=today))
        from apps.documents.models import SignatureRequest

        for request in SignatureRequest.objects.for_institution(institution).filter(employee=employee, status=SignatureRequest.Status.PENDING):
            items.append(_item(kind="signature", key=request.id, title=f"Sign: {request.title}", subtitle="Document from HR", route="/me/documents", due_date=request.due_date, today=today))
        tasks = list(LifecycleTask.objects.filter(institution=institution, employee=employee, status=LifecycleTask.Status.OPEN, owner="EMPLOYEE").select_related("onboarding", "offboarding"))
        automatic = policy_items_are_automatic(institution, employee) if tasks else False
        for task in tasks:
            if employee_can_complete(task, policy_automatic=automatic):
                items.append(_item(kind="checklist.own", key=task.id, title=task.title, subtitle=f"Your {task.process.label.lower()} checklist", route="/me", due_date=task.due_date, today=today))
        for review in PerformanceReview.objects.for_institution(institution).filter(employee=employee, status=PerformanceReview.Status.SELF_ASSESSMENT).select_related("cycle"):
            items.append(_item(kind="review.self", key=review.id, title=f"Write your self-assessment: {review.cycle.name}", subtitle="Performance review", route=f"/reviews/{review.id}", due_date=review.cycle.self_assessment_due, today=today))
        enrollments = TrainingEnrollment.objects.for_institution(institution).filter(employee=employee).select_related("course")
        for enrollment in enrollments.filter(status__in=(TrainingEnrollment.Status.PLANNED, TrainingEnrollment.Status.IN_PROGRESS)):
            items.append(_item(kind="training", key=enrollment.id, title=f"Complete training: {enrollment.course.title}", subtitle=enrollment.get_status_display(), route="/me/training", due_date=enrollment.planned_end, today=today))
        renew_by = today + timedelta(days=30)
        for enrollment in enrollments.filter(status=TrainingEnrollment.Status.COMPLETED, certificate_expires_on__isnull=False, certificate_expires_on__lte=renew_by):
            items.append(_item(kind="training.renewal", key=enrollment.id, title=f"Renew certificate: {enrollment.course.title}", subtitle="Expired" if enrollment.certificate_expires_on < today else "Expires soon", route="/me/training", due_date=enrollment.certificate_expires_on, today=today))
    if employee is not None:
        from apps.scheduling.models import ShiftSwap

        for swap in ShiftSwap.objects.for_institution(institution).filter(counterpart=employee, status=ShiftSwap.Status.AWAITING_COLLEAGUE).select_related("requester"):
            items.append(_item(kind="swap.answer", key=swap.id, title=f"Answer {swap.requester.full_name}'s shift swap", subtitle=f"{swap.swap_date:%a %d %b}: you'd work {swap.requester_shift_label}", route="/me/attendance/swaps", due_date=swap.swap_date, today=today))
    from apps.performance.models import FeedbackRequest

    feedback = FeedbackRequest.objects.for_institution(institution).filter(
        respondent=user, status=FeedbackRequest.Status.PENDING, review__status__in=PerformanceReview.OPEN_STATUSES,
    ).select_related("review__employee", "review__cycle")
    for request in feedback:
        items.append(_item(kind="feedback.give", key=request.id, title=f"Give feedback on {request.review.employee.full_name}", subtitle=f"360 feedback · {request.review.cycle.name}", route="/feedback", due_date=request.review.cycle.manager_review_due, today=today))
    reviews = PerformanceReview.objects.for_institution(institution).filter(reviewer=user, status=PerformanceReview.Status.MANAGER_REVIEW).select_related("cycle", "employee")
    for review in reviews:
        items.append(_item(kind="review.manager", key=review.id, title=f"Review {review.employee.full_name}", subtitle=review.cycle.name, route=f"/reviews/{review.id}", due_date=review.cycle.manager_review_due, today=today))
    if "performance.manage" in permissions:
        for review in PerformanceReview.objects.for_institution(institution).filter(status=PerformanceReview.Status.HR_REVIEW).exclude(employee__user=user).select_related("cycle", "employee"):
            items.append(_item(kind="review.signoff", key=review.id, title=f"Sign off {review.employee.full_name}'s review", subtitle=review.cycle.name, route=f"/reviews/{review.id}", today=today))
    return items


def _team(request, institution, user, permissions, today):
    from apps.employees.models import EmployeeOffboarding, EmployeeOnboarding, LifecycleTask, LifecycleTaskOwner
    from common.scoping import scope_to_employees

    if "employee.update" not in permissions and "dashboard.department.view" not in permissions:
        return []
    employees = scope_to_employees(Employee.objects.for_institution(institution), request, "").exclude(user=user)
    tasks = LifecycleTask.objects.filter(institution=institution, employee__in=employees, status=LifecycleTask.Status.OPEN).exclude(
        onboarding__status__in=("COMPLETED", "CANCELLED")
    ).exclude(offboarding__status__in=("COMPLETED", "CANCELLED")).select_related("employee", "onboarding", "offboarding")
    if "employee.update" in permissions:
        tasks = tasks.exclude(owner=LifecycleTaskOwner.EMPLOYEE)
    else:
        tasks = tasks.filter(owner=LifecycleTaskOwner.MANAGER)
    items = [
        _item(
            kind="checklist.team", key=task.id, title=task.title,
            subtitle=f"{task.employee.full_name} · {task.process.label.lower()} · {task.get_owner_display()}",
            route=f"/hr/employees/{task.employee_id}?tab=overview#onboarding-offboarding", due_date=task.due_date, today=today,
        )
        for task in tasks
    ]
    if "employee.update" in permissions:
        for model, label in ((EmployeeOnboarding, "Onboarding"), (EmployeeOffboarding, "Offboarding")):
            for record in model.objects.for_institution(institution).filter(employee__in=employees, status="BLOCKED").select_related("employee"):
                items.append(_item(kind="lifecycle.blocked", key=record.id, title=f"{label} blocked: {record.employee.full_name}", subtitle=record.blocked_reason, route=f"/hr/employees/{record.employee_id}?tab=overview#onboarding-offboarding", today=today))
    return items


def _waiting(institution, user, employee, today):
    from apps.accounting.models import Expense
    from apps.attendance.models import AttendanceAdjustment
    from apps.leave.models import LeaveRequest

    if employee is None:
        return []
    items = []
    for leave in LeaveRequest.objects.for_institution(institution).filter(employee=employee, status=LeaveRequest.Status.PENDING).select_related("leave_type"):
        items.append(_item(kind="request.leave", key=leave.id, title=f"{leave.leave_type.name} request", subtitle=f"{leave.start_date:%d %b} – {leave.end_date:%d %b} · awaiting approval", route="/me/leave", waiting_since=leave.created_at, today=today))
    for adjustment in AttendanceAdjustment.objects.for_institution(institution).filter(attendance_record__employee=employee, status=AttendanceAdjustment.Status.PENDING).select_related("attendance_record"):
        items.append(_item(kind="request.attendance", key=adjustment.id, title="Attendance correction", subtitle=f"{adjustment.attendance_record.attendance_date:%d %b} · awaiting review", route="/me/attendance", waiting_since=adjustment.created_at, today=today))
    from apps.scheduling.models import ShiftSwap

    for swap in ShiftSwap.objects.for_institution(institution).filter(requester=employee, status__in=ShiftSwap.OPEN_STATUSES).select_related("counterpart"):
        items.append(_item(kind="request.swap", key=swap.id, title=f"Shift swap with {swap.counterpart.full_name}", subtitle=f"{swap.swap_date:%a %d %b} · {swap.get_status_display().lower()}", route="/me/attendance/swaps", waiting_since=swap.created_at, today=today))
    expenses = Expense.objects.for_institution(institution).filter(claimant=employee)
    for expense in expenses.filter(status__in=(Expense.Status.PENDING, Expense.Status.FINANCE_REVIEW)):
        items.append(_item(kind="request.expense", key=expense.id, title=f"Expense claim: {expense.description[:60]}", subtitle=f"{expense.get_status_display()} · {expense.currency} {expense.amount:,.2f}", route="/me/expenses", waiting_since=expense.created_at, today=today))
    return items


def _returned_expenses(institution, employee, today):
    from apps.accounting.models import Expense

    if employee is None:
        return []
    return [
        _item(kind="request.expense.returned", key=expense.id, title=f"Fix and resubmit: {expense.description[:60]}", subtitle=f"Returned for changes{': ' + expense.decision_note[:80] if expense.decision_note else ''}", route="/me/expenses", waiting_since=expense.updated_at, today=today)
        for expense in Expense.objects.for_institution(institution).filter(claimant=employee, status=Expense.Status.RETURNED)
    ]


def my_work(request, *, permission_codes):
    institution, user = request.institution, request.user
    permissions = set(permission_codes)
    today = timezone.localdate()
    employee = Employee.objects.for_institution(institution).filter(user=user).first()
    enabled = set(institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))

    to_do = _to_do(institution, user, employee, permissions, today)
    if "ACCOUNTING" in enabled:
        to_do += _returned_expenses(institution, employee, today)
    waiting = _waiting(institution, user, employee, today) if employee is not None else []
    if "ACCOUNTING" not in enabled:
        waiting = [row for row in waiting if row["kind"] != "request.expense"]
    if "LEAVE" not in enabled:
        waiting = [row for row in waiting if row["kind"] != "request.leave"]
    if "ATTENDANCE" not in enabled:
        waiting = [row for row in waiting if row["kind"] not in ("request.attendance", "request.swap")]
        to_do = [row for row in to_do if row["kind"] != "swap.answer"]

    sections = [
        _section("approvals", "Approvals", "Requests waiting for your decision. Open one to approve, reject or ask for changes; anything waiting more than three days is flagged.", _approvals(request, permission_codes, today), route="/approvals"),
        _section("to_do", "Your tasks", "Things only you can do: policies to sign, your checklist items, reviews to write and training to finish.", to_do),
        _section("team", "Team onboarding & offboarding", "Checklist items for people joining or leaving. Tick them off on the employee's record.", _team(request, institution, user, permissions, today)),
        _section("waiting", "Waiting on others", "Your requests that someone else still has to act on. Nothing to do unless it has been waiting too long.", waiting),
    ]
    sections = [section for section in sections if section["count"] or section["key"] in ("approvals", "to_do")]
    actionable = [section for section in sections if section["key"] != "waiting"]
    return {
        "generated_at": timezone.now(),
        "summary": {
            "total": sum(section["count"] for section in actionable),
            "overdue": sum(section["overdue"] for section in actionable),
            "due_soon": sum(1 for section in actionable for row in section["items"] if row["due_soon"]),
            "waiting_on_others": next((section["count"] for section in sections if section["key"] == "waiting"), 0),
        },
        "sections": sections,
    }
