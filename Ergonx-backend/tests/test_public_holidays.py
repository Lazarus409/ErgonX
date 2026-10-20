from datetime import date
from decimal import Decimal

import pytest

from apps.attendance.models import AttendanceRecord
from apps.attendance.services import classify_attendance_date
from apps.audit.models import AuditLog
from apps.leave.services import create_leave_request
from apps.organization.holidays import easter_sunday, ghana_suggestions
from apps.organization.models import PublicHoliday
from apps.payroll.models import InstitutionPayrollConfiguration
from apps.scheduling.services import change_current_schedule_assignment
from tests.test_pay_proration import payroll  # noqa: F401 - fixture
from tests.test_review_fixes_2026_10_13 import _leave_setup
from tests.test_scheduling_attendance import _employee_with_employment, _fixed_schedule

pytestmark = pytest.mark.django_db


def test_easter_dates():
    assert [easter_sunday(year) for year in (2026, 2027, 2028)] == [date(2026, 4, 5), date(2027, 3, 28), date(2028, 4, 16)]


def test_ghana_suggestions_follow_the_2025_amendment():
    suggested = {item["name"]: item for item in ghana_suggestions(2026)}

    assert "Founders' Day" in suggested and suggested["Founders' Day"]["date"] == date(2026, 9, 21)  # a Monday: stays
    assert all(item["date"] != date(2026, 8, 4) for item in suggested.values())  # 4 August was removed
    # Constitution Day falls on Wednesday 7 January 2026 and is observed on Friday 9 January.
    assert (suggested["Constitution Day"]["date"], suggested["Constitution Day"]["statutory_date"]) == (date(2026, 1, 9), date(2026, 1, 7))
    assert suggested["Republic Day"]["date"] == date(2026, 7, 3)
    # Religious holidays keep their date; Boxing Day 2026 is a Saturday.
    assert (suggested["Boxing Day"]["date"], suggested["Boxing Day"]["statutory_date"]) == (date(2026, 12, 26), None)
    assert suggested["Good Friday"]["date"] == date(2026, 4, 3)
    assert suggested["Easter Monday"]["date"] == date(2026, 4, 6)
    assert suggested["Farmers' Day"]["date"] == date(2026, 12, 4)  # first Friday of December
    assert len(suggested) == 11  # the three lunar holidays are added when announced


def test_hr_adds_and_removes_holidays_and_staff_can_list_them(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory()
    hr, staff = user_factory(), user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    membership_factory(user=staff, institution=institution, role_code="EMPLOYEE", is_primary=True)
    api_client.force_authenticate(hr)

    suggestions = api_client.get("/api/v1/public-holidays/suggestions/", {"year": 2026})
    assert suggestions.status_code == 200
    created = api_client.post("/api/v1/public-holidays/", {"date": "2026-03-20", "name": "Eid-ul-Fitr"}, format="json")
    assert created.status_code == 201, created.data
    duplicate = api_client.post("/api/v1/public-holidays/", {"date": "2026-03-20", "name": "Again"}, format="json")
    assert duplicate.status_code == 400
    assert AuditLog.objects.filter(action="holiday.created").count() == 1

    api_client.force_authenticate(staff)
    listed = api_client.get("/api/v1/public-holidays/", {"date__gte": "2026-01-01", "date__lte": "2026-12-31"})
    assert listed.status_code == 200
    assert [row["name"] for row in listed.data["results"]] == ["Eid-ul-Fitr"]
    assert api_client.post("/api/v1/public-holidays/", {"date": "2026-05-27", "name": "Eid-ul-Adha"}, format="json").status_code == 403
    assert api_client.get("/api/v1/public-holidays/suggestions/", {"year": 2026}).status_code == 403

    api_client.force_authenticate(hr)
    assert api_client.delete(f"/api/v1/public-holidays/{created.data['id']}/").status_code == 204
    assert not PublicHoliday.objects.filter(is_active=True).exists()
    # Removing a holiday frees its date for a new one.
    assert api_client.post("/api/v1/public-holidays/", {"date": "2026-03-20", "name": "Eid-ul-Fitr"}, format="json").status_code == 201


def test_leave_over_a_holiday_does_not_use_it_up(institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory):
    institution, _hr, staff, employee, leave_type = _leave_setup(
        institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory, "HOLIDAY-LEAVE",
    )
    PublicHoliday.objects.create(institution=institution, date=date(2026, 11, 4), name="Company day")

    request = create_leave_request(
        institution=institution, actor=staff, employee=employee, leave_type=leave_type, start_date=date(2026, 11, 2), end_date=date(2026, 11, 6),
    )

    assert request.requested_days == Decimal("4")  # Monday-Friday minus the Wednesday holiday


def test_a_holiday_is_classified_as_an_off_day_not_an_absence(institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory):
    institution = institution_factory()
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN")
    employee = _employee_with_employment(
        institution, user=None, employee_factory=employee_factory, organization_factory=organization_factory, assignment_dimensions_factory=assignment_dimensions_factory,
    )
    _, schedule = _fixed_schedule(institution)
    change_current_schedule_assignment(institution=institution, employee=employee, work_schedule=schedule, effective_from=date(2026, 1, 1), assigned_by=hr)
    PublicHoliday.objects.create(institution=institution, date=date(2026, 9, 21), name="Founders' Day")

    holiday = classify_attendance_date(employee=employee, attendance_date=date(2026, 9, 21), actor=hr)
    workday = classify_attendance_date(employee=employee, attendance_date=date(2026, 9, 22), actor=hr)

    assert holiday.status == AttendanceRecord.Status.OFF_DAY
    assert workday.status == AttendanceRecord.Status.ABSENT


def test_working_day_proration_leaves_out_holidays(payroll):  # noqa: F811
    payroll["configure"](InstitutionPayrollConfiguration.ProrationMethod.WORKING_DAYS)
    PublicHoliday.objects.create(institution=payroll["institution"], date=date(2026, 9, 21), name="Founders' Day")
    person = payroll["employee"]("EMP200", employed_from=date(2026, 9, 21), pay=[(date(2026, 9, 21), None, "3000.00")])

    record = payroll["run"]().records.get(employee=person)

    item = record.items.get(component_code_snapshot="BASE_SALARY")
    # September 2026 has 22 weekdays, 21 without the holiday; 21-30 Sep is 8 weekdays, 7 without it.
    assert (item.metadata["proration"]["paid_days"], item.metadata["proration"]["period_days"]) == (7, 21)
    assert item.amount == Decimal("1000.00")
