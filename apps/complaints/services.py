from collections import Counter

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
import mimetypes

from django.conf import settings

from apps.complaints.models import Complaint, ComplaintAttachment, ComplaintNote
from apps.employees.models import Employee
from apps.institutions.models import InstitutionMembership
from apps.notifications.models import Notification

Status = Complaint.Status
# Open complaints older than this are flagged as overdue on the HR overview.
OVERDUE_DAYS = 30


def has_permission(user, institution, code):
    return user is not None and InstitutionMembership.objects.filter(
        institution=institution, user=user, status=InstitutionMembership.Status.ACTIVE, role__permissions__code=code
    ).exists()


def is_named(complaint, user):
    """Whether ``user`` is the complainant or the person the complaint is about."""
    return user is not None and user.id in {complaint.complainant.user_id, complaint.respondent.user_id if complaint.respondent_id else None}


def handlers(institution, complaint=None):
    """Active members who handle complaints, leaving out anyone the complaint names."""
    memberships = InstitutionMembership.objects.filter(
        institution=institution, status=InstitutionMembership.Status.ACTIVE, role__permissions__code="complaint.manage"
    ).select_related("user").distinct()
    users = {membership.user for membership in memberships}
    if complaint is not None:
        users = {user for user in users if not is_named(complaint, user)}
    return sorted(users, key=lambda user: user.email)


def _notify(user, complaint, notification_type, title, message):
    if user is None:
        return
    Notification.objects.create(
        institution=complaint.institution, user=user, notification_type=notification_type, title=title, message=message,
        channel=Notification.Channel.IN_APP, metadata={"complaint_id": str(complaint.id), "route_hint": f"/complaints/{complaint.id}"},
    )


def _audit(complaint, actor, action, **metadata):
    # Never copy the complaint's text into the audit trail: it is confidential.
    record_audit_event(actor=actor, institution=complaint.institution, entity=complaint, action=f"complaint.{action}",
                       metadata={"code": complaint.code, "category": complaint.category, **metadata})


def _lock(complaint):
    return Complaint.objects.select_for_update(of=("self",)).select_related("complainant", "respondent", "assigned_to").get(pk=complaint.pk)


def _require_handler(complaint, actor):
    if not has_permission(actor, complaint.institution, "complaint.manage"):
        raise ValidationError({"actor": "Only HR can do this."})
    if is_named(complaint, actor):
        raise ValidationError({"actor": "You are named in this complaint, so another member of HR must handle it."})


@transaction.atomic
def file_complaint(*, institution, actor, category, subject, description, incident_date=None, incident_location="", respondent=None, respondent_description=""):
    complainant = Employee.objects.for_institution(institution).filter(user=actor).first()
    if complainant is None:
        raise ValidationError({"actor": "Only employees with an employee record can file a complaint."})
    complaint = Complaint.objects.create(
        institution=institution, complainant=complainant, respondent=respondent, respondent_description=(respondent_description or "").strip(),
        category=category, subject=subject, description=description, incident_date=incident_date, incident_location=(incident_location or "").strip(),
    )
    _audit(complaint, actor, "filed")
    for user in handlers(institution, complaint):
        _notify(user, complaint, "COMPLAINT_FILED", "New complaint", f"{complaint.code} · {complaint.get_category_display()}.")
    return complaint


@transaction.atomic
def assign_complaint(*, complaint, actor, assignee):
    complaint = _lock(complaint)
    _require_handler(complaint, actor)
    if complaint.status not in Complaint.OPEN_STATUSES:
        raise ValidationError({"status": "Only open complaints can be assigned."})
    if not has_permission(assignee, complaint.institution, "complaint.manage"):
        raise ValidationError({"assignee": "Assign the complaint to a member of HR who handles complaints."})
    if is_named(complaint, assignee):
        raise ValidationError({"assignee": "This person is named in the complaint."})
    previous = complaint.assigned_to
    complaint.assigned_to = assignee
    if complaint.status == Status.SUBMITTED:
        complaint.status = Status.UNDER_REVIEW
        _notify(complaint.complainant.user, complaint, "COMPLAINT_UPDATED", "Your complaint is being reviewed", f"{complaint.code}: HR has started reviewing your complaint.")
    complaint.save()
    _audit(complaint, actor, "assigned", assignee_id=str(assignee.id), previous_assignee_id=str(previous.id) if previous else "")
    if assignee.id != actor.id:
        _notify(assignee, complaint, "COMPLAINT_ASSIGNED", "Complaint assigned to you", f"{complaint.code} · {complaint.get_category_display()}.")
    return complaint


