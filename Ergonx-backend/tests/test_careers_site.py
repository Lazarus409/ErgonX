from datetime import timedelta

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.recruitment.models import Application, Candidate, CandidateAccessToken, CareersSite, Interview, JobPosting, RecruitmentStage


pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clear_throttles():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, organization_factory, assignment_dimensions_factory):
    institution = institution_factory(code="APEXJOBS", name="Apex Energy")
    from apps.institutions.models import InstitutionModule

    InstitutionModule.objects.filter(institution=institution, module_code=InstitutionModule.ModuleCode.RECRUITMENT).update(is_enabled=True)
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    department, position = organization_factory(institution)
    _grade, location = assignment_dimensions_factory(institution)
    RecruitmentStage.objects.create(institution=institution, name="Applied", sequence=1)
    RecruitmentStage.objects.create(institution=institution, name="Interview", sequence=2)

    def job(title, **extra):
        values = {"institution": institution, "title": title, "department": department, "position": position, "location": location, "employment_type": "PERMANENT", "status": JobPosting.Status.OPEN, "is_public": True, "description": "Run the depot.", **extra}
        return JobPosting.objects.create(**values)

    public = job("Depot Supervisor", salary_currency="GHS", salary_min=6000, salary_max=8000)
    hidden = job("Internal Transfer", is_public=False)
    closed = job("Closed Role", closes_on=timezone.localdate() - timedelta(days=1))
    CareersSite.objects.create(institution=institution, slug="apex", is_enabled=True, headline="Join Apex")
    return {"client": api_client, "institution": institution, "hr": hr, "public": public, "hidden": hidden, "closed": closed}


def _cv(name="cv.pdf", content=b"%PDF-1.4 cv", content_type="application/pdf"):
    return SimpleUploadedFile(name, content, content_type=content_type)


def _apply(client, job, **extra):
    data = {"first_name": "Abena", "last_name": "Owusu", "email": "abena@example.com", "consent": "true", "cv": _cv(), "cover_letter": "I run depots.", **extra}
    return client.post(f"/api/v1/public/careers/apex/jobs/{job.id}/apply/", data, format="multipart")


def test_public_listing_shows_only_open_public_jobs(setup):
    client = setup["client"]
    site = client.get("/api/v1/public/careers/apex/")
    assert site.status_code == 200
    assert [job["title"] for job in site.data["jobs"]] == ["Depot Supervisor"]
    detail = client.get(f"/api/v1/public/careers/apex/jobs/{setup['public'].id}/")
    assert detail.data["job"]["salary"] == {"currency": "GHS", "min": "6000.00", "max": "8000.00"}
    assert client.get(f"/api/v1/public/careers/apex/jobs/{setup['hidden'].id}/").status_code == 404
    assert client.get("/api/v1/public/careers/nobody/").status_code == 404
    from apps.institutions.models import InstitutionModule

    InstitutionModule.objects.filter(institution=setup["institution"], module_code=InstitutionModule.ModuleCode.RECRUITMENT).update(is_enabled=False)
    assert client.get("/api/v1/public/careers/apex/").status_code == 404
    InstitutionModule.objects.filter(institution=setup["institution"], module_code=InstitutionModule.ModuleCode.RECRUITMENT).update(is_enabled=True)
    CareersSite.objects.filter(slug="apex").update(is_enabled=False)
    assert client.get("/api/v1/public/careers/apex/").status_code == 404


