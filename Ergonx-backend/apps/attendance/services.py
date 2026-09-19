from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.audit.services import record_audit_event
from apps.attendance.models import AttendanceAdjustment, AttendanceRecord, OvertimeRecord
from apps.employees.models import Employment
from apps.institutions.models import InstitutionMembership
from apps.scheduling.services import schedule_assignment_for, schedule_expectation


def _membership(actor, institution):
    membership = (
        actor.memberships.filter(
            institution=institution, status=InstitutionMembership.Status.ACTIVE
        )
        .select_related("role")
        .prefetch_related("role__permissions")
        .first()
    )
    if membership is None:
        raise ValidationError({"actor": "Actor must be an active institution member."})
    return membership


def _can_manage(actor, employee):
    membership = _membership(actor, employee.institution)
    if employee.user_id == actor.id:
        return True
    if membership.role.permissions.filter(code="attendance.manage").exists():
        return True
    raise ValidationError({"actor": "Actor cannot manage this employee's attendance."})


def _local_date(employee, at):
    try:
        zone = ZoneInfo(employee.institution.timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValidationError({"timezone": "Institution timezone is invalid."}) from exc
    return at.astimezone(zone).date()


def _approved_leave_exists(employee, attendance_date):
    from apps.leave.models import LeaveRequest

    return LeaveRequest.objects.filter(
        employee=employee,
        status=LeaveRequest.Status.APPROVED,
        start_date__lte=attendance_date,
        end_date__gte=attendance_date,
    ).exists()


def _remote_employee(employee, attendance_date):
    employment = (
        Employment.objects.filter(
            employee=employee,
            start_date__lte=attendance_date,
        )
        .filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=attendance_date)
        )
        .select_related("location")
        .order_by("-is_current", "-start_date")
        .first()
    )
    return bool(employment and employment.location.is_remote)


