"""Backups, organisation export, emergency sign-out, new-device alerts and the incident register (items 6 and 11)."""
import io
import json
import zipfile
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import UserSession
from apps.audit.devices import describe_user_agent
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db
LOGIN = "/api/v1/auth/login/"
ME = "/api/v1/auth/me/"
CHROME_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


def sign_in(email, user_agent, ip):
    client = APIClient(HTTP_USER_AGENT=user_agent, REMOTE_ADDR=ip)
    pair = client.post(LOGIN, {"email": email, "password": "StrongPass123!"}, format="json").json()["data"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {pair['access']}")
    return client


@pytest.fixture
def org(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory(code="RES")
    admin = user_factory(email="admin@res.example")
    membership_factory(user=admin, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    staff = user_factory(email="staff@res.example")
    staff_membership = membership_factory(user=staff, institution=institution, role_code="EMPLOYEE", is_primary=True)
    return {"institution": institution, "admin": admin, "staff": staff, "staff_membership": staff_membership, "client": api_client}


def _as(client, user, institution=None):
    client.force_authenticate(user)
    if institution is not None:
        client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


def test_describe_user_agent():
    assert describe_user_agent(CHROME_WINDOWS) == "Chrome on Windows"
    assert describe_user_agent(SAFARI_IPHONE) == "Safari on iPhone"
    assert describe_user_agent("") == ""


def test_organisation_export_has_every_table_files_and_no_secrets(org):
    from apps.integrations.models import WebhookEndpoint

    client, institution = org["client"], org["institution"]
    WebhookEndpoint.objects.create(institution=institution, url="https://example.com/hook", secret="very-secret-value", events=["employee.created"], created_by=org["admin"])
    _as(client, org["admin"], institution)
    upload = client.post("/api/v1/documents/", {"uploaded_file": SimpleUploadedFile("policy.pdf", b"%PDF-1.4 handbook"), "category": "HR", "classification": "INTERNAL"}, format="multipart")
    assert upload.status_code == 201, upload.data

    response = client.get("/api/v1/institutions/current/export/")
    assert response.status_code == 200 and response["Content-Type"] == "application/zip"
    archive = zipfile.ZipFile(io.BytesIO(b"".join(response.streaming_content)))
    manifest = json.loads(archive.read("manifest.json"))
    assert manifest["organisation"]["code"] == "RES" and manifest["files_included"] == 1
    assert manifest["record_counts"]["documents.Document"] == 1
    names = archive.namelist()
    assert any(name.startswith("files/") for name in names)
    hooks = json.loads(archive.read("data/integrations.WebhookEndpoint.json"))
    assert hooks[0]["fields"]["secret"] == ""
    assert b"very-secret-value" not in b"".join(archive.read(name) for name in names)
    members = json.loads(archive.read("members.json"))
    assert {row["email"] for row in members} == {"admin@res.example", "staff@res.example"} and all("password" not in row for row in members)

    _as(client, org["staff"], institution)
    assert client.get("/api/v1/institutions/current/export/").status_code == 403


def test_admin_and_platform_emergency_sign_out(org, user_factory):
    staff_client = sign_in(org["staff"].email, CHROME_WINDOWS, "10.0.0.1")
    assert staff_client.get(ME).status_code == 200
    client, institution = org["client"], org["institution"]
    _as(client, org["admin"], institution)
    signed_out = client.post(f"/api/v1/institutions/members/{org['staff_membership'].id}/sign-out/")
    assert signed_out.status_code == 200 and signed_out.data["revoked"] == 1
    assert staff_client.get(ME).status_code == 401

    again = sign_in(org["staff"].email, CHROME_WINDOWS, "10.0.0.1")
    root = user_factory(email="root@ergonx.example", is_platform_admin=True)
    platform = APIClient()
    platform.force_authenticate(root)
    url = f"/api/v1/platform/institutions/{institution.id}/sign-out/"
    assert platform.post(url, {}, format="json").status_code == 400  # a reason is required
    everyone = platform.post(url, {"reason": "Suspected credential leak"}, format="json")
    assert everyone.status_code == 200 and everyone.data["people"] == 2
    assert again.get(ME).status_code == 401


def test_new_device_sign_in_alerts_the_user_once(org):
    staff = org["staff"]
    sign_in(staff.email, CHROME_WINDOWS, "10.0.0.1")  # first ever sign-in: nothing to compare with
    sign_in(staff.email, CHROME_WINDOWS, "10.0.0.1")  # same device
    assert not Notification.objects.filter(user=staff, notification_type="SECURITY_NEW_SIGN_IN").exists()
    sign_in(staff.email, SAFARI_IPHONE, "196.10.0.9")  # new browser and new network
    alert = Notification.objects.get(user=staff, notification_type="SECURITY_NEW_SIGN_IN")
    assert "Safari on iPhone" in alert.message and "196.10.0.9" in alert.message
    assert alert.institution_id == org["institution"].id
    assert UserSession.objects.filter(user=staff).count() == 3


def test_incident_register_timeline_and_recovery_targets(org, user_factory, settings):
    settings.DR_RECOVERY_TIME_OBJECTIVE_HOURS = 4
    root = user_factory(email="ops@ergonx.example", is_platform_admin=True)
    client = APIClient()
    client.force_authenticate(root)
    detected = timezone.now() - timedelta(hours=3)
    created = client.post("/api/v1/platform/incidents/", {
        "title": "API returning 500s", "summary": "Database connections exhausted.", "kind": "OUTAGE", "severity": "SEV1",
        "detected_at": detected.isoformat(), "affected_institutions": [str(org["institution"].id)],
    }, format="json")
    assert created.status_code == 201, created.data
    incident = created.data
    assert incident["status"] == "DETECTED" and incident["affected_names"] == [org["institution"].name] and len(incident["updates"]) == 1
    url = f"/api/v1/platform/incidents/{incident['id']}/"

    contained = client.post(url + "updates/", {"note": "Raised the connection limit.", "status": "CONTAINED"}, format="json")
    assert contained.status_code == 200 and contained.data["status"] == "CONTAINED" and contained.data["timings"]["minutes_to_contain"] >= 179
    assert client.post(url + "updates/", {"note": "Oops", "status": "INVESTIGATING"}, format="json").status_code == 400  # never backwards
    assert client.post(url + "updates/", {"note": "Done", "status": "CLOSED"}, format="json").status_code == 400  # root cause first
    client.patch(url, {"root_cause": "Connection age too long under load.", "lessons_learned": "Alert on connection count."}, format="json")
    closed = client.post(url + "updates/", {"note": "Stable for 24 hours.", "status": "CLOSED"}, format="json")
    assert closed.status_code == 200, closed.data
    timings = closed.data["timings"]
    assert closed.data["status"] == "CLOSED" and timings["within_rto"] is True and len(closed.data["updates"]) == 3
    listing = client.get("/api/v1/platform/incidents/")
    assert listing.data["targets"] == {"rto_hours": 4.0, "rpo_hours": 24.0}

    _as(client, org["admin"], org["institution"])
    assert client.get("/api/v1/platform/incidents/").status_code == 403
