from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.core.exceptions import ValidationError

from apps.attendance.geofence import distance_m
from apps.attendance.models import AttendanceRecord
from apps.attendance.services import clock_in, clock_out
from apps.employees.models import Employment
from apps.institutions.models import InstitutionModule
from apps.organization.models import Location
from apps.scheduling.services import change_current_schedule_assignment
from tests.test_scheduling_attendance import _employee_with_employment, _fixed_schedule


pytestmark = pytest.mark.django_db

SITE = (5.6037, -0.1870)  # Accra
NEARBY = {"lat": 5.6045, "lng": -0.1870, "accuracy_m": 15}  # ~90 m north
FAR = {"lat": 5.6217, "lng": -0.1870, "accuracy_m": 15}  # ~2 km north


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory):
    institution = institution_factory(code="GEO")
    InstitutionModule.objects.filter(institution=institution, module_code=InstitutionModule.ModuleCode.ATTENDANCE).update(is_enabled=True)
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    staff = user_factory()
    membership_factory(user=staff, institution=institution, role_code="EMPLOYEE", is_primary=True)
    employee = _employee_with_employment(institution, user=staff, employee_factory=employee_factory, organization_factory=organization_factory, assignment_dimensions_factory=assignment_dimensions_factory)
    _, schedule = _fixed_schedule(institution)
    change_current_schedule_assignment(institution=institution, employee=employee, work_schedule=schedule, effective_from=date(2026, 1, 1), assigned_by=hr)
    location = Employment.objects.get(employee=employee).location
    return {"client": api_client, "institution": institution, "hr": hr, "staff": staff, "employee": employee, "location": location}


def _set_rule(location, rule, radius=200):
    location.latitude, location.longitude = (Decimal(str(value)) for value in SITE)
    location.geofence_radius_m = radius
    location.clock_location_rule = rule
    location.save()


def test_distance_is_roughly_right():
    assert 85 < distance_m(*SITE, NEARBY["lat"], NEARBY["lng"]) < 95
    assert 1_950 < distance_m(*SITE, FAR["lat"], FAR["lng"]) < 2_050


def test_location_rule_needs_a_site_position(setup):
    location = setup["location"]
    location.clock_location_rule = Location.ClockLocationRule.REQUIRE
    with pytest.raises(ValidationError):
        location.save()


def test_off_rule_stores_nothing(setup):
    record = clock_in(employee=setup["employee"], actor=setup["staff"], position=NEARBY)
    assert record.check_in_position is None and record.check_in_site == ""


def test_record_rule_flags_off_site_and_missing_positions(setup):
    _set_rule(setup["location"], Location.ClockLocationRule.RECORD)
    record = clock_in(employee=setup["employee"], actor=setup["staff"], position=FAR)
    assert record.check_in_site == AttendanceRecord.SiteCheck.OFF_SITE
    assert 1_950 < record.check_in_position["distance_m"] < 2_050
    record = clock_out(attendance_record=record, actor=setup["staff"], position=None)
    assert record.check_out_site == AttendanceRecord.SiteCheck.NO_POSITION
    assert record.check_out_position is None


def test_require_rule_refuses_off_site_and_missing_positions(setup):
    _set_rule(setup["location"], Location.ClockLocationRule.REQUIRE)
    with pytest.raises(ValidationError, match="from"):
        clock_in(employee=setup["employee"], actor=setup["staff"], position=FAR)
    with pytest.raises(ValidationError, match="Share your location"):
        clock_in(employee=setup["employee"], actor=setup["staff"], position=None)
    with pytest.raises(ValidationError, match="imprecise"):
        clock_in(employee=setup["employee"], actor=setup["staff"], position={**NEARBY, "accuracy_m": 2_500})
    assert not AttendanceRecord.objects.filter(employee=setup["employee"], check_in__isnull=False).exists()
    record = clock_in(employee=setup["employee"], actor=setup["staff"], position=NEARBY)
    assert record.check_in_site == AttendanceRecord.SiteCheck.ON_SITE


def test_gps_error_counts_up_to_the_site_radius(setup):
    _set_rule(setup["location"], Location.ClockLocationRule.REQUIRE, radius=50)
    # 90 m away with 50 m stated accuracy: within 50 m + 50 m.
    record = clock_in(employee=setup["employee"], actor=setup["staff"], position={**NEARBY, "accuracy_m": 50})
    assert record.check_in_site == AttendanceRecord.SiteCheck.ON_SITE


def test_manager_entries_for_others_are_not_checked(setup):
    _set_rule(setup["location"], Location.ClockLocationRule.REQUIRE)
    at = datetime(2026, 3, 2, 9, 5, tzinfo=ZoneInfo("Africa/Accra"))
    record = clock_in(employee=setup["employee"], actor=setup["hr"], at=at)
    assert record.check_in_site == "" and record.check_in_position is None


def test_api_clock_policy_and_position_payload(setup):
    client, staff = setup["client"], setup["staff"]
    _set_rule(setup["location"], Location.ClockLocationRule.REQUIRE)
    client.force_authenticate(staff)
    client.credentials(HTTP_X_INSTITUTION_ID=str(setup["institution"].id))
    policy = client.get("/api/v1/attendance-records/clock-policy/")
    assert policy.status_code == 200, policy.data
    assert policy.data["rule"] == "REQUIRE" and policy.data["radius_m"] == 200
    refused = client.post("/api/v1/attendance-records/clock-in/", {"employee": str(setup["employee"].id), "position": FAR}, format="json")
    assert refused.status_code == 400
    assert "position" in str(refused.data)
    ok = client.post("/api/v1/attendance-records/clock-in/", {"employee": str(setup["employee"].id), "position": NEARBY}, format="json")
    assert ok.status_code == 200, ok.data
    assert ok.data["check_in_site"] == "ON_SITE"
    assert ok.data["check_in_position"]["location"] == setup["location"].name
    bad = client.post(f"/api/v1/attendance-records/{ok.data['id']}/clock-out/", {"position": {"lat": 120, "lng": 0}}, format="json")
    assert bad.status_code == 400
