from datetime import date

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.audit.models import AuditLog
from apps.documents.models import Policy, PolicyAcknowledgement
from apps.employees.models import Employment, LifecycleTask
from apps.institutions.models import InstitutionMembership


pytestmark = pytest.mark.django_db


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, organization_factory, assignment_dimensions_factory, employee_factory):
    institution = institution_factory(code="POLICIES")
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    department, position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)

    def staff(first, last, employment_type=Employment.EmploymentType.PERMANENT):
        user = user_factory()
        membership_factory(user=user, institution=institution, role_code="EMPLOYEE", is_primary=True)
        employee = employee_factory(institution, user=user, first_name=first, last_name=last)
        Employment.objects.create(
            institution=institution, employee=employee, department=department, position=position, grade=grade, location=location,
            employment_type=employment_type, start_date=date(2026, 1, 5), is_current=True,
        )
        return user, employee

    ama_user, ama = staff("Ama", "Mensah")
    kofi_user, kofi = staff("Kofi", "Boateng", Employment.EmploymentType.CONTRACT)
    _as(api_client, hr, institution)
    return {"client": api_client, "institution": institution, "hr": hr, "ama": ama, "ama_user": ama_user, "kofi": kofi, "kofi_user": kofi_user}


def _publish(client, **extra):
    created = client.post("/api/v1/policies/", {"title": "Code of conduct", "category": "CODE_OF_CONDUCT", "body": "Be honest.", **extra}, format="json")
    assert created.status_code == 201, created.data
    published = client.post(f"/api/v1/policies/{created.data['id']}/publish/", format="json")
    assert published.status_code == 200, published.data
    return published.data


def test_draft_needs_content_and_only_drafts_are_editable(setup):
    client = setup["client"]
    draft = client.post("/api/v1/policies/", {"title": "Empty"}, format="json").data
    assert client.post(f"/api/v1/policies/{draft['id']}/publish/", format="json").status_code == 400
    policy = _publish(client)
    assert policy["status"] == "PUBLISHED"
    assert policy["acknowledgement_summary"] == {"applicable": 2, "acknowledged": 0, "pending": 2, "overdue": 0, "rate": 0.0}
    assert client.patch(f"/api/v1/policies/{policy['id']}/", {"body": "Changed quietly"}, format="json").status_code == 400
    assert client.delete(f"/api/v1/policies/{policy['id']}/").status_code == 400
    assert client.delete(f"/api/v1/policies/{draft['id']}/").status_code == 204


def test_employee_acknowledges_with_their_name(setup, api_client):
    policy = _publish(setup["client"])
    _as(api_client, setup["ama_user"], setup["institution"])
    mine = api_client.get("/api/v1/employees/me/policies/")
    assert mine.status_code == 200
    assert [row["status"] for row in mine.data["policies"]] == ["PENDING"]
    url = f"/api/v1/employees/me/policies/{policy['id']}/acknowledge/"
    assert api_client.post(url, {"signed_name": "Ama Mensah", "confirm": False}, format="json").status_code == 400
    wrong = api_client.post(url, {"signed_name": "Someone Else", "confirm": True}, format="json")
    assert wrong.status_code == 400
    assert "signed_name" in str(wrong.data)
    ok = api_client.post(url, {"signed_name": "  ama   MENSAH ", "confirm": True}, format="json")
    assert ok.status_code == 200, ok.data
    assert ok.data["status"] == "ACKNOWLEDGED"
    assert ok.data["acknowledgement"]["signed_name"] == "ama MENSAH"
    assert api_client.post(url, {"signed_name": "Ama Mensah", "confirm": True}, format="json").status_code == 400
    assert AuditLog.objects.filter(action="policy.acknowledged").count() == 1

    _as(api_client, setup["hr"], setup["institution"])
    report = api_client.get(f"/api/v1/policies/{policy['id']}/acknowledgements/")
    assert report.data["summary"]["acknowledged"] == 1
    statuses = {row["employee"]: row["status"] for row in report.data["employees"]}
    assert statuses == {"Ama Mensah": "ACKNOWLEDGED", "Kofi Boateng": "PENDING"}


