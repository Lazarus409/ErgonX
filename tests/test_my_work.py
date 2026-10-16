from datetime import date, timedelta

import pytest
from django.utils import timezone

from apps.employees.models import EmployeeOnboarding, Employment, LifecycleTask
from apps.leave.models import LeaveRequest, LeaveType
from apps.institutions.models import InstitutionMembership, InstitutionModule


pytestmark = pytest.mark.django_db


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


def _section(payload, key):
    return next((section for section in payload["sections"] if section["key"] == key), None)


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, organization_factory, assignment_dimensions_factory, employee_factory):
    institution = institution_factory(code="MYWORK")
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    staff_user = user_factory()
    membership_factory(user=staff_user, institution=institution, role_code="EMPLOYEE", is_primary=True, status=InstitutionMembership.Status.ACTIVE)
    employee = employee_factory(institution, user=staff_user, first_name="Esi", last_name="Owusu")
    department, position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)
    Employment.objects.create(
        institution=institution, employee=employee, department=department, position=position, grade=grade, location=location,
        employment_type=Employment.EmploymentType.PERMANENT, start_date=timezone.localdate() - timedelta(days=20), is_current=True,
    )
    _as(api_client, hr, institution)
    api_client.post("/api/v1/lifecycle-task-templates/install-standard/", format="json")
    api_client.post(f"/api/v1/employees/{employee.id}/onboarding/start/", format="json")
    return {"client": api_client, "institution": institution, "hr": hr, "staff_user": staff_user, "employee": employee}


def test_employee_sees_their_own_tasks_and_requests(setup):
    client, institution, employee = setup["client"], setup["institution"], setup["employee"]
    policy = client.post("/api/v1/policies/", {"title": "Code of conduct", "body": "Be honest."}, format="json").data
    client.post(f"/api/v1/policies/{policy['id']}/publish/", format="json")
    InstitutionModule.objects.filter(institution=institution, module_code=InstitutionModule.ModuleCode.LEAVE).update(is_enabled=True)
    leave_type = LeaveType.objects.create(institution=institution, name="Annual Leave", code="MW-ANNUAL", requires_approval=True)
    LeaveRequest.objects.create(
        institution=institution, employee=employee, leave_type=leave_type, start_date=date(2026, 12, 1), end_date=date(2026, 12, 2),
        requested_days=2, status=LeaveRequest.Status.PENDING,
    )

    _as(client, setup["staff_user"], institution)
    response = client.get("/api/v1/home/my-work/")
    assert response.status_code == 200, response.data
    to_do = _section(response.data, "to_do")
    kinds = {item["kind"] for item in to_do["items"]}
    assert "policy" in kinds
    # The policy checklist item is ticked off by signing, so it is not a separate task.
    assert "checklist.own" not in kinds
    assert _section(response.data, "team") is None
    waiting = _section(response.data, "waiting")
    assert [item["kind"] for item in waiting["items"]] == ["request.leave"]
    assert response.data["summary"]["waiting_on_others"] == 1
    assert response.data["summary"]["total"] == to_do["count"] + _section(response.data, "approvals")["count"]


def test_own_checklist_item_appears_when_no_policy_is_published(setup):
    client = setup["client"]
    _as(client, setup["staff_user"], setup["institution"])
    to_do = _section(client.get("/api/v1/home/my-work/").data, "to_do")
    own = [item for item in to_do["items"] if item["kind"] == "checklist.own"]
    assert len(own) == 1 and own[0]["route"] == "/me"


def test_hr_sees_team_checklists_overdue_first_and_blocked_records(setup):
    client, employee = setup["client"], setup["employee"]
    client.post(f"/api/v1/employees/{employee.id}/onboarding/complete/", format="json")
    assert EmployeeOnboarding.objects.get(employee=employee).status == "BLOCKED"
    payload = client.get("/api/v1/home/my-work/").data
    team = _section(payload, "team")
    open_items = LifecycleTask.objects.filter(employee=employee, status="OPEN").exclude(owner="EMPLOYEE").count()
    assert team["count"] == open_items + 1  # Plus the blocked onboarding record.
    assert all(item["kind"] in ("checklist.team", "lifecycle.blocked") for item in team["items"])
    assert any(item["kind"] == "lifecycle.blocked" for item in team["items"])
    # Started 20 days ago, so the day-one items are overdue and sorted first.
    assert team["items"][0]["overdue"] is True
    flags = [item["overdue"] for item in team["items"]]
    assert flags == sorted(flags, reverse=True)
    assert team["items"][0]["route"].startswith(f"/hr/employees/{employee.id}")


def test_people_outside_the_institution_see_nothing(setup, institution_factory, user_factory, membership_factory, api_client):
    other = institution_factory(code="ELSEWHERE")
    outsider = user_factory()
    membership_factory(user=outsider, institution=other, role_code="HR_ADMIN", is_primary=True)
    _as(api_client, outsider, other)
    payload = api_client.get("/api/v1/home/my-work/").data
    assert payload["summary"]["total"] == 0
    assert _section(payload, "team") is None
