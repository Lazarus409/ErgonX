"""Shift swaps: request, colleague answer, approval.

Rules: the swap is for one date, from today up to ``MAX_DAYS_AHEAD`` days out;
both people must have a schedule that date, their days must differ (swapping
identical shifts changes nothing), neither may already have clocked in, and
neither may have another open or approved swap that date. The approver needs
``attendance.approve``, must have both people in their data scope, and cannot
be either of them.
"""

from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.employees.models import Employee
from apps.scheduling.models import ShiftSwap
from apps.scheduling.services import schedule_assignment_for, schedule_expectation

MAX_DAYS_AHEAD = 90


def shift_label(employee, swap_date):
    """A short description of what the employee is due to work on the date, ignoring swaps."""
    assignment = schedule_assignment_for(employee, swap_date)
    if assignment is None:
        return None
    try:
        expectation = schedule_expectation(assignment, swap_date, apply_swaps=False)
    except ValidationError:
        return None
    if expectation["off_day"]:
        return "Off day"
    if expectation["flexible_rule"]:
        return f"Flexible, {expectation['required_minutes'] // 60} h"
    start, end = expectation["start"], expectation["end"]
    return f"{assignment.work_schedule.name} {start:%H:%M}–{end:%H:%M}"


def _busy(employee, swap_date, *, exclude=None):
    swaps = ShiftSwap.objects.filter(swap_date=swap_date, status__in=(*ShiftSwap.OPEN_STATUSES, ShiftSwap.Status.APPROVED)).filter(
        Q(requester=employee) | Q(counterpart=employee)
    )
    if exclude is not None:
        swaps = swaps.exclude(pk=exclude.pk)
    return swaps.exists()


def _clocked(employee, swap_date):
    from apps.attendance.models import AttendanceRecord

    return AttendanceRecord.objects.filter(employee=employee, attendance_date=swap_date, check_in__isnull=False).exists()


def validate_pair(requester, counterpart, swap_date, *, exclude=None):
    """Returns ``(requester_label, counterpart_label)`` or raises with a reason people can act on."""
    today = timezone.localdate()
    if requester.pk == counterpart.pk:
        raise ValidationError({"counterpart": "Choose a colleague other than yourself."})
    if counterpart.institution_id != requester.institution_id or counterpart.status != Employee.Status.ACTIVE:
        raise ValidationError({"counterpart": "Choose an active colleague."})
    if swap_date < today:
        raise ValidationError({"swap_date": "Choose today or a later date."})
    if swap_date > today + timedelta(days=MAX_DAYS_AHEAD):
        raise ValidationError({"swap_date": f"Swaps can be arranged up to {MAX_DAYS_AHEAD} days ahead."})
    mine, theirs = shift_label(requester, swap_date), shift_label(counterpart, swap_date)
    if mine is None:
        raise ValidationError({"swap_date": "You have no schedule on this date."})
    if theirs is None:
        raise ValidationError({"counterpart": f"{counterpart.full_name} has no schedule on this date."})
    if mine == theirs:
        raise ValidationError({"counterpart": f"You and {counterpart.first_name} are both on {mine} that day, so there is nothing to swap."})
    for employee in (requester, counterpart):
        if _busy(employee, swap_date, exclude=exclude):
            raise ValidationError({"swap_date": f"{employee.full_name} already has a shift swap on this date."})
        if _clocked(employee, swap_date):
            raise ValidationError({"swap_date": f"{employee.full_name} has already clocked in on this date."})
    return mine, theirs


@transaction.atomic
def request_swap(*, institution, requester, counterpart, swap_date, reason, actor):
    mine, theirs = validate_pair(requester, counterpart, swap_date)
    swap = ShiftSwap(
        institution=institution, requester=requester, counterpart=counterpart, swap_date=swap_date, reason=(reason or "").strip(),
        requester_shift_label=mine, counterpart_shift_label=theirs,
    )
    swap.save()
    record_audit_event(actor=actor, institution=institution, entity=swap, action="shift_swap.requested", metadata={"swap_date": str(swap_date), "counterpart_id": str(counterpart.id)})
    _notify(swap, counterpart.user, "Shift swap request", f"{requester.full_name} asks to swap shifts with you on {swap_date:%a %d %b}: you would work {mine} instead of {theirs}.")
    return swap


def _locked(swap):
    return ShiftSwap.objects.select_for_update().select_related("requester", "counterpart").get(pk=swap.pk)


