from datetime import date, time, timedelta

import pytest
from django.utils import timezone

from apps.attendance.services import clock_in
from apps.institutions.models import InstitutionModule
from apps.scheduling.models import ShiftSwap
from apps.scheduling.services import change_current_schedule_assignment, schedule_assignment_for, schedule_expectation
from tests.test_scheduling_attendance import _employee_with_employment, _fixed_schedule


pytestmark = pytest.mark.django_db


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory):
    institution = institution_factory(code="SWAP")
    InstitutionModule.objects.filter(institution=institution, module_code=InstitutionModule.ModuleCode.ATTENDANCE).update(is_enabled=True)
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    _, day = _fixed_schedule(institution, code="DAY", start=time(8), end=time(16))
    _, late = _fixed_schedule(institution, code="LATE", start=time(14), end=time(22))
    people = {}
    for key, schedule in (("ama", day), ("kofi", late), ("esi", day)):
        user = user_factory()
        membership_factory(user=user, institution=institution, role_code="EMPLOYEE", is_primary=True)
        employee = _employee_with_employment(institution, user=user, employee_factory=employee_factory, organization_factory=organization_factory, assignment_dimensions_factory=assignment_dimensions_factory)
        change_current_schedule_assignment(institution=institution, employee=employee, work_schedule=schedule, effective_from=date(2026, 1, 1), assigned_by=hr)
        people[key] = (user, employee)
    return {"client": api_client, "institution": institution, "hr": hr, **people, "date": timezone.localdate() + timedelta(days=3)}


def _request(setup, counterpart="kofi"):
    client = setup["client"]
    _as(client, setup["ama"][0], setup["institution"])
    return client.post("/api/v1/shift-swaps/", {"counterpart": str(setup[counterpart][1].id), "swap_date": str(setup["date"]), "reason": "Clinic appointment"}, format="json")


def test_full_swap_changes_both_expected_shifts(setup):
    client, institution = setup["client"], setup["institution"]
    created = _request(setup)
    assert created.status_code == 201, created.data
    assert created.data["status"] == "AWAITING_COLLEAGUE"
    assert created.data["requester_shift_label"].startswith("DAY Schedule 08:00")
    swap_id = created.data["id"]

    # The requester can't answer their own request, and nobody can approve before the colleague accepts.
    assert client.post(f"/api/v1/shift-swaps/{swap_id}/accept/", format="json").status_code == 400
    _as(client, setup["kofi"][0], institution)
    listed = client.get("/api/v1/shift-swaps/").data["results"]
    assert listed[0]["viewer"]["can_answer"] is True
    accepted = client.post(f"/api/v1/shift-swaps/{swap_id}/accept/", format="json")
    assert accepted.data["status"] == "AWAITING_APPROVAL"
    assert client.post(f"/api/v1/shift-swaps/{swap_id}/approve/", format="json").status_code == 403

    _as(client, setup["hr"], institution)
    inbox = client.get("/api/v1/approvals/inbox/").data
    assert any(item["kind"] == "SHIFT_SWAP" for item in inbox["items"])
    assert client.post(f"/api/v1/shift-swaps/{swap_id}/reject/", {}, format="json").status_code == 400  # A reason is required.
    approved = client.post(f"/api/v1/shift-swaps/{swap_id}/approve/", {"note": "OK"}, format="json")
    assert approved.status_code == 200, approved.data
    assert approved.data["status"] == "APPROVED"

    ama, kofi = setup["ama"][1], setup["kofi"][1]
    ama_day = schedule_expectation(schedule_assignment_for(ama, setup["date"]), setup["date"])
    kofi_day = schedule_expectation(schedule_assignment_for(kofi, setup["date"]), setup["date"])
    assert ama_day["start"].time() == time(14) and kofi_day["start"].time() == time(8)
    # Other days are untouched.
    other = setup["date"] + timedelta(days=1)
    assert schedule_expectation(schedule_assignment_for(ama, other), other)["start"].time() == time(8)


def test_swap_rules(setup):
    client, institution = setup["client"], setup["institution"]
    # Same shift: nothing to swap.
    same = _request(setup, counterpart="esi")
    assert same.status_code == 400 and "nothing to swap" in str(same.data)
    # Past dates and far-future dates are refused.
    past = client.post("/api/v1/shift-swaps/", {"counterpart": str(setup["kofi"][1].id), "swap_date": str(timezone.localdate() - timedelta(days=1))}, format="json")
    assert past.status_code == 400
    far = client.post("/api/v1/shift-swaps/", {"counterpart": str(setup["kofi"][1].id), "swap_date": str(timezone.localdate() + timedelta(days=120))}, format="json")
    assert far.status_code == 400
    # One open swap per person per date.
    assert _request(setup).status_code == 201
    assert _request(setup).status_code == 400


def test_decline_and_cancel(setup):
    client, institution = setup["client"], setup["institution"]
    swap_id = _request(setup).data["id"]
    _as(client, setup["kofi"][0], institution)
    declined = client.post(f"/api/v1/shift-swaps/{swap_id}/decline/", {"note": "Can't that day"}, format="json")
    assert declined.data["status"] == "DECLINED"
    swap_id = _request(setup).data["id"]
    cancelled = client.post(f"/api/v1/shift-swaps/{swap_id}/cancel/", format="json")
    assert cancelled.data["status"] == "CANCELLED"


def test_approvers_cannot_approve_their_own_swap(setup, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory):
    client, institution = setup["client"], setup["institution"]
    hr_employee = _employee_with_employment(institution, user=setup["hr"], employee_factory=employee_factory, organization_factory=organization_factory, assignment_dimensions_factory=assignment_dimensions_factory)
    change_current_schedule_assignment(institution=institution, employee=hr_employee, work_schedule=schedule_assignment_for(setup["kofi"][1], setup["date"]).work_schedule, effective_from=date(2026, 1, 1), assigned_by=setup["hr"])
    _as(client, setup["ama"][0], institution)
    swap_id = client.post("/api/v1/shift-swaps/", {"counterpart": str(hr_employee.id), "swap_date": str(setup["date"])}, format="json").data["id"]
    _as(client, setup["hr"], institution)
    client.post(f"/api/v1/shift-swaps/{swap_id}/accept/", format="json")
    refused = client.post(f"/api/v1/shift-swaps/{swap_id}/approve/", format="json")
    assert refused.status_code == 400 and "another approver" in str(refused.data)


def test_clocked_in_day_cannot_be_swapped(setup):
    client, institution = setup["client"], setup["institution"]
    setup["date"] = timezone.localdate()
    clock_in(employee=setup["kofi"][1], actor=setup["kofi"][0])
    refused = _request(setup)
    assert refused.status_code == 400 and "clocked in" in str(refused.data)


def test_colleagues_lists_people_with_a_different_shift(setup):
    from apps.employees.models import Employment

    client = setup["client"]
    department = Employment.objects.get(employee=setup["ama"][1]).department
    Employment.objects.filter(employee__in=(setup["kofi"][1], setup["esi"][1])).update(department=department)
    _as(client, setup["ama"][0], setup["institution"])
    response = client.get(f"/api/v1/shift-swaps/colleagues/?date={setup['date']}")
    assert response.status_code == 200, response.data
    names = [row["id"] for row in response.data["colleagues"]]
    assert str(setup["kofi"][1].id) in names and str(setup["esi"][1].id) not in names
    assert response.data["my_shift"].startswith("DAY Schedule")
    assert ShiftSwap.objects.count() == 0