def test_new_version_asks_everyone_again(setup, api_client):
    client = setup["client"]
    policy = _publish(client)
    _as(api_client, setup["ama_user"], setup["institution"])
    api_client.post(f"/api/v1/employees/me/policies/{policy['id']}/acknowledge/", {"signed_name": "Ama Mensah", "confirm": True}, format="json")
    _as(api_client, setup["hr"], setup["institution"])
    assert api_client.post(f"/api/v1/policies/{policy['id']}/new-version/", {"body": "Be honest and kind."}, format="json").status_code == 400
    revised = api_client.post(f"/api/v1/policies/{policy['id']}/new-version/", {"body": "Be honest and kind.", "change_summary": "Added kindness."}, format="json")
    assert revised.status_code == 200, revised.data
    assert revised.data["version"] == 2
    assert revised.data["acknowledgement_summary"]["acknowledged"] == 0
    _as(api_client, setup["ama_user"], setup["institution"])
    row = api_client.get(f"/api/v1/employees/me/policies/{policy['id']}/").data
    assert row["status"] == "PENDING" and row["body"] == "Be honest and kind." and row["change_summary"] == "Added kindness."
    assert PolicyAcknowledgement.objects.filter(employee=setup["ama"], version=1).exists()


def test_policy_scope_by_employment_type_and_retirement(setup, api_client):
    client = setup["client"]
    policy = _publish(client, title="Permanent staff pension", employment_types=["PERMANENT"])
    _as(api_client, setup["kofi_user"], setup["institution"])
    assert api_client.get("/api/v1/employees/me/policies/").data["policies"] == []
    assert api_client.post(f"/api/v1/employees/me/policies/{policy['id']}/acknowledge/", {"signed_name": "Kofi Boateng", "confirm": True}, format="json").status_code == 404
    _as(api_client, setup["hr"], setup["institution"])
    assert api_client.post(f"/api/v1/policies/{policy['id']}/retire/", format="json").data["status"] == "RETIRED"
    _as(api_client, setup["ama_user"], setup["institution"])
    assert api_client.get("/api/v1/employees/me/policies/").data["policies"] == []


def test_policy_file_upload_and_download(setup, api_client):
    client = setup["client"]
    upload = SimpleUploadedFile("handbook.pdf", b"%PDF-1.4 handbook", content_type="application/pdf")
    created = client.post("/api/v1/policies/", {"title": "Staff handbook", "uploaded_file": upload}, format="multipart")
    assert created.status_code == 201, created.data
    policy = client.get(f"/api/v1/policies/{created.data['id']}/").data
    assert policy["document"]["original_filename"] == "handbook.pdf"
    client.post(f"/api/v1/policies/{policy['id']}/publish/", format="json")
    _as(api_client, setup["ama_user"], setup["institution"])
    download = api_client.get(f"/api/v1/employees/me/policies/{policy['id']}/file/")
    assert download.status_code == 200
    assert b"".join(download.streaming_content) == b"%PDF-1.4 handbook"


def test_employees_cannot_manage_policies(setup, api_client):
    _as(api_client, setup["ama_user"], setup["institution"])
    assert api_client.post("/api/v1/policies/", {"title": "Mine"}, format="json").status_code == 403
    assert api_client.get("/api/v1/policies/").status_code == 403


