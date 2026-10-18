from datetime import date

import pytest

from apps.employees.models import Employment
from apps.institutions.models import InstitutionModule
from apps.leave.models import LeaveRequest, LeaveType


pytestmark = pytest.mark.django_db


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, organization_factory, assignment_dimensions_factory, employee_factory):
    institution = institution_factory(code="RB")
    InstitutionModule.objects.filter(institution=institution, module_code="LEAVE").update(is_enabled=True)
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    ops, ops_position = organization_factory(institution)
    sales, sales_position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)
    head_user = user_factory()
    membership_factory(user=head_user, institution=institution, role_code="DEPARTMENT_HEAD", is_primary=True)
    staff = []
    for index, (department, position) in enumerate([(ops, ops_position)] * 3 + [(sales, sales_position)] * 2):
        employee = employee_factory(institution, user=head_user if index == 0 else None, first_name=f"P{index}", last_name="Test")
        Employment.objects.create(institution=institution, employee=employee, department=department, position=position, grade=grade, location=location, employment_type="PERMANENT", start_date=date(2025, 1, 6), is_current=True)
        staff.append(employee)
    ops.head = staff[0]
    ops.save()
    annual = LeaveType.objects.create(institution=institution, name="Annual", code="RB-AN")
    for employee, days in ((staff[1], 3), (staff[3], 5)):
        LeaveRequest.objects.create(institution=institution, employee=employee, leave_type=annual, start_date=date(2026, 11, 2), end_date=date(2026, 11, 2 + days - 1), requested_days=days, status="APPROVED")
    staff_user = user_factory()
    membership_factory(user=staff_user, institution=institution, role_code="EMPLOYEE", is_primary=True)
    _as(api_client, hr, institution)
    return {"client": api_client, "institution": institution, "hr": hr, "head_user": head_user, "staff_user": staff_user, "ops": ops, "sales": sales}


def _run(client, dataset, **definition):
    return client.post("/api/v1/report-builder/run/", {"dataset": dataset, "definition": definition}, format="json")


def test_datasets_follow_permissions(setup):
    client = setup["client"]
    keys = {row["key"] for row in client.get("/api/v1/report-builder/datasets/").data["datasets"]}
    assert {"employees", "leave_requests"} <= keys and "attendance" not in keys  # Attendance is switched off.
    fields = {row["key"] for dataset in client.get("/api/v1/report-builder/datasets/").data["datasets"] for row in dataset["fields"]}
    assert "date_of_birth" not in fields and "base_salary" not in fields
    _as(client, setup["staff_user"], setup["institution"])
    staff_keys = {row["key"] for row in client.get("/api/v1/report-builder/datasets/").data["datasets"]}
    assert "employees" not in staff_keys
    assert _run(client, "employees", columns=["employee_number"]).status_code == 400


def test_listing_grouping_filters_and_csv(setup):
    client = setup["client"]
    listing = _run(client, "employees", columns=["employee_name", "department"], sort={"field": "employee_name"})
    assert listing.status_code == 200, listing.data
    assert listing.data["total"] == 5 and listing.data["columns"][1]["label"] == "Department"
    grouped = _run(client, "employees", columns=["department"], group_by="department", aggregate={"op": "count"})
    counts = {row["department"]: row["value"] for row in grouped.data["rows"]}
    assert counts == {setup["ops"].name: 3, setup["sales"].name: 2}
    filtered = _run(client, "leave_requests", columns=["employee_name", "days"], filters=[{"field": "days", "op": "gte", "value": "4"}])
    assert [row["days"] for row in filtered.data["rows"]] == [5.0]
    total = _run(client, "leave_requests", columns=["department"], group_by="department", aggregate={"op": "sum", "field": "days"})
    assert {row["department"]: row["value"] for row in total.data["rows"]} == {setup["ops"].name: 3.0, setup["sales"].name: 5.0}
    assert _run(client, "employees", columns=["department"], group_by="department", aggregate={"op": "sum", "field": "department"}).status_code == 400
    assert _run(client, "employees", columns=["nope"]).status_code == 400
    csv = client.post("/api/v1/report-builder/run/", {"dataset": "employees", "definition": {"columns": ["employee_number", "department"]}, "format": "csv"}, format="json")
    assert csv.status_code == 200 and csv["Content-Type"].startswith("text/csv")
    assert csv.content.decode().splitlines()[0] == "Employee no.,Department"


def test_department_head_sees_only_their_team_even_in_shared_reports(setup):
    client = setup["client"]
    saved = client.post("/api/v1/custom-reports/", {"name": "Headcount", "dataset": "employees", "definition": {"columns": ["employee_name", "department"]}, "visibility": "INSTITUTION"}, format="json")
    assert saved.status_code == 201, saved.data
    _as(client, setup["head_user"], setup["institution"])
    listed = client.get("/api/v1/custom-reports/").data["results"]
    assert [row["name"] for row in listed] == ["Headcount"]
    result = client.get(f"/api/v1/custom-reports/{saved.data['id']}/run/").data
    assert result["total"] == 3 and {row["department"] for row in result["rows"]} == {setup["ops"].name}
    assert client.patch(f"/api/v1/custom-reports/{saved.data['id']}/", {"name": "Mine now"}, format="json").status_code == 403
    _as(client, setup["staff_user"], setup["institution"])
    assert client.get("/api/v1/custom-reports/").data["count"] == 0  # No employee access, so not listed.
