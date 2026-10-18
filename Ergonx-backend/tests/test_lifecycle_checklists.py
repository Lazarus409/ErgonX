from datetime import date, timedelta

import pytest

from apps.audit.models import AuditLog
from apps.employees.lifecycle import STANDARD_CHECKLISTS
from apps.employees.models import Employee, EmployeeOffboarding, EmployeeOnboarding, Employment, LifecycleTask, LifecycleTaskTemplate
from apps.institutions.models import InstitutionMembership


pytestmark = pytest.mark.django_db


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, organization_factory, assignment_dimensions_factory, employee_factory):
    institution = institution_factory(code="CHECKLIST")
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    employee_user = user_factory()
    membership_factory(user=employee_user, institution=institution, role_code="EMPLOYEE", is_primary=True, status=InstitutionMembership.Status.INVITED)
    employee = employee_factory(institution, user=employee_user)
    department, position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)
    Employment.objects.create(
        institution=institution, employee=employee, department=department, position=position, grade=grade, location=location,
        employment_type=Employment.EmploymentType.PERMANENT, start_date=date(2026, 3, 2), is_current=True,
    )
    api_client.force_authenticate(hr)
    api_client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))
    return {"institution": institution, "hr": hr, "employee": employee, "employee_user": employee_user, "client": api_client}


def _install(client):
    response = client.post("/api/v1/lifecycle-task-templates/install-standard/", format="json")
    assert response.status_code == 200
    return response.data["created"]


def _close_required(client, employee, record):
    for task in record["tasks"]:
        if task["is_required"] and task["status"] == "OPEN":
            response = client.patch(f"/api/v1/employees/{employee.id}/lifecycle-tasks/{task['id']}/", {"status": "DONE"}, format="json")
            assert response.status_code == 200, response.data


def test_standard_checklists_install_once(setup):
    client = setup["client"]
    created = _install(client)
    assert created == {"ONBOARDING": len(STANDARD_CHECKLISTS["ONBOARDING"]), "OFFBOARDING": len(STANDARD_CHECKLISTS["OFFBOARDING"])}
    assert _install(client) == {"ONBOARDING": 0, "OFFBOARDING": 0}
    listing = client.get("/api/v1/lifecycle-task-templates/?process=OFFBOARDING")
    assert listing.status_code == 200
    assert listing.data["count"] == len(STANDARD_CHECKLISTS["OFFBOARDING"])


def test_onboarding_without_templates_completes_as_before(setup):
    client, employee = setup["client"], setup["employee"]
    response = client.post(f"/api/v1/employees/{employee.id}/onboarding/complete/", format="json")
    assert response.status_code == 200
    assert response.data["status"] == "COMPLETED"
    assert response.data["tasks"] == []


def test_onboarding_checklist_blocks_completion_until_required_items_close(setup):
    client, employee = setup["client"], setup["employee"]
    _install(client)
    started = client.post(f"/api/v1/employees/{employee.id}/onboarding/start/", format="json")
    assert started.status_code == 200
    tasks = started.data["tasks"]
    assert len(tasks) == len(STANDARD_CHECKLISTS["ONBOARDING"])
    # Due dates count from the employment start date.
    contract = next(task for task in tasks if task["title"] == "Sign employment contract")
    assert contract["due_date"] == "2026-03-02"
    policy = next(task for task in tasks if task["category"] == "POLICY")
    assert policy["due_date"] == "2026-03-09"
    # Starting again does not duplicate the checklist.
    again = client.post(f"/api/v1/employees/{employee.id}/onboarding/start/", format="json")
    assert len(again.data["tasks"]) == len(tasks)

    blocked = client.post(f"/api/v1/employees/{employee.id}/onboarding/complete/", format="json")
    assert blocked.data["status"] == "BLOCKED"
    assert "required checklist items are still open" in blocked.data["blocked_reason"]
    assert blocked.data["checklist"]["required_open"] == sum(1 for item in STANDARD_CHECKLISTS["ONBOARDING"] if item[5])
    assert InstitutionMembership.objects.get(user=setup["employee_user"]).status == InstitutionMembership.Status.INVITED

    _close_required(client, employee, blocked.data)
    completed = client.post(f"/api/v1/employees/{employee.id}/onboarding/complete/", format="json")
    assert completed.data["status"] == "COMPLETED"
    assert completed.data["blocked_reason"] == ""
    assert InstitutionMembership.objects.get(user=setup["employee_user"]).status == InstitutionMembership.Status.ACTIVE
    # A completed checklist is frozen.
    open_task = next(task for task in completed.data["tasks"] if task["status"] == "OPEN")
    frozen = client.patch(f"/api/v1/employees/{employee.id}/lifecycle-tasks/{open_task['id']}/", {"status": "DONE"}, format="json")
    assert frozen.status_code == 400


def test_required_item_needs_a_reason_to_be_not_applicable(setup):
    client, employee = setup["client"], setup["employee"]
    _install(client)
    task = client.post(f"/api/v1/employees/{employee.id}/onboarding/start/", format="json").data["tasks"][0]
    url = f"/api/v1/employees/{employee.id}/lifecycle-tasks/{task['id']}/"
    assert client.patch(url, {"status": "NOT_APPLICABLE"}, format="json").status_code == 400
    ok = client.patch(url, {"status": "NOT_APPLICABLE", "note": "Contract signed on paper before ErgonX."}, format="json")
    assert ok.status_code == 200
    assert ok.data["completed_by_name"]
    reopened = client.patch(url, {"status": "OPEN"}, format="json")
    assert reopened.data["completed_at"] is None
    assert AuditLog.objects.filter(action="employee.lifecycle_task.status_changed").count() == 2


