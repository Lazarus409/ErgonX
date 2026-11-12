"""Privacy gaps closed 2026-11: complete subject exports, scheduled retention, breach register, registration."""
from datetime import date, timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.employees.models import EmergencyContact
from apps.privacy import services
from apps.privacy.models import RetentionRule
from apps.recruitment.models import Application, Candidate, JobPosting

pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, employee_factory):
    institution = institution_factory(code="PRV")
    officer = user_factory()
    membership_factory(user=officer, institution=institution, role_code="HR_ADMIN", is_primary=True)
    api_client.force_authenticate(officer)
    api_client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))
    employee = employee_factory(institution, first_name="Ama", last_name="Owusu", personal_email="ama@example.com", date_of_birth=date(1990, 3, 4))
    return {"client": api_client, "institution": institution, "officer": officer, "employee": employee}


def test_employee_export_covers_pay_bank_attendance_and_more(setup):
    from apps.payroll.models import EmployeePayrollProfile

    employee = setup["employee"]
    EmployeePayrollProfile.objects.create(institution=setup["institution"], employee=employee, tax_residency="RESIDENT", tax_identification_number="P0012345678", bank_name="GCB", account_number="1234567890")
    EmergencyContact.objects.create(institution=setup["institution"], employee=employee, full_name="Kofi Owusu", relationship="Brother", phone="0244000000")

    data = services._employee_export(employee)

    assert data["profile"]["date_of_birth"] == "1990-03-04"
    assert data["pay_and_tax_details"]["tax_identification_number"] == "P0012345678"
    assert data["pay_and_tax_details"]["account_number"] == "1234567890"
    assert data["emergency_contacts"][0]["name"] == "Kofi Owusu"
    for section in ("compensation", "payslips", "tax_relief_claims", "leave_requests", "attendance", "performance_reviews", "training", "expense_claims", "complaints_raised", "documents", "policy_acknowledgements"):
        assert data[section] == [], section


def test_scheduled_retention_anonymises_due_candidates_and_respects_holds(setup, organization_factory, assignment_dimensions_factory):
    institution = setup["institution"]
    department, position = organization_factory(institution)
    _, location = assignment_dimensions_factory(institution)
    posting = JobPosting.objects.create(institution=institution, title="Driver", status="CLOSED", department=department, position=position, location=location, employment_type="PERMANENT")
    old, held = [Candidate.objects.create(institution=institution, first_name=name, last_name="Applicant", email=f"{name}@example.com") for name in ("Old", "Held")]
    for candidate in (old, held):
        application = Application.objects.create(institution=institution, job_posting=posting, candidate=candidate, status="REJECTED")
        Application.objects.filter(pk=application.pk).update(updated_at=timezone.now() - timedelta(days=800))
        Candidate.objects.filter(pk=candidate.pk).update(updated_at=timezone.now() - timedelta(days=800))
    hold = services.LegalHold.objects.create(institution=institution, title="Tribunal", reason="Pending case", created_by=setup["officer"])
    hold.candidates.add(held)
    RetentionRule.objects.create(institution=institution, category="CANDIDATES", keep_months=12, action="ANONYMISE")
    due = list(services.due_candidates(institution, RetentionRule.objects.get(institution=institution)))
    assert old in due and held not in due

    call_command("run_retention_rules")

    old.refresh_from_db()
    held.refresh_from_db()
    assert old.email != "Old@example.com" and held.email == "Held@example.com"
    assert RetentionRule.objects.get(institution=institution).last_run_at is not None


def test_breach_register_requires_notification_decisions_before_closing(setup):
    client = setup["client"]
    discovered = timezone.now() - timedelta(hours=30)
    created = client.post("/api/v1/privacy/breaches/", {
        "title": "Payroll file emailed to the wrong person", "description": "November payroll sent to an external address.",
        "discovered_at": discovered.isoformat(), "severity": "HIGH", "data_categories": ["payroll_results", "tax_and_bank"], "people_affected": 42,
    }, format="json")
    assert created.status_code == 201, created.data
    breach = created.data
    assert breach["status"] == "OPEN" and breach["data_category_labels"][0].startswith("Payroll results")
    assert breach["hours_to_commission"] >= 30
    assert client.post("/api/v1/privacy/breaches/", {"title": "x", "description": "x", "discovered_at": discovered.isoformat(), "data_categories": ["nope"]}, format="json").status_code == 400

    profile = client.get("/api/v1/privacy/profile/").data
    assert profile["compliance"]["breaches_not_reported"] == 1 and profile["compliance"]["registration"] == "MISSING"

    url = f"/api/v1/privacy/breaches/{breach['id']}/"
    assert client.post(url + "close/", {}, format="json").status_code == 400  # not contained yet
    contained = client.patch(url, {"contained_at": timezone.now().isoformat(), "containment": "Recipient deleted the email and confirmed in writing."}, format="json")
    assert contained.status_code == 200 and contained.data["status"] == "CONTAINED"
    refused = client.post(url + "close/", {}, format="json")
    assert refused.status_code == 400 and "Commission" in refused.data["message"]
    closed = client.post(url + "close/", {"commission_notified_at": timezone.now().isoformat(), "commission_reference": "DPC-2026-118", "subjects_notified_at": timezone.now().isoformat()}, format="json")
    assert closed.status_code == 200, closed.data
    assert closed.data["status"] == "CLOSED" and closed.data["commission_reference"] == "DPC-2026-118"
    assert client.patch(url, {"title": "Changed"}, format="json").status_code == 400


def test_registration_and_officer_details(setup):
    client = setup["client"]
    today = timezone.localdate()
    saved = client.patch("/api/v1/privacy/profile/", {
        "registration_number": "DPC-123", "registered_on": str(today - timedelta(days=700)), "registration_expires_on": str(today + timedelta(days=30)),
        "officer_name": "Efua Agyeman", "officer_email": "dpo@example.com",
    }, format="json")
    assert saved.status_code == 200, saved.data
    assert saved.data["compliance"]["registration"] == "EXPIRING" and saved.data["compliance"]["officer_named"] is True
    bad = client.patch("/api/v1/privacy/profile/", {"registration_expires_on": str(today - timedelta(days=800))}, format="json")
    assert bad.status_code == 400
    expired = client.patch("/api/v1/privacy/profile/", {"registration_expires_on": str(today - timedelta(days=1))}, format="json")
    assert expired.data["compliance"]["registration"] == "EXPIRED"
