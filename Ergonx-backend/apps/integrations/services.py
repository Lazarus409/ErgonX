"""Integration services: API keys, webhook delivery and calendar feeds.

Webhooks fire from the audit trail, so every module that records an action can
notify outside systems without knowing about webhooks. Payloads carry only the
event, the record's type and id, and a few non-personal facts; the receiving
system calls back with an API key for anything more. That keeps personal data
out of third-party logs by default.

Deliveries are signed: ``X-ErgonX-Signature: sha256=<hex>`` is the HMAC-SHA256
of ``"<timestamp>.<body>"`` with the endpoint's secret, and the timestamp is
sent in ``X-ErgonX-Timestamp`` so receivers can reject replays.
"""

import hashlib
import hmac
import ipaddress
import json
import secrets
import socket
import threading
from datetime import timedelta, timezone as dt_timezone
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.integrations.models import ApiKey, CalendarFeed, WebhookDelivery, WebhookEndpoint

KEY_PREFIX = "ergx"
RETRY_DELAYS = (timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=30), timedelta(hours=2), timedelta(hours=6))
DISABLE_AFTER_FAILURES = 20
TIMEOUT_SECONDS = 5

# audit action -> (webhook event, filter on the audit metadata or None, metadata keys safe to forward)
EVENTS = {
    "employee.created": ("employee.created", None, ()),
    "employee.updated": ("employee.updated", None, ()),
    "employee.onboarding.completed": ("employee.onboarded", None, ()),
    "employee.offboarding.completed": ("employee.offboarded", None, ()),
    "employee.rehired": ("employee.rehired", None, ("start_date",)),
    "leave.request.approved_step": ("leave.approved", lambda metadata: metadata.get("final_status") == "APPROVED", ()),
    "leave.request.rejected": ("leave.rejected", None, ()),
    "leave.request.cancelled": ("leave.cancelled", None, ()),
    "payroll.run.finalized": ("payroll.finalized", None, ()),
    "recruitment.application.submitted": ("application.received", None, ()),
    "recruitment.application.public_submitted": ("application.received", None, ()),
    "recruitment.offer.hired": ("candidate.hired", None, ("employee_id",)),
    "attendance.clocked_in": ("attendance.clocked_in", None, ("source",)),
    "attendance.clocked_out": ("attendance.clocked_out", None, ()),
}
EVENT_NAMES = sorted({event for event, _, _ in EVENTS.values()})


def _hash(secret):
    return hashlib.sha256(secret.encode()).hexdigest()


# ------------------------------------------------------------------ API keys


@transaction.atomic
def create_api_key(*, institution, actor, name, scopes, expires_at=None):
    prefix = secrets.token_hex(4)
    plaintext = f"{KEY_PREFIX}_{prefix}_{secrets.token_urlsafe(32)}"
    key = ApiKey(institution=institution, name=name.strip(), prefix=prefix, key_hash=_hash(plaintext), scopes=list(dict.fromkeys(scopes)), created_by=actor, expires_at=expires_at)
    key.save()
    record_audit_event(actor=actor, institution=institution, entity=key, action="integrations.api_key.created", metadata={"name": key.name, "scopes": key.scopes})
    return key, plaintext


def authenticate_api_key(raw):
    """The active key for a presented secret, or None."""
    if not raw or not raw.startswith(f"{KEY_PREFIX}_") or len(raw) > 200:
        return None
    key = ApiKey.objects.select_related("institution", "created_by").filter(key_hash=_hash(raw), revoked_at__isnull=True).first()
    if key is None or (key.expires_at and key.expires_at <= timezone.now()) or not key.institution.is_active:
        return None
    ApiKey.objects.filter(pk=key.pk).update(last_used_at=timezone.now())
    return key


def revoke_api_key(*, key, actor):
    if key.revoked_at is None:
        key.revoked_at = timezone.now()
        key.save(update_fields=("revoked_at", "updated_at"))
        record_audit_event(actor=actor, institution=key.institution, entity=key, action="integrations.api_key.revoked", metadata={"name": key.name})
    return key


# ------------------------------------------------------------------ webhooks


def _public_address(host):
    """True when every address the host resolves to is publicly routable."""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    addresses = {info[4][0] for info in infos}
    return bool(addresses) and all(ipaddress.ip_address(address).is_global for address in addresses)


def validate_webhook_url(url):
    parsed = urlparse(url or "")
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValidationError({"url": "Use an https:// address."})
    if parsed.username or parsed.password:
        raise ValidationError({"url": "Don't put credentials in the address."})
    if not getattr(settings, "WEBHOOK_ALLOW_PRIVATE_ADDRESSES", False) and not _public_address(parsed.hostname):
        raise ValidationError({"url": "The address must resolve to a public internet host."})
    return url


