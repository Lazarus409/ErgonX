"""Platform incident handling: record, update along a timeline, and close with a root cause.

Recovery targets come from settings (see docs/operations/DISASTER_RECOVERY.md):
DR_RECOVERY_TIME_OBJECTIVE_HOURS, how long the service may be down, and
DR_RECOVERY_POINT_OBJECTIVE_HOURS, how much recent data may be lost (the backup interval).
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.security.models import IncidentUpdate, SecurityIncident

Status = SecurityIncident.Status
ORDER = [Status.DETECTED, Status.INVESTIGATING, Status.CONTAINED, Status.RECOVERED, Status.CLOSED]
EDITABLE = ("title", "summary", "kind", "severity", "detected_at", "personal_data_affected", "root_cause", "lessons_learned", "lead")


def recovery_targets():
    return {
        "rto_hours": float(getattr(settings, "DR_RECOVERY_TIME_OBJECTIVE_HOURS", 4)),
        "rpo_hours": float(getattr(settings, "DR_RECOVERY_POINT_OBJECTIVE_HOURS", 24)),
    }


def timings(incident):
    """Minutes from detection to containment and recovery, and whether recovery met the target."""
    def minutes(end):
        return round((end - incident.detected_at).total_seconds() / 60) if end else None

    to_recover = minutes(incident.recovered_at)
    open_minutes = None if incident.recovered_at else minutes(timezone.now())
    rto_minutes = recovery_targets()["rto_hours"] * 60
    return {
        "minutes_to_contain": minutes(incident.contained_at),
        "minutes_to_recover": to_recover,
        "minutes_open": open_minutes,
        "within_rto": None if to_recover is None else to_recover <= rto_minutes,
    }


def _stamp(incident, status, at):
    field = {Status.CONTAINED: "contained_at", Status.RECOVERED: "recovered_at", Status.CLOSED: "closed_at"}.get(status)
    if field and getattr(incident, field) is None:
        setattr(incident, field, at)
    # Reaching a later stage implies the earlier ones.
    if status in (Status.RECOVERED, Status.CLOSED) and incident.contained_at is None:
        incident.contained_at = at
    if status == Status.CLOSED and incident.recovered_at is None:
        incident.recovered_at = at


@transaction.atomic
def record_incident(*, actor, affected_institutions=(), **values):
    incident = SecurityIncident(reported_by=actor, **{key: value for key, value in values.items() if key in EDITABLE})
    incident.full_clean(exclude=("affected_institutions",))
    incident.save()
    incident.affected_institutions.set(affected_institutions)
    IncidentUpdate.objects.create(incident=incident, note=f"Incident recorded: {incident.summary[:500]}", status=Status.DETECTED, author=actor)
    record_audit_event(actor=actor, entity=incident, action="security.incident.recorded", metadata={"kind": incident.kind, "severity": incident.severity, "organisations": len(affected_institutions)})
    return incident


@transaction.atomic
def update_incident(*, incident, actor, affected_institutions=None, **values):
    incident = SecurityIncident.objects.select_for_update().get(pk=incident.pk)
    if incident.status == Status.CLOSED:
        raise ValidationError({"status": "This incident is closed."})
    changed = [key for key, value in values.items() if key in EDITABLE and getattr(incident, key) != value]
    for key in changed:
        setattr(incident, key, values[key])
    incident.full_clean(exclude=("affected_institutions",))
    incident.save()
    if affected_institutions is not None:
        incident.affected_institutions.set(affected_institutions)
        changed.append("affected_institutions")
    if changed:
        record_audit_event(actor=actor, entity=incident, action="security.incident.updated", metadata={"fields": changed})
    return incident


@transaction.atomic
def add_update(*, incident, actor, note, status=""):
    """Add a timeline entry; a status may only move forward. Closing needs a root cause and lessons learned."""
    incident = SecurityIncident.objects.select_for_update().get(pk=incident.pk)
    if incident.status == Status.CLOSED:
        raise ValidationError({"status": "This incident is closed."})
    note = (note or "").strip()
    if not note:
        raise ValidationError({"note": "Say what was found or done."})
    if status:
        if status not in ORDER:
            raise ValidationError({"status": "Choose a valid status."})
        if ORDER.index(status) < ORDER.index(incident.status):
            raise ValidationError({"status": f"The incident is already {incident.get_status_display().lower()}; status only moves forward."})
        if status == Status.CLOSED and not (incident.root_cause.strip() and incident.lessons_learned.strip()):
            raise ValidationError({"status": "Record the root cause and lessons learned before closing."})
        now = timezone.now()
        _stamp(incident, status, now)
        incident.status = status
        incident.save()
    entry = IncidentUpdate.objects.create(incident=incident, note=note, status=status or "", author=actor)
    record_audit_event(actor=actor, entity=incident, action="security.incident.closed" if status == Status.CLOSED else "security.incident.progressed", metadata={"status": status or incident.status})
    return entry
