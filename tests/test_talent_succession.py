from datetime import date

import pytest
from django.utils import timezone

from apps.employees.models import Employment
from apps.performance.models import PerformanceReview, ReviewCycle


pytestmark = pytest.mark.django_db


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, organization_factory, assignment_dimensions_factory, employee_factory):
    institution = institution_factory(code="TALENT")
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    director = user_factory()
    membership_factory(user=director, institution=institution, role_code="DIRECTOR", is_primary=True)
    department, position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)
    people = {}
    for key in ("manager", "deputy", "analyst"):
        user = user_factory()
        membership_factory(user=user, institution=institution, role_code="EMPLOYEE", is_primary=True)
        employee = employee_factory(institution, user=user, first_name=key.title(), last_name="Test")
        Employment.objects.create(
            institution=institution, employee=employee, department=department, position=position, grade=grade, location=location,
            employment_type=Employment.EmploymentType.PERMANENT, start_date=date(2026, 1, 5), is_current=True,
        )
        people[key] = (user, employee)
    cycle = ReviewCycle.objects.create(institution=institution, name="2026", period_start=date(2026, 1, 1), period_end=date(2026, 6, 30), status=ReviewCycle.Status.CLOSED)
    PerformanceReview.objects.create(institution=institution, cycle=cycle, employee=people["deputy"][1], status=PerformanceReview.Status.COMPLETED, overall_rating=5, signed_off_at=timezone.now())
    PerformanceReview.objects.create(institution=institution, cycle=cycle, employee=people["analyst"][1], status=PerformanceReview.Status.COMPLETED, overall_rating=4, calibrated_rating=3, signed_off_at=timezone.now())
    _as(api_client, hr, institution)
    return {"client": api_client, "institution": institution, "hr": hr, "director": director, "position": position, **people}


def test_succession_plan_with_successors_and_cover(setup):
    client = setup["client"]
    plan = client.post("/api/v1/succession-plans/", {"position": str(setup["position"].id), "risk_of_loss": "HIGH", "impact_of_loss": "HIGH"}, format="json")
    assert plan.status_code == 201, plan.data
    assert plan.data["cover"]["status"] == "NONE"
    assert {person["name"] for person in plan.data["incumbents"]} == {"Manager Test", "Deputy Test", "Analyst Test"}
    url = f"/api/v1/succession-plans/{plan.data['id']}/successors/"
    added = client.post(url, {"employee": str(setup["analyst"][1].id), "readiness": "THREE_PLUS_YEARS"}, format="json")
    assert added.data["cover"]["status"] == "DEVELOPING"
    added = client.post(url, {"employee": str(setup["deputy"][1].id), "readiness": "READY_NOW", "development_notes": "Shadow budget rounds"}, format="json")
    assert added.data["cover"] == {"status": "READY", "READY_NOW": 1, "ONE_TO_TWO_YEARS": 0, "THREE_PLUS_YEARS": 1}
    deputy = next(row for row in added.data["successors"] if row["employee_name"] == "Deputy Test")
    assert deputy["latest_rating"] == 5
    # Naming someone again updates their readiness instead of duplicating them.
    again = client.post(url, {"employee": str(setup["deputy"][1].id), "readiness": "ONE_TO_TWO_YEARS"}, format="json")
    assert len(again.data["successors"]) == 2 and again.data["cover"]["status"] == "DEVELOPING"
    removed = client.delete(f"{url}{deputy['id']}/")
    assert removed.status_code == 200 and len(removed.data["successors"]) == 1
    # One plan per position.
    assert client.post("/api/v1/succession-plans/", {"position": str(setup["position"].id)}, format="json").status_code == 400


def test_talent_grid_uses_final_ratings_and_assessments(setup):
    client = setup["client"]
    grid = client.get("/api/v1/talent-grid/").data
    rows = {row["employee"]: row for row in grid["employees"]}
    assert rows["Deputy Test"]["performance"] == "HIGH"
    assert rows["Analyst Test"]["performance"] == "MEDIUM"  # The calibrated rating counts.
    assert rows["Manager Test"]["performance"] == ""
    saved = client.post("/api/v1/talent-grid/", {"employee": str(setup["deputy"][1].id), "potential": "HIGH", "flight_risk": "HIGH", "in_talent_pool": True}, format="json")
    assert saved.status_code == 200, saved.data
    assert saved.data["potential"] == "HIGH" and saved.data["in_talent_pool"] is True
    grid = client.get("/api/v1/talent-grid/").data
    assert grid["boxes"]["HIGH:HIGH"] == 1 and grid["summary"]["talent_pool"] == 1 and grid["summary"]["high_flight_risk"] == 1
    override = client.post("/api/v1/talent-grid/", {"employee": str(setup["manager"][1].id), "potential": "MEDIUM", "performance_override": "MEDIUM"}, format="json")
    assert override.data["performance"] == "MEDIUM" and override.data["performance_overridden"] is True


def test_talent_data_is_confidential(setup):
    client = setup["client"]
    plan = client.post("/api/v1/succession-plans/", {"position": str(setup["position"].id)}, format="json").data
    _as(client, setup["director"], setup["institution"])
    assert client.get("/api/v1/talent-grid/").status_code == 200
    assert client.get("/api/v1/succession-plans/").status_code == 200
    assert client.post("/api/v1/talent-grid/", {"employee": str(setup["deputy"][1].id), "potential": "LOW"}, format="json").status_code == 403
    _as(client, setup["deputy"][0], setup["institution"])
    assert client.get("/api/v1/talent-grid/").status_code == 403
    assert client.get(f"/api/v1/succession-plans/{plan['id']}/").status_code == 403
