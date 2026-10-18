from datetime import date

import pytest

from apps.employees.models import Employment
from apps.performance.models import Goal


pytestmark = pytest.mark.django_db
PERIOD = {"period_start": "2026-07-01", "period_end": "2026-12-31"}


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, organization_factory, assignment_dimensions_factory, employee_factory):
    institution = institution_factory(code="GOALS")
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    department, position = organization_factory(institution)
    other_department, other_position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)

    def person(first, dept, role="EMPLOYEE", reports_to=None):
        user = user_factory()
        membership_factory(user=user, institution=institution, role_code=role, is_primary=True)
        employee = employee_factory(institution, user=user, first_name=first, last_name="Test")
        employment = Employment.objects.create(
            institution=institution, employee=employee, department=dept, position=position if dept == department else other_position, grade=grade, location=location,
            employment_type=Employment.EmploymentType.PERMANENT, start_date=date(2026, 1, 5), is_current=True, reports_to=reports_to,
        )
        return user, employee, employment

    head_user, head, head_employment = person("Head", department, role="DEPARTMENT_HEAD")
    department.head = head
    department.save()
    staff_user, staff, _ = person("Staff", department, reports_to=head_employment)
    outsider_user, outsider, _ = person("Outsider", other_department)
    _as(api_client, hr, institution)
    return locals() | {"client": api_client}


def _create(client, **values):
    payload = {"title": "Grow revenue", **PERIOD, **values}
    return client.post("/api/v1/goals/", payload, format="json")


def test_cascade_and_visibility(setup):
    client, institution = setup["client"], setup["institution"]
    company = _create(client, level="COMPANY", key_results=[{"title": "Revenue", "unit": "GHS m", "start_value": 10, "target_value": 20}])
    assert company.status_code == 201, company.data
    assert company.data["status"] == "DRAFT"
    client.post(f"/api/v1/goals/{company.data['id']}/activate/", format="json")

    _as(client, setup["head_user"], institution)
    dept = _create(client, level="DEPARTMENT", department=str(setup["department"].id), parent=company.data["id"], title="Win 5 depot contracts")
    assert dept.status_code == 201, dept.data
    assert client.post(f"/api/v1/goals/{dept.data['id']}/activate/", format="json").status_code == 200
    # A department head can't set goals for another department.
    assert _create(client, level="DEPARTMENT", department=str(setup["other_department"].id)).status_code == 400

    _as(client, setup["staff_user"], institution)
    own = _create(client, level="INDIVIDUAL", employee=str(setup["staff"].id), parent=dept.data["id"], title="Close 2 contracts", key_results=[{"title": "Contracts", "target_value": 2}])
    assert own.status_code == 201, own.data
    assert own.data["status"] == "DRAFT"
    # The employee can't agree their own goal.
    assert client.post(f"/api/v1/goals/{own.data['id']}/activate/", format="json").status_code == 400
    visible = {row["title"] for row in client.get("/api/v1/goals/").data["results"]}
    assert visible == {"Grow revenue", "Win 5 depot contracts", "Close 2 contracts"}

    _as(client, setup["outsider_user"], institution)
    visible = {row["title"] for row in client.get("/api/v1/goals/").data["results"]}
    assert "Close 2 contracts" not in visible and "Win 5 depot contracts" in visible
    assert client.get(f"/api/v1/goals/{own.data['id']}/").status_code == 404

    _as(client, setup["head_user"], institution)
    agreed = client.post(f"/api/v1/goals/{own.data['id']}/activate/", format="json")
    assert agreed.status_code == 200 and agreed.data["status"] == "ACTIVE"
    detail = client.get(f"/api/v1/goals/{dept.data['id']}/").data
    assert [child["title"] for child in detail["children"]] == ["Close 2 contracts"]


def test_check_ins_move_progress(setup):
    client, institution = setup["client"], setup["institution"]
    _as(client, setup["head_user"], institution)
    goal = _create(client, level="INDIVIDUAL", employee=str(setup["staff"].id), key_results=[
        {"title": "Contracts", "target_value": 4},
        {"title": "Pipeline", "unit": "GHS k", "start_value": 0, "target_value": 200},
    ]).data
    assert goal["status"] == "ACTIVE"  # Set by the manager, so agreed at once.
    first, second = goal["key_results"]
    _as(client, setup["staff_user"], institution)
    checked = client.post(f"/api/v1/goals/{goal['id']}/check-in/", {"health": "AT_RISK", "note": "Slow month", "values": {first["id"]: "2", second["id"]: "50"}}, format="json")
    assert checked.status_code == 200, checked.data
    assert checked.data["progress"] == round((50 + 25) / 2)
    assert checked.data["health"] == "AT_RISK"
    detail = client.get(f"/api/v1/goals/{goal['id']}/").data
    assert detail["check_ins"][0]["note"] == "Slow month"
    # Active goals' targets are the manager's to change.
    assert client.patch(f"/api/v1/goals/{goal['id']}/", {"title": "Easier goal"}, format="json").status_code == 400
    assert client.post(f"/api/v1/goals/{goal['id']}/complete/", format="json").data["status"] == "COMPLETED"
    assert client.post(f"/api/v1/goals/{goal['id']}/check-in/", {"health": "ON_TRACK"}, format="json").status_code == 400


def test_goal_without_key_results_uses_reported_progress(setup):
    client = setup["client"]
    goal = _create(client, level="INDIVIDUAL", employee=str(setup["staff"].id), title="Finish IOSH course").data
    assert goal["status"] == "ACTIVE"
    checked = client.post(f"/api/v1/goals/{goal['id']}/check-in/", {"health": "ON_TRACK", "progress": 60}, format="json")
    assert checked.data["progress"] == 60


def test_rules(setup):
    client, institution = setup["client"], setup["institution"]
    assert _create(client, level="INDIVIDUAL").status_code == 400  # Whose goal?
    assert _create(client, level="COMPANY", period_start="2026-12-31", period_end="2026-01-01").status_code == 400
    company = _create(client, level="COMPANY").data
    child = _create(client, level="COMPANY", parent=company["id"])
    assert child.status_code == 400  # Align upwards only.
    _as(client, setup["staff_user"], institution)
    assert _create(client, level="COMPANY").status_code == 400
    assert _create(client, level="INDIVIDUAL", employee=str(setup["outsider"].id)).status_code == 400
    assert Goal.objects.filter(level="INDIVIDUAL").count() == 0
