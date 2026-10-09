"""Employee complaints: filing, confidentiality, the HR workflow and conflict-of-interest guards."""

from datetime import date, timedelta

import pytest

from apps.audit.models import AuditLog
from apps.complaints.models import Complaint
from apps.employees.models import Employee, Employment
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

COMPLAINTS = "/api/v1/complaints/"


@pytest.fixture
def people(api_client, institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory):
    institution = institution_factory()
    department, position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)

    def person(email, role):
        user = user_factory(email=email)
        membership_factory(user=user, institution=institution, role_code=role)
        employee = employee_factory(institution, user=user)
        Employment.objects.create(institution=institution, employee=employee, department=department, position=position, grade=grade, location=location, employment_type="PERMANENT", staff_category="SENIOR", start_date=date(2025, 1, 1), status="ACTIVE", is_current=True)
        return user

    return {
        "client": api_client,
        "institution": institution,
        "hr": person("hr.cmp@example.com", "HR_ADMIN"),
        "hr2": person("hr2.cmp@example.com", "HR_ADMIN"),
        "head": person("head.cmp@example.com", "DEPARTMENT_HEAD"),
        "staff": person("staff.cmp@example.com", "EMPLOYEE"),
        "colleague": person("colleague.cmp@example.com", "EMPLOYEE"),
        "director": person("director.cmp@example.com", "DIRECTOR"),
    }


def employee_of(user):
    return Employee.objects.get(user=user)


def file(people, user="staff", respondent=None, **extra):
    client = people["client"]
    client.force_authenticate(people[user])
    payload = {"category": "BULLYING", "subject": "Shouted at in meetings", "description": "My supervisor shouts at me in team meetings.", "incident_date": str(date.today()), **extra}
    if respondent:
        payload["respondent"] = str(employee_of(people[respondent]).id)
    response = client.post(COMPLAINTS, payload, format="json")
    assert response.status_code == 201, response.data
    return response.data


def test_employee_files_and_hr_is_notified(people):
    data = file(people, respondent="head")
    assert data["code"].startswith("CMP-") and data["status"] == "SUBMITTED"
    assert data["viewer"]["is_complainant"] and data["viewer"]["can_withdraw"]
    assert Notification.objects.filter(user=people["hr"], notification_type="COMPLAINT_FILED").exists()
    # The audit trail records the event, never the confidential text.
    log = AuditLog.objects.get(action="complaint.filed")
    assert "shouts" not in str(log.metadata) and log.metadata["category"] == "BULLYING"


def test_confidentiality(people):
    data = file(people, respondent="head")
    client = people["client"]
    for user, visible in (("head", False), ("colleague", False), ("director", True), ("hr", True)):
        client.force_authenticate(people[user])
        assert (client.get(f"{COMPLAINTS}{data['id']}/").status_code == 200) is visible, user
        assert any(row["id"] == data["id"] for row in client.get(COMPLAINTS).data["results"]) is visible, user


def test_hr_named_in_a_complaint_cannot_see_or_handle_it(people):
    data = file(people, respondent="hr")
    client = people["client"]
    client.force_authenticate(people["hr"])
    assert client.get(f"{COMPLAINTS}{data['id']}/").status_code == 404
    assert not Notification.objects.filter(user=people["hr"], notification_type="COMPLAINT_FILED").exists()
    client.force_authenticate(people["hr2"])
    assert client.post(f"{COMPLAINTS}{data['id']}/assign/", {"assignee": str(people["hr"].id)}, format="json").status_code == 400
    assert client.post(f"{COMPLAINTS}{data['id']}/assign/", {"assignee": str(people["hr2"].id)}, format="json").data["status"] == "UNDER_REVIEW"