def test_offboarding_checklist_blocks_termination_and_keeps_hr_notes(setup):
    client, employee = setup["client"], setup["employee"]
    _install(client)
    started = client.post(
        f"/api/v1/employees/{employee.id}/offboarding/start/",
        {"last_working_day": "2026-06-30", "notes": "Relocating abroad."}, format="json",
    )
    assert started.status_code == 200
    asset = next(task for task in started.data["tasks"] if task["category"] == "ASSET_RETURN")
    assert asset["due_date"] == "2026-06-30"

    # Moving the last working day moves open standard items.
    moved = client.post(f"/api/v1/employees/{employee.id}/offboarding/start/", {"last_working_day": "2026-07-10"}, format="json")
    asset = next(task for task in moved.data["tasks"] if task["category"] == "ASSET_RETURN")
    assert asset["due_date"] == "2026-07-10"

    blocked = client.post(f"/api/v1/employees/{employee.id}/offboarding/complete/", format="json")
    assert blocked.data["status"] == "BLOCKED"
    assert blocked.data["notes"] == "Relocating abroad."
    assert "checklist" in blocked.data["blocked_reason"]
    employee.refresh_from_db()
    assert employee.status != Employee.Status.TERMINATED

    _close_required(client, employee, blocked.data)
    completed = client.post(f"/api/v1/employees/{employee.id}/offboarding/complete/", format="json")
    assert completed.data["status"] == "COMPLETED"
    employee.refresh_from_db()
    assert employee.status == Employee.Status.TERMINATED


def test_ad_hoc_items_can_be_added_and_removed_but_standard_items_cannot(setup):
    client, employee = setup["client"], setup["employee"]
    _install(client)
    url = f"/api/v1/employees/{employee.id}/lifecycle-tasks/"
    assert client.post(url, {"process": "OFFBOARDING", "title": "Return fuel card"}, format="json").status_code == 400
    started = client.post(f"/api/v1/employees/{employee.id}/offboarding/start/", {"last_working_day": "2026-06-30"}, format="json")
    added = client.post(url, {"process": "OFFBOARDING", "title": "Return fuel card", "category": "ASSET_RETURN", "owner": "FINANCE", "is_required": False}, format="json")
    assert added.status_code == 201
    assert added.data["is_standard"] is False
    assert client.delete(f"{url}{added.data['id']}/").status_code == 204
    standard = started.data["tasks"][0]
    assert client.delete(f"{url}{standard['id']}/").status_code == 400


def test_templates_are_tenant_scoped_and_need_update_permission(setup, institution_factory, user_factory, membership_factory, api_client):
    _install(setup["client"])
    other = institution_factory(code="OTHER")
    outsider = user_factory()
    membership_factory(user=outsider, institution=other, role_code="HR_ADMIN", is_primary=True)
    api_client.force_authenticate(outsider)
    api_client.credentials(HTTP_X_INSTITUTION_ID=str(other.id))
    assert api_client.get("/api/v1/lifecycle-task-templates/").data["count"] == 0

    staff = user_factory()
    membership_factory(user=staff, institution=setup["institution"], role_code="EMPLOYEE")
    api_client.force_authenticate(staff)
    api_client.credentials(HTTP_X_INSTITUTION_ID=str(setup["institution"].id))
    response = api_client.post("/api/v1/lifecycle-task-templates/", {"process": "ONBOARDING", "title": "Sneaky"}, format="json")
    assert response.status_code == 403


def test_template_offset_is_bounded(setup):
    response = setup["client"].post("/api/v1/lifecycle-task-templates/", {"process": "ONBOARDING", "title": "Far", "due_offset_days": 900}, format="json")
    assert response.status_code == 400


def test_rehire_starts_onboarding_with_a_fresh_checklist(setup):
    client, employee, institution = setup["client"], setup["employee"], setup["institution"]
    _install(client)
    client.post(f"/api/v1/employees/{employee.id}/onboarding/start/", format="json")
    Employment.objects.filter(employee=employee).update(is_current=False, status=Employment.Status.ENDED, end_date=date(2026, 5, 1))
    Employee.objects.filter(pk=employee.pk).update(status=Employee.Status.TERMINATED)
    current = Employment.objects.filter(employee=employee).first()
    response = client.post(f"/api/v1/employees/{employee.id}/rehire/", {
        "department_id": str(current.department_id), "position_id": str(current.position_id), "grade_id": str(current.grade_id),
        "location_id": str(current.location_id), "employment_type": "PERMANENT", "staff_category": current.staff_category,
        "start_date": str(date(2026, 8, 3)),
    }, format="json")
    assert response.status_code in (200, 201), response.data
    latest = EmployeeOnboarding.objects.filter(employee=employee).order_by("-created_at").first()
    assert latest.tasks.count() == len(STANDARD_CHECKLISTS["ONBOARDING"])
    assert latest.tasks.get(title="Sign employment contract").due_date == date(2026, 8, 3)
    assert LifecycleTask.objects.filter(employee=employee, institution=institution).count() == 2 * len(STANDARD_CHECKLISTS["ONBOARDING"])
