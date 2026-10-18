import io
import zipfile
from datetime import date, timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import UserMFA
from apps.audit.services import record_audit_event
from apps.security.models import RestoreTest


pytestmark = pytest.mark.django_db


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory(code="SECOPS")
    admin = user_factory(first_name="Ada", last_name="Admin")
    membership_factory(user=admin, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    auditor = user_factory()
    membership_factory(user=auditor, institution=institution, role_code="AUDITOR", is_primary=True)
    staff = user_factory()
    membership_factory(user=staff, institution=institution, role_code="EMPLOYEE", is_primary=True)
    _as(api_client, admin, institution)
    return {"client": api_client, "institution": institution, "admin": admin, "auditor": auditor, "staff": staff}


def _checks(response):
    return {check["code"]: check for check in response.data["checks"]}


def test_overview_flags_risks_and_clears_them(setup):
    client, admin = setup["client"], setup["admin"]
    for _ in range(6):
        record_audit_event(actor=setup["staff"], action="account.login.failed", metadata={})
    overview = client.get("/api/v1/security/overview/")
    assert overview.status_code == 200, overview.data
    checks = _checks(overview)
    assert checks["PRIVILEGED_WITHOUT_MFA"]["status"] == "CRITICAL"
    assert any(item["name"] == "Ada Admin" for item in checks["PRIVILEGED_WITHOUT_MFA"]["items"])
    assert checks["FAILED_SIGN_INS"]["status"] == "WARNING"
    assert checks["RESTORE_TEST"]["status"] == "WARNING"
    assert overview.data["checks"][0]["status"] == "CRITICAL"  # Worst first.

    assert len(checks["PRIVILEGED_WITHOUT_MFA"]["items"]) == 2  # The admin and the auditor.
    for user in (admin, setup["auditor"]):
        UserMFA.objects.create(user=user, secret="x", is_enabled=True, confirmed_at=timezone.now())
    RestoreTest.objects.create(performed_on=date.today() - timedelta(days=3), backup_reference="ergonx-render.dump", environment="scratch", result="PASSED", checks="Row counts and a sign-in")
    checks = _checks(client.get("/api/v1/security/overview/"))
    # Auditors hold privileged oversight permissions (audit trail, every report), so they need MFA too.
    assert checks["PRIVILEGED_WITHOUT_MFA"]["status"] == "OK"
    assert checks["RESTORE_TEST"]["status"] == "OK"


def test_evidence_pack_and_access(setup):
    client = setup["client"]
    _as(client, setup["auditor"], setup["institution"])
    response = client.get("/api/v1/security/evidence/")
    assert response.status_code == 200
    bundle = zipfile.ZipFile(io.BytesIO(response.content))
    assert {"README.txt", "users_and_roles.csv", "audit_trail.csv", "security_checks.json", "restore_tests.csv"} <= set(bundle.namelist())
    assert "mfa" in bundle.read("users_and_roles.csv").decode().splitlines()[0]
    assert client.get("/api/v1/security/evidence/?from=2026-01-01&to=2025-01-01").status_code == 400
    _as(client, setup["staff"], setup["institution"])
    assert client.get("/api/v1/security/overview/").status_code == 403


def test_restore_tests_are_platform_admin_only(setup, user_factory, api_client):
    client = setup["client"]
    payload = {"performed_on": "2026-10-10", "backup_reference": "live-2026-10-10.dump", "environment": "local Postgres 18", "result": "PASSED", "duration_minutes": 25, "checks": "Migrated, counted rows, signed in as demo admin"}
    assert client.post("/api/v1/platform/restore-tests/", payload, format="json").status_code == 403
    operator = user_factory(is_platform_admin=True)
    api_client.force_authenticate(operator)
    api_client.credentials()
    created = api_client.post("/api/v1/platform/restore-tests/", payload, format="json")
    assert created.status_code == 201, created.data
    assert api_client.get("/api/v1/platform/restore-tests/").data["results"][0]["result_label"] == "Passed"
