from collections import Counter
from datetime import datetime
from zoneinfo import ZoneInfo

from django.utils import timezone

from apps.institutions.models import UserActivityEvent, UserPreference
from apps.notifications.models import Notification


ACTION_CATALOG = {
    "employee.create": {"permission": "employee.create", "module": "CORE_HR", "label": "Add employee", "route_hint": "/hr/employees/new"},
    "leave.request": {"permission": "leave.request", "module": "LEAVE", "label": "Request leave", "route_hint": "/leave/requests/new"},
    "leave.approve": {"permission": "leave.approve", "module": "LEAVE", "label": "Review leave requests", "route_hint": "/leave/requests?status=PENDING"},
    "attendance.adjust": {"permission": "attendance.adjust", "module": "ATTENDANCE", "label": "Request attendance adjustment", "route_hint": "/attendance/adjustments/new"},
    "payroll.approve": {"permission": "payroll.approve", "module": "PAYROLL", "label": "Review payroll runs", "route_hint": "/payroll/runs?status=UNDER_REVIEW"},
    "journal.create": {"permission": "journal.create", "module": "ACCOUNTING", "label": "Create journal", "route_hint": "/accounting/journals/new"},
    "journal.approve": {"permission": "journal.approve", "module": "ACCOUNTING", "label": "Approve journals", "route_hint": "/accounting/journals?status=PENDING_APPROVAL"},
    "candidate.create": {"permission": "candidate.create", "module": "RECRUITMENT", "label": "Add candidate", "route_hint": "/recruitment/candidates/new"},
    "offer.manage": {"permission": "offer.manage", "module": "RECRUITMENT", "label": "Review offers", "route_hint": "/recruitment/offers?status=ACCEPTED"},
}


def permitted_actions(*, institution, permission_codes):
    enabled_modules = set(
        institution.modules.filter(is_enabled=True).values_list("module_code", flat=True)
    )
    permissions = set(permission_codes)
    return {
        code: {"code": code, **definition}
        for code, definition in ACTION_CATALOG.items()
        if definition["permission"] in permissions
        and (definition["module"] == "CORE_HR" or definition["module"] in enabled_modules)
    }


def _greeting_context(user, institution):
    try:
        local_now = timezone.now().astimezone(ZoneInfo(institution.timezone))
    except Exception:
        local_now = timezone.localtime()
    hour = local_now.hour
    greeting = "Good morning" if 5 <= hour < 12 else "Good afternoon" if hour < 17 else "Good evening" if hour < 22 else "Hello"
    display_name = user.first_name or user.email.split("@", 1)[0]
    return {
        "greeting": f"{greeting}, {display_name}",
        "user_display_name": display_name,
        "institution_name": institution.name,
        "institution_timezone": institution.timezone,
        "local_time": local_now.isoformat(),
    }


def _quick_actions(*, user, institution, permission_codes):
    available = permitted_actions(institution=institution, permission_codes=permission_codes)
    preference = UserPreference.objects.for_institution(institution).filter(
        user=user, preference_key="quick_actions"
    ).first()
    pinned = preference.value_json.get("pinned", []) if preference else []
    recent = UserActivityEvent.objects.for_institution(institution).filter(user=user).order_by("-occurred_at")[:30]
    frequencies = Counter(event.activity_code for event in recent if event.activity_code in available)
    ordered_codes = [code for code in pinned if code in available]
    ordered_codes.extend(
        code for code, _ in frequencies.most_common() if code not in ordered_codes
    )
    ordered_codes.extend(code for code in available if code not in ordered_codes)
    return [
        {**available[code], "is_pinned": code in pinned}
        for code in ordered_codes[:6]
    ]


def _recent_work(*, user, institution, permission_codes):
    available = permitted_actions(institution=institution, permission_codes=permission_codes)
    events = (
        UserActivityEvent.objects.for_institution(institution)
        .filter(user=user, entity_id__isnull=False)
        .order_by("-occurred_at")[:30]
    )
    rows, seen = [], set()
    for event in events:
        if event.entity_id in seen or event.activity_code not in available:
            continue
        seen.add(event.entity_id)
        rows.append({
            "type": event.entity_type or "WORK_ITEM",
            "id": event.entity_id,
            "reference": "",
            "title": available[event.activity_code]["label"],
            "status": "IN_PROGRESS",
            "resume_action": event.activity_code,
            "updated_at": event.occurred_at,
            "can_resume": True,
        })
        if len(rows) == 2:
            break
    return rows


def _attention_items(*, institution, permission_codes):
    from apps.accounting.models import JournalEntry
    from apps.leave.models import LeaveRequest
    from apps.payroll.models import PayrollRun
    from apps.recruitment.models import Interview

    permissions = set(permission_codes)
    enabled = set(institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
    items = []
    definitions = (
        ("LEAVE", "leave.approve", LeaveRequest.objects.for_institution(institution).filter(status=LeaveRequest.Status.PENDING), "LEAVE_APPROVAL_REQUIRED", "Leave requests awaiting approval", "leave.approve"),
        ("PAYROLL", "payroll.approve", PayrollRun.objects.for_institution(institution).filter(status=PayrollRun.Status.UNDER_REVIEW), "PAYROLL_APPROVAL_REQUIRED", "Payroll runs awaiting approval", "payroll.approve"),
        ("ACCOUNTING", "journal.approve", JournalEntry.objects.for_institution(institution).filter(status=JournalEntry.Status.PENDING_APPROVAL), "JOURNAL_APPROVAL_REQUIRED", "Journals awaiting approval", "journal.approve"),
        ("RECRUITMENT", "interview.manage", Interview.objects.for_institution(institution).filter(status=Interview.Status.SCHEDULED, scheduled_at__date=timezone.localdate()), "INTERVIEWS_TODAY", "Interviews scheduled today", "interview.manage"),
    )
    for module, permission, queryset, code, title, action_code in definitions:
        if module not in enabled or permission not in permissions:
            continue
        count = queryset.count()
        if count:
            items.append({"code": code, "severity": "HIGH" if "APPROVAL" in code else "NORMAL", "title": title, "description": f"{count} item(s) require attention.", "action_code": action_code, "entity_type": "", "entity_id": None, "reference": "", "due_at": None})
    return items


def home_payload(*, user, institution, permission_codes):
    unread = Notification.objects.for_institution(institution).filter(
        user=user, status__in=(Notification.Status.PENDING, Notification.Status.SENT)
    )
    return {
        "greeting_context": _greeting_context(user, institution),
        "quick_actions": _quick_actions(user=user, institution=institution, permission_codes=permission_codes),
        "recent_work": _recent_work(user=user, institution=institution, permission_codes=permission_codes),
        "attention_items": _attention_items(institution=institution, permission_codes=permission_codes),
        "notifications_summary": {"unread_count": unread.count(), "latest": list(unread.values("id", "notification_type", "title", "message", "created_at")[:5])},
        "optional_personal_snapshot": None,
    }
