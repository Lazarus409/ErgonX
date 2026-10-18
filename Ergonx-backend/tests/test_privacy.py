from datetime import date, timedelta

import pytest
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.documents.models import Document
from apps.employees.models import EmergencyContact, Employee, Employment
from apps.privacy.models import DataSubjectRequest
from apps.recruitment.models import Application, Candidate, JobPosting


pytestmark = pytest.mark.django_db


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, organization_factory, assignment_dimensions_factory, employee_factory):
    institution = institution_factory(code="PRIV")
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    auditor = user_factory()
    membership_factory(user=auditor, institution=institution, role_code="AUDITOR", is_primary=True)
    staff_user = user_factory()
    membership_factory(user=staff_user, institution=institution, role_code="EMPLOYEE", is_primary=True)
    staff = employee_factory(institution, user=staff_user, first_name="Akua", last_name="Badu")
    department, position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)
    Employment.objects.create(institution=institution, employee=staff, department=department, position=position, grade=grade, location=location, employment_type="PERMANENT", start_date=date(2020, 1, 6), is_current=True)
    leaver = employee_factory(institution, first_name="Kwesi", last_name="Old", personal_email="kwesi@home.example", phone="+233200000001", status=Employee.Status.TERMINATED)
    Employment.objects.create(institution=institution, employee=leaver, department=department, position=position, grade=grade, location=location, employment_type="PERMANENT", start_date=date(2015, 1, 5), end_date=date(2018, 3, 31), status=Employment.Status.ENDED, is_current=False)
    EmergencyContact.objects.create(institution=institution, employee=leaver, full_name="Ama Old", relationship="Spouse", phone="+233200000002")
    job = JobPosting.objects.create(institution=institution, title="Clerk", department=department, position=position, location=location, employment_type="PERMANENT", status="CLOSED")
    old = Candidate.objects.create(institution=institution, first_name="Yaa", last_name="Applicant", email="yaa@example.com", phone="+233200000003")
    application = Application.objects.create(institution=institution, job_posting=job, candidate=old, status="REJECTED", cover_letter="Hire me", applicant_details={"phone": "+233"})
    Application.objects.filter(pk=application.pk).update(updated_at=timezone.now() - timedelta(days=800))
    cv = Document(institution=institution, original_filename="cv.pdf", content_type="application/pdf", size_bytes=5, entity_type="recruitment.Candidate", entity_id=old.id)
    cv.stored_file.save("cv.pdf", ContentFile(b"%PDF"), save=False)
    cv.save()
    _as(api_client, hr, institution)
    return {"client": api_client, "institution": institution, "hr": hr, "auditor": auditor, "staff_user": staff_user, "staff": staff, "leaver": leaver, "old": old}


def test_retention_report_run_and_legal_hold(setup):
    client = setup["client"]
    for category in ("CANDIDATES", "FORMER_EMPLOYEES"):
        assert client.post("/api/v1/privacy/retention-rules/", {"category": category, "keep_months": 24, "action": "ANONYMISE"}, format="json").status_code == 201
    assert client.post("/api/v1/privacy/retention-rules/", {"category": "AUDIT", "keep_months": 24, "action": "ANONYMISE"}, format="json").status_code == 400  # Review only.
    report = client.get("/api/v1/privacy/retention-rules/report/").data
    due = {row["category"]: row["due"] for row in report["rules"]}
    assert due == {"CANDIDATES": 1, "FORMER_EMPLOYEES": 1}

    hold = client.post("/api/v1/privacy/legal-holds/", {"title": "Tribunal case", "reason": "Unfair dismissal claim", "employees": [str(setup["leaver"].id)]}, format="json")
    assert hold.status_code == 201, hold.data
    report = client.get("/api/v1/privacy/retention-rules/report/").data
    assert {row["category"]: row["due"] for row in report["rules"]}["FORMER_EMPLOYEES"] == 0

    rules = {row["category"]: row["rule_id"] for row in report["rules"]}
    ran = client.post(f"/api/v1/privacy/retention-rules/{rules['CANDIDATES']}/run/", format="json")
    assert ran.data["processed"] == 1
    old = Candidate.objects.get(pk=setup["old"].pk)
    assert old.first_name == "Removed" and old.phone == "" and "invalid" in old.email
    assert Application.objects.get(candidate=old).cover_letter == ""
    assert not Document.objects.filter(entity_id=old.id, is_active=True).exists()
    assert client.post(f"/api/v1/privacy/retention-rules/{rules['FORMER_EMPLOYEES']}/run/", format="json").data["processed"] == 0
    leaver = Employee.objects.get(pk=setup["leaver"].pk)
    assert leaver.personal_email == "kwesi@home.example"  # Held.

    client.post(f"/api/v1/privacy/legal-holds/{hold.data['id']}/release/", format="json")
    assert client.post(f"/api/v1/privacy/retention-rules/{rules['FORMER_EMPLOYEES']}/run/", format="json").data["processed"] == 1
    leaver.refresh_from_db()
    assert leaver.personal_email == "" and leaver.phone == "" and not EmergencyContact.objects.filter(employee=leaver).exists()
    assert leaver.first_name == "Kwesi"  # The record itself is kept.


def test_employee_access_request_and_export(setup):
    client = setup["client"]
    _as(client, setup["staff_user"], setup["institution"])
    created = client.post("/api/v1/me/privacy/", {"request_type": "ACCESS", "details": "Everything please"}, format="json")
    assert created.status_code == 201, created.data
    assert created.data["due_on"] == str((timezone.localdate() + timedelta(days=30)))
    assert client.post("/api/v1/me/privacy/", {"request_type": "ACCESS"}, format="json").status_code == 400  # One open at a time.
    assert client.get("/api/v1/privacy/requests/").status_code == 403

    _as(client, setup["hr"], setup["institution"])
    export = client.get(f"/api/v1/privacy/requests/{created.data['id']}/export/")
    assert export.status_code == 200
    import json

    data = json.loads(export.content)
    assert data["subject"] == "employee" and data["profile"]["last_name"] == "Badu"
    assert client.post(f"/api/v1/privacy/requests/{created.data['id']}/status/", {"status": "COMPLETED"}, format="json").status_code == 400  # Outcome needed.
    done = client.post(f"/api/v1/privacy/requests/{created.data['id']}/status/", {"status": "COMPLETED", "outcome": "Export sent by email."}, format="json")
    assert done.data["status"] == "COMPLETED" and done.data["closed_at"]

    _as(client, setup["auditor"], setup["institution"])
    assert client.get("/api/v1/privacy/requests/").status_code == 200
    assert client.post("/api/v1/privacy/requests/", {"request_type": "ACCESS", "requester_name": "x"}, format="json").status_code == 403


def test_candidate_erasure_request(setup):
    client = setup["client"]
    created = client.post("/api/v1/privacy/requests/", {"request_type": "ERASURE", "requester_name": "Yaa Applicant", "requester_email": "yaa@example.com", "candidate": str(setup["old"].id)}, format="json")
    assert created.status_code == 201, created.data
    erased = client.post(f"/api/v1/privacy/requests/{created.data['id']}/erase/", format="json")
    assert erased.status_code == 200 and erased.data["status"] == "COMPLETED"
    assert Candidate.objects.get(pk=setup["old"].pk).first_name == "Removed"
    assert DataSubjectRequest.objects.get(pk=created.data["id"]).outcome.startswith("Candidate details anonymised")
    consents = client.get("/api/v1/privacy/requests/consents/")
    assert consents.status_code == 200