@transaction.atomic
def create_webhook(*, institution, actor, url, events, description=""):
    validate_webhook_url(url)
    unknown = [event for event in events if event not in EVENT_NAMES]
    if not events or unknown:
        raise ValidationError({"events": f"Choose events from: {', '.join(EVENT_NAMES)}."})
    secret = f"whsec_{secrets.token_urlsafe(32)}"
    endpoint = WebhookEndpoint(institution=institution, url=url, description=description.strip(), secret=secret, events=list(dict.fromkeys(events)), created_by=actor)
    endpoint.save()
    record_audit_event(actor=actor, institution=institution, entity=endpoint, action="integrations.webhook.created", metadata={"url": url, "events": endpoint.events})
    return endpoint, secret


def payload_for(audit_log, event, delivery_id):
    _, _, safe_keys = EVENTS[audit_log.action]
    metadata = audit_log.metadata or {}
    return {
        "id": str(delivery_id),
        "event": event,
        "occurred_at": audit_log.created_at.isoformat(),
        "institution": {"id": str(audit_log.institution_id), "code": audit_log.institution.code},
        "data": {"entity_type": audit_log.entity_type, "entity_id": str(audit_log.entity_id) if audit_log.entity_id else None, **{key: metadata[key] for key in safe_keys if key in metadata}},
    }


def queue_for_audit_log(audit_log):
    """Creates deliveries for an audit entry; sends them once the transaction commits."""
    mapping = EVENTS.get(audit_log.action)
    if mapping is None or audit_log.institution_id is None:
        return []
    event, condition, _ = mapping
    if condition is not None and not condition(audit_log.metadata or {}):
        return []
    endpoints = [endpoint for endpoint in WebhookEndpoint.objects.filter(institution_id=audit_log.institution_id, is_active=True) if event in endpoint.events]
    deliveries = []
    for endpoint in endpoints:
        delivery = WebhookDelivery(institution_id=audit_log.institution_id, endpoint=endpoint, event=event, payload={}, next_attempt_at=timezone.now())
        delivery.payload = payload_for(audit_log, event, delivery.id)
        delivery.save()
        deliveries.append(delivery.id)
    if deliveries:
        transaction.on_commit(lambda: dispatch(deliveries))
    return deliveries


def dispatch(delivery_ids):
    if getattr(settings, "WEBHOOK_DELIVERY_SYNC", False):
        for delivery_id in delivery_ids:
            deliver(delivery_id)
        return
    threading.Thread(target=_deliver_in_background, args=(list(delivery_ids),), daemon=True).start()


def _deliver_in_background(delivery_ids):
    """Runs in its own thread, so it manages its own database connection."""
    from django.db import close_old_connections, connections

    close_old_connections()
    try:
        for delivery_id in delivery_ids:
            deliver(delivery_id)
    finally:
        connections.close_all()


def sign(secret, timestamp, body):
    return hmac.new(secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256).hexdigest()


def deliver(delivery_id):
    """One delivery attempt; schedules a retry or gives up after the last delay."""
    delivery = WebhookDelivery.objects.select_related("endpoint").filter(pk=delivery_id, status=WebhookDelivery.Status.PENDING).first()
    if delivery is None:
        return None
    endpoint = delivery.endpoint
    body = json.dumps(delivery.payload, separators=(",", ":"), sort_keys=True)
    timestamp = str(int(timezone.now().timestamp()))
    delivery.attempts += 1
    error, status_code = "", None
    try:
        validate_webhook_url(endpoint.url)  # Re-checked each time: DNS can change after the endpoint was saved.
        response = requests.post(
            endpoint.url, data=body, timeout=TIMEOUT_SECONDS, allow_redirects=False,
            headers={
                "Content-Type": "application/json", "User-Agent": "ErgonX-Webhooks/1", "X-ErgonX-Event": delivery.event,
                "X-ErgonX-Delivery": str(delivery.id), "X-ErgonX-Timestamp": timestamp, "X-ErgonX-Signature": f"sha256={sign(endpoint.secret, timestamp, body)}",
            },
        )
        status_code = response.status_code
        if not 200 <= status_code < 300:
            error = f"HTTP {status_code}"
    except ValidationError as exc:
        error = "; ".join(message for messages in exc.message_dict.values() for message in messages)[:300]
    except requests.RequestException as exc:
        error = type(exc).__name__
    delivery.last_status_code = status_code
    if not error:
        delivery.status = WebhookDelivery.Status.SUCCEEDED
        delivery.delivered_at = timezone.now()
        delivery.last_error = ""
        delivery.next_attempt_at = None
        WebhookEndpoint.objects.filter(pk=endpoint.pk).update(consecutive_failures=0)
    else:
        delivery.last_error = error
        if delivery.attempts > len(RETRY_DELAYS):
            delivery.status = WebhookDelivery.Status.FAILED
            delivery.next_attempt_at = None
        else:
            delivery.next_attempt_at = timezone.now() + RETRY_DELAYS[delivery.attempts - 1]
        failures = endpoint.consecutive_failures + 1
        WebhookEndpoint.objects.filter(pk=endpoint.pk).update(consecutive_failures=failures, **({"is_active": False} if failures >= DISABLE_AFTER_FAILURES else {}))
    delivery.save()
    return delivery