def test_acknowledging_every_policy_ticks_off_the_onboarding_item(setup, api_client):
    client, ama = setup["client"], setup["ama"]
    client.post("/api/v1/lifecycle-task-templates/install-standard/", format="json")
    InstitutionMembership.objects.filter(user=setup["ama_user"]).update(status=InstitutionMembership.Status.ACTIVE)
    first = _publish(client)
    second = _publish(client, title="IT acceptable use", category="IT_SECURITY")
    client.post(f"/api/v1/employees/{ama.id}/onboarding/start/", format="json")
    policy_task = LifecycleTask.objects.get(employee=ama, category="POLICY")

    _as(api_client, setup["ama_user"], setup["institution"])
    own = api_client.get("/api/v1/employees/me/lifecycle/").data
    item = next(task for task in own["onboarding"]["tasks"] if task["id"] == str(policy_task.id))
    assert item["can_complete"] is False  # Ticked off by acknowledging, not by hand.
    assert api_client.patch(f"/api/v1/employees/me/lifecycle-tasks/{policy_task.id}/", {"status": "DONE"}, format="json").status_code == 400

    api_client.post(f"/api/v1/employees/me/policies/{first['id']}/acknowledge/", {"signed_name": "Ama Mensah", "confirm": True}, format="json")
    policy_task.refresh_from_db()
    assert policy_task.status == "OPEN"
    api_client.post(f"/api/v1/employees/me/policies/{second['id']}/acknowledge/", {"signed_name": "Ama Mensah", "confirm": True}, format="json")
    policy_task.refresh_from_db()
    assert policy_task.status == "DONE"
    assert policy_task.completed_by == setup["ama_user"]


def test_employee_ticks_their_own_items_only(setup, api_client):
    client, ama = setup["client"], setup["ama"]
    client.post("/api/v1/lifecycle-task-templates/install-standard/", format="json")
    client.post(f"/api/v1/employees/{ama.id}/onboarding/start/", format="json")
    hr_task = LifecycleTask.objects.get(employee=ama, title="Sign employment contract")
    policy_task = LifecycleTask.objects.get(employee=ama, category="POLICY")

    _as(api_client, setup["ama_user"], setup["institution"])
    # No required policy is published, so the policy item is a manual one the employee owns.
    done = api_client.patch(f"/api/v1/employees/me/lifecycle-tasks/{policy_task.id}/", {"status": "DONE"}, format="json")
    assert done.status_code == 200, done.data
    assert api_client.patch(f"/api/v1/employees/me/lifecycle-tasks/{hr_task.id}/", {"status": "DONE"}, format="json").status_code == 400
    assert api_client.patch(f"/api/v1/employees/me/lifecycle-tasks/{policy_task.id}/", {"status": "NOT_APPLICABLE"}, format="json").status_code == 400
    _as(client, setup["hr"], setup["institution"])
    client.post(f"/api/v1/employees/{setup['kofi'].id}/onboarding/start/", format="json")
    kofi_task = LifecycleTask.objects.get(employee=setup["kofi"], category="POLICY")
    _as(api_client, setup["ama_user"], setup["institution"])
    assert api_client.patch(f"/api/v1/employees/me/lifecycle-tasks/{kofi_task.id}/", {"status": "DONE"}, format="json").status_code == 404


def test_home_lists_policies_to_acknowledge(setup, api_client):
    _publish(setup["client"])
    _as(api_client, setup["ama_user"], setup["institution"])
    from apps.dashboards.home import _personal_snapshot

    snapshot = _personal_snapshot(user=setup["ama_user"], institution=setup["institution"], permission_codes=["home.view"])
    codes = [item["code"] for item in snapshot["attention"]]
    assert "MY_POLICIES_TO_ACKNOWLEDGE" in codes
    assert Policy.objects.count() == 1


def test_draft_file_can_be_replaced_but_not_after_publishing(setup):
    client = setup["client"]
    draft = client.post("/api/v1/policies/", {"title": "Leave policy", "body": "See attached."}, format="json").data
    upload = SimpleUploadedFile("leave.pdf", b"%PDF-1.4 leave", content_type="application/pdf")
    replaced = client.post(f"/api/v1/policies/{draft['id']}/file/", {"uploaded_file": upload}, format="multipart")
    assert replaced.status_code == 200, replaced.data
    assert replaced.data["document"]["original_filename"] == "leave.pdf"
    client.post(f"/api/v1/policies/{draft['id']}/publish/", format="json")
    again = SimpleUploadedFile("leave2.pdf", b"%PDF-1.4 leave v2", content_type="application/pdf")
    assert client.post(f"/api/v1/policies/{draft['id']}/file/", {"uploaded_file": again}, format="multipart").status_code == 400