def test_full_workflow_with_internal_and_shared_notes(people):
    data = file(people)
    client = people["client"]
    url = f"{COMPLAINTS}{data['id']}/"
    client.force_authenticate(people["hr"])
    assert client.post(url + "investigate/").data["status"] == "INVESTIGATING"
    assert client.post(url + "priority/", {"priority": "HIGH"}, format="json").data["priority"] == "HIGH"
    client.post(url + "notes/", {"body": "Interview the team lead first.", "is_internal": True}, format="json")
    client.post(url + "notes/", {"body": "Can you share the meeting dates?"}, format="json")
    assert client.post(url + "resolve/", {"text": ""}, format="json").status_code == 400
    client.force_authenticate(people["staff"])
    detail = client.get(url).data
    assert [note["body"] for note in detail["notes"]] == ["Can you share the meeting dates?"]
    assert client.post(url + "notes/", {"body": "Mondays in September.", "is_internal": True}, format="json").status_code == 400
    assert client.post(url + "notes/", {"body": "Mondays in September."}, format="json").status_code == 200
    assert client.post(url + "investigate/").status_code == 403
    client.force_authenticate(people["hr"])
    resolved = client.post(url + "resolve/", {"text": "Supervisor received a written warning and coaching."}, format="json").data
    assert resolved["status"] == "RESOLVED" and len(resolved["notes"]) == 3
    assert Notification.objects.filter(user=people["staff"], notification_type="COMPLAINT_RESOLVED").exists()
    assert client.post(url + "close/").data["status"] == "CLOSED"
    overview = client.get(f"{COMPLAINTS}overview/").data
    assert overview["total"] == 1 and overview["open"] == 0 and overview["by_status"]["CLOSED"] == 1


def test_withdraw_reopen_and_guards(people):
    first = file(people)
    second = file(people)
    client = people["client"]
    client.force_authenticate(people["colleague"])
    assert client.post(f"{COMPLAINTS}{first['id']}/withdraw/").status_code == 404
    client.force_authenticate(people["staff"])
    assert client.post(f"{COMPLAINTS}{first['id']}/withdraw/", {"text": "Sorted it out ourselves."}, format="json").data["status"] == "WITHDRAWN"
    client.force_authenticate(people["hr"])
    url = f"{COMPLAINTS}{second['id']}/"
    client.post(url + "investigate/")
    client.post(url + "resolve/", {"text": "Mediation held."}, format="json")
    assert client.post(url + "reopen/", {"text": ""}, format="json").status_code == 400
    assert client.post(url + "reopen/", {"text": "Behaviour continued."}, format="json").data["status"] == "INVESTIGATING"


def test_view_only_and_self_complaints(people):
    data = file(people)
    client = people["client"]
    client.force_authenticate(people["director"])
    detail = client.get(f"{COMPLAINTS}{data['id']}/").data
    assert detail["viewer"]["is_staff"] and not detail["viewer"]["can_manage"]
    assert client.post(f"{COMPLAINTS}{data['id']}/investigate/").status_code == 403
    client.force_authenticate(people["staff"])
    bad = client.post(COMPLAINTS, {"category": "OTHER", "subject": "x", "description": "y", "respondent": str(employee_of(people["staff"]).id)}, format="json")
    assert bad.status_code == 400
    future = client.post(COMPLAINTS, {"category": "OTHER", "subject": "x", "description": "y", "incident_date": str(date.today() + timedelta(days=2))}, format="json")
    assert future.status_code == 400
    # HR filing their own complaint is just an employee: they cannot handle it.
    own = file(people, user="hr")
    client.force_authenticate(people["hr"])
    assert client.post(f"{COMPLAINTS}{own['id']}/investigate/").status_code == 400
    assert Complaint.objects.count() == 2


def test_colleague_search_is_minimal(people):
    client = people["client"]
    client.force_authenticate(people["staff"])
    colleague = employee_of(people["colleague"])
    assert client.get(f"{COMPLAINTS}colleagues/", {"search": "c"}).data == []
    rows = client.get(f"{COMPLAINTS}colleagues/", {"search": colleague.last_name[:4]}).data
    assert any(row["id"] == str(colleague.id) for row in rows)
    assert set(rows[0]) == {"id", "name", "employee_number", "department"}
    assert all(row["id"] != str(employee_of(people["staff"]).id) for row in rows)
