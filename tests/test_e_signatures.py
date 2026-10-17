from datetime import date, timedelta

import pytest
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.utils import timezone

from apps.documents.models import EMPLOYEE_ENTITY_TYPE, Document, SignatureRequest
from apps.employees.models import Employment
from apps.recruitment.models import Application, CareersSite, JobPosting, Offer, RecruitmentStage


pytestmark = pytest.mark.django_db


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, organization_factory, assignment_dimensions_factory, employee_factory):
    institution = institution_factory(code="SIGN")
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    staff_user = user_factory()
    membership_factory(user=staff_user, institution=institution, role_code="EMPLOYEE", is_primary=True)
    staff = employee_factory(institution, user=staff_user, first_name="Yaw", last_name="Darko")
    other_user = user_factory()
    membership_factory(user=other_user, institution=institution, role_code="EMPLOYEE", is_primary=True)
    other = employee_factory(institution, user=other_user, first_name="Efua", last_name="Sam")
    document = Document(institution=institution, uploaded_by=hr, original_filename="contract.pdf", content_type="application/pdf", size_bytes=10, category="Contract", entity_type=EMPLOYEE_ENTITY_TYPE, entity_id=staff.id)
    document.stored_file.save("contract.pdf", ContentFile(b"%PDF-1.4 v1"), save=False)
    document.save()
    _as(api_client, hr, institution)
    return {"client": api_client, "institution": institution, "hr": hr, "staff_user": staff_user, "staff": staff, "other_user": other_user, "other": other, "document": document}


def _request(setup, employee=None):
    return setup["client"].post("/api/v1/signature-requests/", {"document": str(setup["document"].id), "employee": str((employee or setup["staff"]).id), "title": "Employment contract", "due_date": str(date.today() + timedelta(days=7))}, format="json")


def test_employee_signs_and_record_holds_evidence(setup):
    client = setup["client"]
    created = _request(setup)
    assert created.status_code == 201, created.data
    assert len(created.data["document_sha256"]) == 64
    assert _request(setup).status_code == 400  # Already waiting.

    _as(client, setup["staff_user"], setup["institution"])
    mine = client.get("/api/v1/employees/me/signature-requests/").data
    assert [row["title"] for row in mine] == ["Employment contract"]
    sign_url = f"/api/v1/employees/me/signature-requests/{created.data['id']}/sign/"
    assert client.post(sign_url, {"signed_name": "Yaw Darko"}, format="json").status_code == 400  # Must confirm.
    assert client.post(sign_url, {"signed_name": "Someone Else", "confirm": True}, format="json").status_code == 400
    file = client.get(f"/api/v1/employees/me/signature-requests/{created.data['id']}/file/")
    assert b"".join(file.streaming_content) == b"%PDF-1.4 v1"
    signed = client.post(sign_url, {"signed_name": "yaw darko", "confirm": True}, format="json", HTTP_USER_AGENT="TestBrowser/1.0")
    assert signed.status_code == 200, signed.data
    assert signed.data["status"] == "SIGNED" and signed.data["signed_name"] == "yaw darko"
    record = SignatureRequest.objects.get(pk=created.data["id"])
    assert record.signed_by == setup["staff_user"] and record.user_agent == "TestBrowser/1.0"

    _as(client, setup["hr"], setup["institution"])
    certificate = client.get(f"/api/v1/signature-requests/{created.data['id']}/certificate/")
    text = certificate.content.decode()
    assert "Signed as: yaw darko" in text and record.document_sha256 in text


def test_changed_file_cannot_be_signed(setup):
    client = setup["client"]
    created = _request(setup).data
    document = setup["document"]
    document.stored_file.save("contract-v2.pdf", ContentFile(b"%PDF-1.4 v2 altered"), save=True)
    _as(client, setup["staff_user"], setup["institution"])
    refused = client.post(f"/api/v1/employees/me/signature-requests/{created['id']}/sign/", {"signed_name": "Yaw Darko", "confirm": True}, format="json")
    assert refused.status_code == 400 and "changed" in str(refused.data)


def test_only_the_named_employee_can_sign_or_decline(setup):
    client = setup["client"]
    # The document sits on Yaw's record, so it can't be sent to Efua.
    assert _request(setup, employee=setup["other"]).status_code == 400
    created = _request(setup).data
    _as(client, setup["other_user"], setup["institution"])
    assert client.post(f"/api/v1/employees/me/signature-requests/{created['id']}/sign/", {"signed_name": "Efua Sam", "confirm": True}, format="json").status_code == 404
    _as(client, setup["staff_user"], setup["institution"])
    url = f"/api/v1/employees/me/signature-requests/{created['id']}/decline/"
    assert client.post(url, {}, format="json").status_code == 400
    declined = client.post(url, {"reason": "Salary is wrong"}, format="json")
    assert declined.data["status"] == "DECLINED"
    _as(client, setup["hr"], setup["institution"])
    again = _request(setup).data
    assert client.post(f"/api/v1/signature-requests/{again['id']}/cancel/", format="json").data["status"] == "CANCELLED"


def test_candidate_accepts_offer_with_signature(setup, organization_factory, assignment_dimensions_factory):
    from apps.institutions.models import InstitutionModule
    from apps.recruitment.careers import issue_token
    from apps.recruitment.models import Candidate

    cache.clear()
    institution = setup["institution"]
    InstitutionModule.objects.filter(institution=institution, module_code=InstitutionModule.ModuleCode.RECRUITMENT).update(is_enabled=True)
    department, position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)
    stage = RecruitmentStage.objects.create(institution=institution, name="Applied", sequence=1)
    job = JobPosting.objects.create(institution=institution, title="Driver", department=department, position=position, location=location, employment_type="PERMANENT", status="OPEN", is_public=True)
    candidate = Candidate.objects.create(institution=institution, first_name="Kojo", last_name="Annan", email="kojo@example.com")
    application = Application.objects.create(institution=institution, job_posting=job, candidate=candidate, current_stage=stage, status="OFFERED", applied_at=timezone.now())
    Offer.objects.create(institution=institution, application=application, status="EXTENDED", proposed_start_date=date.today() + timedelta(days=30), employment_type="PERMANENT", department=department, position=position, grade=grade, location=location, terms="Probation 6 months.")
    CareersSite.objects.create(institution=institution, slug="sign", is_enabled=True)
    token = issue_token(application)
    client = setup["client"]
    client.force_authenticate(None)
    client.credentials()
    view = client.get(f"/api/v1/public/careers/track/{token}/").data
    assert view["offer"]["can_answer"] is True and view["offer"]["terms"] == "Probation 6 months."
    url = f"/api/v1/public/careers/track/{token}/offer/"
    assert client.post(url, {"response": "ACCEPT", "signed_name": "Kojo Annan"}, format="json").status_code == 400  # Must confirm.
    assert client.post(url, {"response": "ACCEPT", "signed_name": "Someone", "confirm": True}, format="json").status_code == 400
    accepted = client.post(url, {"response": "ACCEPT", "signed_name": "Kojo Annan", "confirm": True}, format="json")
    assert accepted.status_code == 200, accepted.data
    assert accepted.data["offer"]["status"] == "ACCEPTED" and accepted.data["offer"]["signed_name"] == "Kojo Annan"
    assert client.post(url, {"response": "DECLINE"}, format="json").status_code == 400