@transaction.atomic
def set_priority(*, complaint, actor, priority):
    complaint = _lock(complaint)
    _require_handler(complaint, actor)
    if priority not in Complaint.Priority.values:
        raise ValidationError({"priority": "Choose a valid priority."})
    if complaint.status not in Complaint.OPEN_STATUSES:
        raise ValidationError({"status": "Only open complaints can be re-prioritised."})
    previous = complaint.priority
    complaint.priority = priority
    complaint.save(update_fields=("priority", "updated_at"))
    _audit(complaint, actor, "priority_changed", priority=priority, previous=previous)
    return complaint


@transaction.atomic
def start_investigation(*, complaint, actor):
    complaint = _lock(complaint)
    _require_handler(complaint, actor)
    if complaint.status not in (Status.SUBMITTED, Status.UNDER_REVIEW):
        raise ValidationError({"status": "Only a submitted or reviewed complaint can move to investigation."})
    complaint.status = Status.INVESTIGATING
    if complaint.assigned_to_id is None:
        complaint.assigned_to = actor
    complaint.save()
    _audit(complaint, actor, "investigation_started")
    _notify(complaint.complainant.user, complaint, "COMPLAINT_UPDATED", "Your complaint is being investigated", f"{complaint.code}: HR is investigating your complaint.")
    return complaint


@transaction.atomic
def resolve_complaint(*, complaint, actor, resolution):
    complaint = _lock(complaint)
    _require_handler(complaint, actor)
    if complaint.status not in (Status.UNDER_REVIEW, Status.INVESTIGATING):
        raise ValidationError({"status": "Only a complaint under review or investigation can be resolved."})
    if not (resolution or "").strip():
        raise ValidationError({"resolution": "Record the outcome and any action taken."})
    complaint.status = Status.RESOLVED
    complaint.resolution = resolution.strip()
    complaint.resolved_at = timezone.now()
    complaint.resolved_by = actor
    complaint.save()
    _audit(complaint, actor, "resolved")
    _notify(complaint.complainant.user, complaint, "COMPLAINT_RESOLVED", "Your complaint has been resolved", f"{complaint.code}: see the outcome recorded by HR.")
    return complaint


@transaction.atomic
def reopen_complaint(*, complaint, actor, reason):
    complaint = _lock(complaint)
    _require_handler(complaint, actor)
    if complaint.status != Status.RESOLVED:
        raise ValidationError({"status": "Only a resolved complaint can be reopened."})
    if not (reason or "").strip():
        raise ValidationError({"reason": "Explain why the complaint is reopened."})
    complaint.status = Status.INVESTIGATING
    complaint.resolved_at = None
    complaint.resolved_by = None
    complaint.save()
    ComplaintNote.objects.create(institution=complaint.institution, complaint=complaint, author=actor, body=f"Reopened: {reason.strip()}", is_internal=True)
    _audit(complaint, actor, "reopened")
    _notify(complaint.complainant.user, complaint, "COMPLAINT_UPDATED", "Your complaint was reopened", f"{complaint.code}: HR is looking into it again.")
    return complaint


@transaction.atomic
def close_complaint(*, complaint, actor):
    complaint = _lock(complaint)
    _require_handler(complaint, actor)
    if complaint.status != Status.RESOLVED:
        raise ValidationError({"status": "Resolve the complaint before closing it."})
    complaint.status = Status.CLOSED
    complaint.closed_at = timezone.now()
    complaint.save(update_fields=("status", "closed_at", "updated_at"))
    _audit(complaint, actor, "closed")
    return complaint


@transaction.atomic
def withdraw_complaint(*, complaint, actor, reason=""):
    complaint = _lock(complaint)
    if complaint.complainant.user_id != actor.id:
        raise ValidationError({"actor": "Only the employee who filed the complaint can withdraw it."})
    if complaint.status not in Complaint.OPEN_STATUSES:
        raise ValidationError({"status": "Only an open complaint can be withdrawn."})
    complaint.status = Status.WITHDRAWN
    complaint.withdrawn_at = timezone.now()
    complaint.save(update_fields=("status", "withdrawn_at", "updated_at"))
    if (reason or "").strip():
        ComplaintNote.objects.create(institution=complaint.institution, complaint=complaint, author=actor, body=f"Withdrawn: {reason.strip()}", is_internal=False)
    _audit(complaint, actor, "withdrawn")
    recipients = [complaint.assigned_to] if complaint.assigned_to_id else handlers(complaint.institution, complaint)
    for user in recipients:
        _notify(user, complaint, "COMPLAINT_UPDATED", "Complaint withdrawn", f"{complaint.code} was withdrawn by the employee.")
    return complaint