@transaction.atomic
def answer_swap(*, swap, actor, accept, note=""):
    swap = _locked(swap)
    if swap.counterpart.user_id != actor.id:
        raise ValidationError({"swap": "Only the colleague asked can answer this request."})
    if swap.status != ShiftSwap.Status.AWAITING_COLLEAGUE:
        raise ValidationError({"swap": "This request has already been answered."})
    if accept:
        # Re-check: schedules or clocks may have changed since the request.
        validate_pair(swap.requester, swap.counterpart, swap.swap_date, exclude=swap)
    swap.status = ShiftSwap.Status.AWAITING_APPROVAL if accept else ShiftSwap.Status.DECLINED
    swap.colleague_responded_at = timezone.now()
    if note:
        swap.decision_note = note.strip()
    swap.save()
    record_audit_event(actor=actor, institution=swap.institution, entity=swap, action="shift_swap.accepted" if accept else "shift_swap.declined", metadata={"swap_date": str(swap.swap_date)})
    _notify(swap, swap.requester.user, "Shift swap accepted" if accept else "Shift swap declined",
            f"{swap.counterpart.full_name} {'accepted' if accept else 'declined'} your swap for {swap.swap_date:%a %d %b}." + (" It now needs approval." if accept else ""))
    return swap


@transaction.atomic
def decide_swap(*, swap, actor, approve, note="", in_scope):
    """``in_scope`` is whether the approver's data scope covers both people (checked by the view)."""
    swap = _locked(swap)
    if actor.id in (swap.requester.user_id, swap.counterpart.user_id):
        raise ValidationError({"swap": "You are part of this swap; another approver must decide it."})
    if not in_scope:
        raise ValidationError({"swap": "Both people must be within your team or scope to decide this swap."})
    if swap.status != ShiftSwap.Status.AWAITING_APPROVAL:
        raise ValidationError({"swap": "This swap is not waiting for approval."})
    if approve:
        validate_pair(swap.requester, swap.counterpart, swap.swap_date, exclude=swap)
    elif not (note or "").strip():
        raise ValidationError({"note": "Give a reason for rejecting the swap."})
    swap.status = ShiftSwap.Status.APPROVED if approve else ShiftSwap.Status.REJECTED
    swap.decided_by = actor
    swap.decided_at = timezone.now()
    swap.decision_note = (note or "").strip()
    swap.save()
    record_audit_event(actor=actor, institution=swap.institution, entity=swap, action="shift_swap.approved" if approve else "shift_swap.rejected", metadata={"swap_date": str(swap.swap_date), "note": swap.decision_note})
    text = f"The shift swap between {swap.requester.full_name} and {swap.counterpart.full_name} on {swap.swap_date:%a %d %b} was {'approved' if approve else 'rejected'}."
    for user in (swap.requester.user, swap.counterpart.user):
        _notify(swap, user, "Shift swap approved" if approve else "Shift swap rejected", text)
    return swap


@transaction.atomic
def cancel_swap(*, swap, actor):
    swap = _locked(swap)
    if actor.id not in (swap.requester.user_id, swap.counterpart.user_id):
        raise ValidationError({"swap": "Only the two people in the swap can cancel it."})
    if swap.status not in (*ShiftSwap.OPEN_STATUSES, ShiftSwap.Status.APPROVED):
        raise ValidationError({"swap": "This swap is already closed."})
    if swap.status == ShiftSwap.Status.APPROVED and (swap.swap_date <= timezone.localdate() or _clocked(swap.requester, swap.swap_date) or _clocked(swap.counterpart, swap.swap_date)):
        raise ValidationError({"swap": "An approved swap can be cancelled only before its date."})
    swap.status = ShiftSwap.Status.CANCELLED
    swap.save()
    record_audit_event(actor=actor, institution=swap.institution, entity=swap, action="shift_swap.cancelled", metadata={"swap_date": str(swap.swap_date)})
    other = swap.counterpart.user if actor.id == swap.requester.user_id else swap.requester.user
    _notify(swap, other, "Shift swap cancelled", f"The shift swap on {swap.swap_date:%a %d %b} was cancelled.")
    return swap


def _notify(swap, user, title, message):
    from apps.notifications.models import Notification

    if user is None:
        return
    Notification.objects.create(
        institution=swap.institution, user=user, notification_type="ATTENDANCE_SHIFT_SWAP", title=title, message=message,
        channel=Notification.Channel.IN_APP, metadata={"shift_swap_id": str(swap.id), "route_hint": "/me/attendance/swaps"},
    )