def _minutes_between(later, earlier):
    return max(0, int((later - earlier).total_seconds() // 60))


def _recalculate(record):
    if not record.check_in:
        record.worked_minutes = 0
        record.late_minutes = 0
        record.early_departure_minutes = 0
        record.overtime_minutes = 0
        return record

    expectation = (
        schedule_expectation(record.schedule_assignment, record.attendance_date)
        if record.schedule_assignment_id
        else None
    )
    local_in = record.check_in
    local_out = record.check_out
    if expectation:
        local_in = record.check_in.astimezone(expectation["zone"])
        if record.check_out:
            local_out = record.check_out.astimezone(expectation["zone"])

        if expectation["off_day"]:
            record.status = AttendanceRecord.Status.OFF_DAY
            record.late_minutes = 0
            record.early_departure_minutes = 0
        else:
            flexible = expectation["flexible_rule"]
            late_threshold = expectation["start"] + timedelta(
                minutes=expectation["grace_minutes"]
            )
            early_threshold = expectation["end"]
            if flexible:
                late_threshold = datetime.combine(
                    record.attendance_date, flexible.latest_start, expectation["zone"]
                )
                early_threshold = datetime.combine(
                    record.attendance_date, flexible.earliest_end, expectation["zone"]
                )
            record.late_minutes = _minutes_between(local_in, late_threshold)
            record.early_departure_minutes = (
                _minutes_between(early_threshold, local_out) if local_out else 0
            )
            if _remote_employee(record.employee, record.attendance_date):
                record.status = AttendanceRecord.Status.REMOTE
            elif record.late_minutes:
                record.status = AttendanceRecord.Status.LATE
            else:
                record.status = AttendanceRecord.Status.PRESENT

    if record.check_out:
        gross_minutes = _minutes_between(record.check_out, record.check_in)
        break_minutes = expectation["break_minutes"] if expectation else 0
        record.worked_minutes = max(0, gross_minutes - break_minutes)
        required = expectation["required_minutes"] if expectation else record.worked_minutes
        record.overtime_minutes = max(0, record.worked_minutes - required)
        if expectation and expectation["off_day"]:
            record.overtime_minutes = record.worked_minutes
    return record


def _sync_overtime(record):
    overtime = OvertimeRecord.objects.filter(attendance_record=record).first()
    if record.overtime_minutes:
        if overtime is None:
            overtime = OvertimeRecord(
                institution=record.institution,
                employee=record.employee,
                attendance_record=record,
            )
        overtime.calculated_minutes = record.overtime_minutes
        overtime.approved_minutes = 0
        overtime.status = OvertimeRecord.Status.PENDING
        overtime.approved_by = None
        overtime.approved_at = None
        overtime.save()
    elif overtime:
        overtime.calculated_minutes = 0
        overtime.approved_minutes = 0
        overtime.status = OvertimeRecord.Status.REJECTED
        overtime.approved_by = None
        overtime.approved_at = None
        overtime.save()


@transaction.atomic
def clock_in(*, employee, actor, at=None, source=AttendanceRecord.Source.WEB):
    _can_manage(actor, employee)
    at = at or timezone.now()
    attendance_date = _local_date(employee, at)
    if _approved_leave_exists(employee, attendance_date):
        raise ValidationError({"attendance_date": "Employee is on approved leave."})
    assignment = schedule_assignment_for(employee, attendance_date)
    if assignment is None:
        raise ValidationError({"schedule_assignment": "No schedule covers this date."})
    record, _ = AttendanceRecord.objects.select_for_update().get_or_create(
        institution=employee.institution,
        employee=employee,
        attendance_date=attendance_date,
        schedule_assignment=assignment,
        defaults={
            "status": AttendanceRecord.Status.PRESENT,
            "source": source,
        },
    )
    if record.check_in:
        raise ValidationError({"check_in": "Employee is already checked in for this date."})
    record.check_in = at
    record.source = source
    _recalculate(record)
    record.save()
    record_audit_event(
        actor=actor,
        institution=record.institution,
        entity=record,
        action="attendance.clocked_in",
        metadata={"source": source},
    )
    return record


@transaction.atomic
def clock_out(*, attendance_record, actor, at=None):
    # PostgreSQL cannot apply FOR UPDATE to the nullable side of the
    # schedule_assignment outer join. Lock only the attendance row and allow
    # related objects to load separately inside the same transaction.
    attendance_record = AttendanceRecord.objects.select_for_update().get(
        pk=attendance_record.pk
    )
    _can_manage(actor, attendance_record.employee)
    if attendance_record.check_in is None:
        raise ValidationError({"check_out": "Cannot check out before checking in."})
    if attendance_record.check_out is not None:
        raise ValidationError({"check_out": "Employee is already checked out."})
    attendance_record.check_out = at or timezone.now()
    _recalculate(attendance_record)
    attendance_record.save()
    _sync_overtime(attendance_record)
    record_audit_event(
        actor=actor,
        institution=attendance_record.institution,
        entity=attendance_record,
        action="attendance.clocked_out",
        metadata={"worked_minutes": attendance_record.worked_minutes},
    )
    return attendance_record


@transaction.atomic
def classify_attendance_date(*, employee, attendance_date, actor):
    membership = _membership(actor, employee.institution)
    if not membership.role.permissions.filter(code="attendance.manage").exists():
        raise ValidationError({"actor": "Actor cannot classify attendance."})
    assignment = schedule_assignment_for(employee, attendance_date)
    if assignment is None:
        raise ValidationError({"schedule_assignment": "No schedule covers this date."})
    expectation = schedule_expectation(assignment, attendance_date)
    if _approved_leave_exists(employee, attendance_date):
        status = AttendanceRecord.Status.ON_LEAVE
    elif expectation["off_day"]:
        status = AttendanceRecord.Status.OFF_DAY
    else:
        status = AttendanceRecord.Status.ABSENT
    record, created = AttendanceRecord.objects.get_or_create(
        institution=employee.institution,
        employee=employee,
        attendance_date=attendance_date,
        schedule_assignment=assignment,
        defaults={"status": status, "source": AttendanceRecord.Source.API},
    )
    if not created and not record.check_in:
        record.status = status
        record.save(update_fields=("status", "updated_at"))
    record_audit_event(
        actor=actor,
        institution=record.institution,
        entity=record,
        action="attendance.date_classified",
        metadata={"status": record.status},
    )
    return record


@transaction.atomic
def request_adjustment(*, institution, attendance_record, actor, reason, proposed_values):
    _can_manage(actor, attendance_record.employee)
    if attendance_record.institution_id != institution.id:
        raise ValidationError(
            {"attendance_record": "Attendance record belongs to another institution."}
        )
    allowed_fields = {"check_in", "check_out", "notes"}
    unexpected = set(proposed_values) - allowed_fields
    if unexpected:
        raise ValidationError(
            {"proposed_values": f"Unsupported attendance fields: {', '.join(sorted(unexpected))}."}
        )
    old_values = {
        "check_in": attendance_record.check_in.isoformat() if attendance_record.check_in else None,
        "check_out": attendance_record.check_out.isoformat() if attendance_record.check_out else None,
        "notes": attendance_record.notes,
    }
    adjustment = AttendanceAdjustment(
        institution=institution,
        attendance_record=attendance_record,
        requested_by=actor,
        reason=reason,
        old_values=old_values,
        proposed_values=proposed_values,
        status=AttendanceAdjustment.Status.PENDING,
    )
    adjustment.save()
    record_audit_event(
        actor=actor,
        institution=institution,
        entity=adjustment,
        action="attendance.adjustment.requested",
    )
    return adjustment


def _coerce_datetime(value, field_name):
    if value is None or isinstance(value, datetime):
        return value
    parsed = parse_datetime(value)
    if parsed is None:
        raise ValidationError({"proposed_values": f"{field_name} must be ISO-8601."})
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


@transaction.atomic
def decide_adjustment(*, adjustment, actor, approve):
    adjustment = AttendanceAdjustment.objects.select_for_update().select_related(
        "attendance_record__employee"
    ).get(pk=adjustment.pk)
    membership = _membership(actor, adjustment.institution)
    if not membership.role.permissions.filter(code="attendance.approve").exists():
        raise ValidationError({"actor": "Actor cannot decide attendance adjustments."})
    if adjustment.status != AttendanceAdjustment.Status.PENDING:
        raise ValidationError({"status": "Only pending adjustments can be decided."})
    if approve:
        record = AttendanceRecord.objects.select_for_update().get(
            pk=adjustment.attendance_record_id
        )
        for field_name, value in adjustment.proposed_values.items():
            if field_name in {"check_in", "check_out"}:
                value = _coerce_datetime(value, field_name)
            setattr(record, field_name, value)
        _recalculate(record)
        record.save()
        _sync_overtime(record)
        adjustment.status = AttendanceAdjustment.Status.APPROVED
    else:
        adjustment.status = AttendanceAdjustment.Status.REJECTED
    adjustment.approved_by = actor
    adjustment.acted_at = timezone.now()
    adjustment.save(update_fields=("status", "approved_by", "acted_at", "updated_at"))
    record_audit_event(
        actor=actor,
        institution=adjustment.institution,
        entity=adjustment,
        action="attendance.adjustment.decided",
        metadata={"status": adjustment.status},
    )
    return adjustment


@transaction.atomic
def decide_overtime(*, overtime_record, actor, approve, approved_minutes=None):
    overtime_record = OvertimeRecord.objects.select_for_update().get(pk=overtime_record.pk)
    membership = _membership(actor, overtime_record.institution)
    if not membership.role.permissions.filter(code="attendance.approve").exists():
        raise ValidationError({"actor": "Actor cannot approve overtime."})
    if overtime_record.status != OvertimeRecord.Status.PENDING:
        raise ValidationError({"status": "Only pending overtime can be decided."})
    if approve:
        overtime_record.status = OvertimeRecord.Status.APPROVED
        overtime_record.approved_minutes = (
            overtime_record.calculated_minutes
            if approved_minutes is None
            else approved_minutes
        )
    else:
        overtime_record.status = OvertimeRecord.Status.REJECTED
        overtime_record.approved_minutes = 0
    overtime_record.approved_by = actor
    overtime_record.approved_at = timezone.now()
    overtime_record.save()
    record_audit_event(
        actor=actor,
        institution=overtime_record.institution,
        entity=overtime_record,
        action="attendance.overtime.decided",
        metadata={
            "status": overtime_record.status,
            "approved_minutes": overtime_record.approved_minutes,
        },
    )
    return overtime_record