def _require_participant(complaint, actor, internal):
    """The employee who filed it may add shared items while it is open or resolved; HR handlers until it is withdrawn."""
    if complaint.complainant.user_id == actor.id:
        if internal:
            raise ValidationError({"is_internal": "What you add is always shared with HR."})
        if complaint.status not in (*Complaint.OPEN_STATUSES, Status.RESOLVED):
            raise ValidationError({"status": "This complaint is no longer open for messages."})
        return True
    _require_handler(complaint, actor)
    if complaint.status == Status.WITHDRAWN:
        raise ValidationError({"status": "This complaint was withdrawn."})
    return False


@transaction.atomic
def add_attachment(*, complaint, actor, uploaded_file, internal=False):
    complaint = _lock(complaint)
    is_complainant = _require_participant(complaint, actor, internal)
    max_bytes = settings.DOCUMENT_UPLOAD_MAX_BYTES
    if uploaded_file.size > max_bytes:
        raise ValidationError({"file": f"Files must be {max_bytes // (1024 * 1024)} MB or smaller."})
    if complaint.attachments.count() >= ComplaintAttachment.MAX_PER_COMPLAINT:
        raise ValidationError({"file": f"A complaint can hold at most {ComplaintAttachment.MAX_PER_COMPLAINT} files."})
    name = (uploaded_file.name or "file").replace("\\", "/").rsplit("/", 1)[-1][:255] or "file"
    content_type = (uploaded_file.content_type or "").lower().split(";")[0].strip()
    if not content_type or content_type == "application/octet-stream":
        content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    attachment = ComplaintAttachment.objects.create(
        institution=complaint.institution, complaint=complaint, stored_file=uploaded_file, original_filename=name,
        content_type=content_type[:150], size_bytes=uploaded_file.size, uploaded_by=actor, is_internal=internal,
    )
    # The file name can itself be revealing, so only its type and size are audited.
    _audit(complaint, actor, "attachment_added", internal=internal, content_type=attachment.content_type, size_bytes=attachment.size_bytes)
    if not internal:
        if is_complainant:
            for user in [complaint.assigned_to] if complaint.assigned_to_id else handlers(complaint.institution, complaint):
                _notify(user, complaint, "COMPLAINT_MESSAGE", "New file on a complaint", f"{complaint.code}: the employee attached a file.")
        else:
            _notify(complaint.complainant.user, complaint, "COMPLAINT_MESSAGE", "HR shared a file on your complaint", f"{complaint.code}: HR attached a file.")
    return attachment


@transaction.atomic
def add_note(*, complaint, actor, body, internal=False):
    """HR adds internal or shared notes; the employee who filed it adds shared notes while it is open."""
    complaint = _lock(complaint)
    is_complainant = _require_participant(complaint, actor, internal)
    note = ComplaintNote.objects.create(institution=complaint.institution, complaint=complaint, author=actor, body=body, is_internal=internal)
    _audit(complaint, actor, "note_added", internal=internal)
    if not internal:
        if is_complainant:
            recipients = [complaint.assigned_to] if complaint.assigned_to_id else handlers(complaint.institution, complaint)
            for user in recipients:
                _notify(user, complaint, "COMPLAINT_MESSAGE", "New message on a complaint", f"{complaint.code}: the employee added a message.")
        else:
            _notify(complaint.complainant.user, complaint, "COMPLAINT_MESSAGE", "HR replied to your complaint", f"{complaint.code}: you have a new message from HR.")
    return note


def complaint_overview(complaints, today=None):
    """Counts for the HR complaints workspace."""
    today = today or timezone.localdate()
    rows = list(complaints.select_related(None).only("status", "category", "priority", "created_at", "resolved_at"))
    open_rows = [row for row in rows if row.status in Complaint.OPEN_STATUSES]
    resolved = [row for row in rows if row.resolved_at]
    statuses = Counter(row.status for row in rows)
    categories = Counter(row.category for row in rows)
    return {
        "total": len(rows),
        "open": len(open_rows),
        "urgent_open": sum(1 for row in open_rows if row.priority in (Complaint.Priority.HIGH, Complaint.Priority.URGENT)),
        "overdue": sum(1 for row in open_rows if (today - timezone.localtime(row.created_at).date()).days > OVERDUE_DAYS),
        "resolved_this_year": sum(1 for row in resolved if timezone.localtime(row.resolved_at).year == today.year),
        "average_days_to_resolve": round(sum((row.resolved_at - row.created_at).total_seconds() for row in resolved) / 86400 / len(resolved), 1) if resolved else None,
        "by_status": {status: statuses.get(status, 0) for status in Status.values},
        "by_category": [{"category": value, "label": label, "count": categories.get(value, 0)} for value, label in Complaint.Category.choices if categories.get(value)],
        "overdue_days": OVERDUE_DAYS,
    }