def deliver_due(limit=200):
    """Retries deliveries whose next attempt is due. Run from cron: ``manage.py deliver_webhooks``."""
    due = WebhookDelivery.objects.filter(status=WebhookDelivery.Status.PENDING, next_attempt_at__lte=timezone.now()).values_list("id", flat=True)[:limit]
    return [deliver(delivery_id) for delivery_id in list(due)]


# ------------------------------------------------------------------ calendar


@transaction.atomic
def create_calendar_feed(*, institution, user):
    """Issues a new private feed link, revoking any earlier one for this person here."""
    CalendarFeed.objects.filter(institution=institution, user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())
    token = secrets.token_urlsafe(32)
    CalendarFeed(institution=institution, user=user, token_hash=_hash(token)).save()
    return token


def feed_for_token(token):
    if not token or len(token) > 100:
        return None
    feed = CalendarFeed.objects.select_related("institution", "user").filter(token_hash=_hash(token), revoked_at__isnull=True).first()
    if feed is None or not feed.user.is_active or not feed.institution.is_active:
        return None
    if not feed.user.memberships.filter(institution=feed.institution, status="ACTIVE").exists():
        return None
    CalendarFeed.objects.filter(pk=feed.pk).update(last_used_at=timezone.now())
    return feed


def _ics_text(value):
    return str(value or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _ics_time(moment):
    return moment.astimezone(dt_timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def calendar_ics(feed, *, days_back=14, days_ahead=60):
    """An iCalendar file with the person's shifts, approved leave and interviews they take part in."""
    from apps.employees.models import Employee
    from apps.leave.models import LeaveRequest
    from apps.recruitment.models import Interview
    from apps.scheduling.services import schedule_assignment_for, schedule_expectation

    institution, user = feed.institution, feed.user
    today = timezone.localdate()
    start, end = today - timedelta(days=days_back), today + timedelta(days=days_ahead)
    stamp = _ics_time(timezone.now())
    events = []

    def add(uid, summary, begin, finish, *, all_day=False, description="", location=""):
        lines = ["BEGIN:VEVENT", f"UID:{uid}@ergonx", f"DTSTAMP:{stamp}"]
        if all_day:
            lines += [f"DTSTART;VALUE=DATE:{begin:%Y%m%d}", f"DTEND;VALUE=DATE:{finish:%Y%m%d}"]
        else:
            lines += [f"DTSTART:{_ics_time(begin)}", f"DTEND:{_ics_time(finish)}"]
        lines.append(f"SUMMARY:{_ics_text(summary)}")
        if description:
            lines.append(f"DESCRIPTION:{_ics_text(description)}")
        if location:
            lines.append(f"LOCATION:{_ics_text(location)}")
        lines.append("END:VEVENT")
        events.append("\r\n".join(lines))

    employee = Employee.objects.for_institution(institution).filter(user=user).first()
    if employee is not None:
        modules = set(institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
        if "LEAVE" in modules:
            leaves = LeaveRequest.objects.for_institution(institution).filter(employee=employee, status=LeaveRequest.Status.APPROVED, end_date__gte=start, start_date__lte=end).select_related("leave_type")
            for leave in leaves:
                add(f"leave-{leave.id}", f"Leave: {leave.leave_type.name}", leave.start_date, leave.end_date + timedelta(days=1), all_day=True)
        if "ATTENDANCE" in modules:
            day = today
            while day <= today + timedelta(days=min(days_ahead, 31)):
                assignment = schedule_assignment_for(employee, day)
                if assignment is not None:
                    try:
                        expectation = schedule_expectation(assignment, day)
                    except ValidationError:
                        expectation = None
                    if expectation and not expectation["off_day"] and expectation["start"] and not expectation["flexible_rule"]:
                        add(f"shift-{employee.id}-{day:%Y%m%d}", f"Shift: {assignment.work_schedule.name}", expectation["start"], expectation["end"])
                day += timedelta(days=1)
    if "RECRUITMENT" in set(institution.modules.filter(is_enabled=True).values_list("module_code", flat=True)):
        from django.db.models import Q

        interviews = Interview.objects.for_institution(institution).filter(Q(interviewer=user) | Q(panel=user), status=Interview.Status.SCHEDULED, scheduled_at__date__gte=start, scheduled_at__date__lte=end).select_related("application__candidate", "application__job_posting").distinct()
        for interview in interviews:
            add(
                f"interview-{interview.id}", f"Interview: {interview.application.candidate.full_name} ({interview.application.job_posting.title})",
                interview.scheduled_at, interview.scheduled_at + timedelta(minutes=interview.duration_minutes), location=interview.location_or_link,
            )
    header = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ErgonX//Calendar//EN", "CALSCALE:GREGORIAN", f"X-WR-CALNAME:{_ics_text(institution.name)} · ErgonX"]
    return "\r\n".join(header + events + ["END:VCALENDAR"]) + "\r\n"
