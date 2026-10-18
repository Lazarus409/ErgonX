import hashlib
import hmac
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.institutions.models import InstitutionModule
from apps.integrations import services
from apps.integrations.models import WebhookDelivery
from apps.leave.models import LeaveRequest, LeaveType
from apps.scheduling.services import change_current_schedule_assignment
from tests.test_scheduling_attendance import _employee_with_employment, _fixed_schedule


pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory):
    institution = institution_factory(code="INTEG")
    InstitutionModule.objects.filter(institution=institution, module_code__in=("ATTENDANCE", "LEAVE")).update(is_enabled=True)
    admin = user_factory()
    membership_factory(user=admin, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    staff_user = user_factory()
    membership_factory(user=staff_user, institution=institution, role_code="EMPLOYEE", is_primary=True)
    staff = _employee_with_employment(institution, user=staff_user, employee_factory=employee_factory, organization_factory=organization_factory, assignment_dimensions_factory=assignment_dimensions_factory)
    _, schedule = _fixed_schedule(institution, start=time(8), end=time(16))
    change_current_schedule_assignment(institution=institution, employee=staff, work_schedule=schedule, effective_from=date(2026, 1, 1), assigned_by=admin)
    _as(api_client, admin, institution)
    return {"client": api_client, "institution": institution, "admin": admin, "hr": hr, "staff_user": staff_user, "staff": staff}


def _key(setup, scopes):
    response = setup["client"].post("/api/v1/integrations/api-keys/", {"name": "Gate reader", "scopes": scopes}, format="json")
    assert response.status_code == 201, response.data
    return response.data


def _external(client, key, method, path, **kwargs):
    client.force_authenticate(None)
    client.credentials(HTTP_AUTHORIZATION=f"Api-Key {key}")
    return getattr(client, method)(path, format="json", **kwargs)


def test_api_keys_are_admin_only_shown_once_and_revocable(setup):
    client = setup["client"]
    created = _key(setup, ["employees.read"])
    assert created["key"].startswith("ergx_")
    listed = client.get("/api/v1/integrations/api-keys/").data["results"]
    assert "key" not in listed[0] and listed[0]["prefix"] == created["prefix"]
    _as(client, setup["hr"], setup["institution"])
    assert client.get("/api/v1/integrations/api-keys/").status_code == 403

    response = _external(client, created["key"], "get", "/api/v1/integrations/v1/employees/")
    assert response.status_code == 200
    assert response.data["employees"][0]["employee_number"] == setup["staff"].employee_number
    assert "date_of_birth" not in response.data["employees"][0]
    assert _external(client, created["key"], "get", "/api/v1/integrations/v1/leave/").status_code == 403  # Wrong scope.
    assert _external(client, "ergx_nope_nope", "get", "/api/v1/integrations/v1/employees/").status_code in (401, 403)

    _as(client, setup["admin"], setup["institution"])
    client.post(f"/api/v1/integrations/api-keys/{created['id']}/revoke/", format="json")
    assert _external(client, created["key"], "get", "/api/v1/integrations/v1/employees/").status_code in (401, 403)


def test_device_punches_clock_in_and_out(setup):
    key = _key(setup, ["attendance.punch"])["key"]
    zone = ZoneInfo("Africa/Accra")
    day = timezone.localdate() - timedelta(days=1)
    punch_in = datetime.combine(day, time(8, 3), zone).isoformat()
    punch_out = datetime.combine(day, time(16, 10), zone).isoformat()
    response = _external(setup["client"], key, "post", "/api/v1/integrations/v1/attendance/punches/", data={"punches": [
        {"employee_number": setup["staff"].employee_number, "timestamp": punch_in, "direction": "IN", "device_id": "GATE-1"},
        {"employee_number": setup["staff"].employee_number, "timestamp": punch_out, "direction": "OUT"},
        {"employee_number": "NOPE", "timestamp": punch_in, "direction": "IN"},
        {"employee_number": setup["staff"].employee_number, "timestamp": punch_in, "direction": "SIDEWAYS"},
    ]})
    assert response.status_code == 200, response.data
    assert response.data["accepted"] == 2 and response.data["rejected"] == 2
    from apps.attendance.models import AttendanceRecord

    record = AttendanceRecord.objects.get(employee=setup["staff"], attendance_date=day)
    assert record.source == "DEVICE" and record.check_out is not None


@override_settings(WEBHOOK_DELIVERY_SYNC=True)
def test_webhooks_are_signed_and_retried(setup, monkeypatch, django_capture_on_commit_callbacks):
    client = setup["client"]
    assert client.post("/api/v1/integrations/webhooks/", {"url": "http://example.com/hook", "events": ["employee.created"]}, format="json").status_code == 400
    assert client.post("/api/v1/integrations/webhooks/", {"url": "https://127.0.0.1/hook", "events": ["employee.created"]}, format="json").status_code == 400
    monkeypatch.setattr(services, "_public_address", lambda host: True)
    created = client.post("/api/v1/integrations/webhooks/", {"url": "https://hooks.example.com/ergonx", "events": ["employee.created", "leave.approved"]}, format="json")
    assert created.status_code == 201, created.data
    secret = created.data["secret"]
    assert "secret" not in client.get("/api/v1/integrations/webhooks/").data["results"][0]

    sent = []

    class Reply:
        def __init__(self, code):
            self.status_code = code

    status = {"code": 200}

    def fake_post(url, data, headers, **kwargs):
        sent.append((url, data, headers))
        return Reply(status["code"])

    monkeypatch.setattr(services.requests, "post", fake_post)
    with django_capture_on_commit_callbacks(execute=True):
        record_audit_event(actor=setup["admin"], institution=setup["institution"], entity=setup["staff"], action="employee.created", metadata={"changes": {"date_of_birth": "secret"}})
    assert len(sent) == 1
    url, body, headers = sent[0]
    assert headers["X-ErgonX-Event"] == "employee.created"
    expected = hmac.new(secret.encode(), f"{headers['X-ErgonX-Timestamp']}.{body}".encode(), hashlib.sha256).hexdigest()
    assert headers["X-ErgonX-Signature"] == f"sha256={expected}"
    assert "date_of_birth" not in body and str(setup["staff"].id) in body
    assert WebhookDelivery.objects.get().status == "SUCCEEDED"

    # A leave approval step that isn't final sends nothing; failures are retried, then given up.
    with django_capture_on_commit_callbacks(execute=True):
        record_audit_event(actor=setup["admin"], institution=setup["institution"], entity=setup["staff"], action="leave.request.approved_step", metadata={"final_status": "PENDING"})
    assert len(sent) == 1
    status["code"] = 500
    with django_capture_on_commit_callbacks(execute=True):
        record_audit_event(actor=setup["admin"], institution=setup["institution"], entity=setup["staff"], action="leave.request.approved_step", metadata={"final_status": "APPROVED"})
    failing = WebhookDelivery.objects.get(event="leave.approved")
    assert failing.status == "PENDING" and failing.attempts == 1 and failing.last_error == "HTTP 500"
    for _ in range(len(services.RETRY_DELAYS)):
        WebhookDelivery.objects.filter(pk=failing.pk).update(next_attempt_at=timezone.now())
        services.deliver_due()
    failing.refresh_from_db()
    assert failing.status == "FAILED" and failing.attempts == len(services.RETRY_DELAYS) + 1


def test_calendar_feed(setup):
    client, institution, staff = setup["client"], setup["institution"], setup["staff"]
    leave_type = LeaveType.objects.create(institution=institution, name="Annual Leave", code="CAL-AL")
    LeaveRequest.objects.create(institution=institution, employee=staff, leave_type=leave_type, start_date=timezone.localdate() + timedelta(days=5), end_date=timezone.localdate() + timedelta(days=6), requested_days=2, status=LeaveRequest.Status.APPROVED)
    _as(client, setup["staff_user"], institution)
    created = client.post("/api/v1/me/calendar-feed/", format="json")
    assert created.status_code == 201
    path = created.data["path"]
    client.force_authenticate(None)
    client.credentials()
    feed = client.get(path)
    assert feed.status_code == 200 and feed["Content-Type"].startswith("text/calendar")
    body = feed.content.decode()
    assert "BEGIN:VCALENDAR" in body and "SUMMARY:Leave: Annual Leave" in body and "SUMMARY:Shift:" in body
    assert client.get(f"{path}/").status_code == 200  # As forwarded by the web app's proxy.
    _as(client, setup["staff_user"], institution)
    client.delete("/api/v1/me/calendar-feed/")
    client.force_authenticate(None)
    client.credentials()
    assert client.get(path).status_code == 404