def test_apply_and_track(setup):
    client = setup["client"]
    response = _apply(client, setup["public"])
    assert response.status_code == 201, response.data
    token = response.data["tracking_token"]
    application = Application.objects.get(job_posting=setup["public"])
    assert application.status == "ACTIVE" and application.current_stage.name == "Applied" and application.source == "CAREERS_SITE"
    assert application.cover_letter == "I run depots." and application.consent_at is not None
    assert CandidateAccessToken.objects.get(application=application).token_hash != token  # Only the hash is stored.

    tracking = client.get(f"/api/v1/public/careers/track/{token}/")
    assert tracking.status_code == 200
    assert tracking.data["status"] == "IN_REVIEW" and tracking.data["job"]["title"] == "Depot Supervisor"
    assert [doc["category"] for doc in tracking.data["documents"]] == ["CV"]
    assert "notes" not in tracking.data and "candidate" not in tracking.data

    upload = client.post(f"/api/v1/public/careers/track/{token}/documents/", {"file": _cv("cert.pdf"), "category": "CERTIFICATE"}, format="multipart")
    assert upload.status_code == 200 and len(upload.data["documents"]) == 2

    interview = Interview.objects.create(institution=setup["institution"], application=application, scheduled_at=timezone.now() + timedelta(days=2), interviewer=setup["hr"], mode="VIDEO", location_or_link="https://meet.example.com/x")
    tracking = client.get(f"/api/v1/public/careers/track/{token}/").data
    assert tracking["status"] == "INTERVIEW" and tracking["interviews"][0]["where"] == "https://meet.example.com/x"
    confirmed = client.post(f"/api/v1/public/careers/track/{token}/interviews/{interview.id}/", {"response": "ACCEPT"}, format="json")
    assert confirmed.data["interviews"][0]["response"] == "ACCEPTED"

    withdrawn = client.post(f"/api/v1/public/careers/track/{token}/withdraw/", format="json")
    assert withdrawn.data["status"] == "WITHDRAWN" and withdrawn.data["can_withdraw"] is False
    assert client.get("/api/v1/public/careers/track/not-a-real-token/").status_code == 404


def test_closed_hidden_and_duplicate_applications_are_refused(setup):
    client = setup["client"]
    assert _apply(client, setup["hidden"]).status_code == 404
    assert _apply(client, setup["closed"]).status_code == 400
    assert _apply(client, setup["public"], consent="false").status_code == 400
    assert _apply(client, setup["public"], cv=_cv("evil.exe", b"MZ", "application/x-msdownload")).status_code == 400
    assert _apply(client, setup["public"]).status_code == 201
    assert _apply(client, setup["public"]).status_code == 400


def test_existing_candidate_details_are_not_overwritten_and_links_stay_separate(setup):
    institution, client = setup["institution"], setup["client"]
    Candidate.objects.create(institution=institution, first_name="Abena", last_name="Owusu", email="abena@example.com", phone="+233200000000")
    other = JobPosting.objects.create(institution=institution, title="Planner", department=setup["public"].department, position=setup["public"].position, location=setup["public"].location, employment_type="PERMANENT", status="OPEN", is_public=True)
    first = _apply(client, setup["public"], phone="+233999999999").data["tracking_token"]
    second = _apply(client, other, email="ABENA@example.com").data["tracking_token"]
    candidate = Candidate.objects.get(institution=institution, email="abena@example.com")
    assert candidate.phone == "+233200000000"
    assert client.get(f"/api/v1/public/careers/track/{first}/").data["job"]["title"] == "Depot Supervisor"
    assert client.get(f"/api/v1/public/careers/track/{second}/").data["job"]["title"] == "Planner"


def test_honeypot_and_expired_links(setup):
    client = setup["client"]
    bot = _apply(client, setup["public"], website="http://spam.example")
    assert bot.status_code == 201 and bot.data["tracking_token"] is None
    assert not Application.objects.exists()
    token = _apply(client, setup["public"]).data["tracking_token"]
    CandidateAccessToken.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
    assert client.get(f"/api/v1/public/careers/track/{token}/").status_code == 404


def test_hr_settings_and_public_flag(setup):
    from apps.institutions.models import InstitutionModule

    InstitutionModule.objects.filter(institution=setup["institution"], module_code=InstitutionModule.ModuleCode.RECRUITMENT).update(is_enabled=True)
    client = setup["client"]
    client.force_authenticate(setup["hr"])
    client.credentials(HTTP_X_INSTITUTION_ID=str(setup["institution"].id))
    current = client.get("/api/v1/recruitment/careers-site/")
    assert current.data["slug"] == "apex" and current.data["exists"] is True
    saved = client.put("/api/v1/recruitment/careers-site/", {"slug": "Apex-Energy", "is_enabled": True, "headline": "Work with us", "introduction": "", "privacy_notice": "We keep CVs for 12 months."}, format="json")
    assert saved.status_code == 200, saved.data
    assert saved.data["slug"] == "apex-energy"
    toggled = client.patch(f"/api/v1/recruitment/job-postings/{setup['hidden'].id}/", {"is_public": True}, format="json")
    assert toggled.status_code == 200 and toggled.data["is_public"] is True
    client.force_authenticate(None)
    client.credentials()
    assert len(client.get("/api/v1/public/careers/apex-energy/").data["jobs"]) == 2
