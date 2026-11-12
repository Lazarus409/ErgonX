"""Upcoming birthdays, work anniversaries and the organisation's ErgonX anniversary for the home page.

Birthdays appear only for employees who opted in (``share_birthday``) and only as a day and
month: the year of birth, and so anyone's age, is never returned. Work anniversaries appear
unless the employee opted out (``share_work_anniversary``).
"""

import calendar
from datetime import date, timedelta

from django.utils import timezone

from apps.employees.models import Employee, Employment

MAX_DAYS = 60


def _occurrence(month, day, today):
    """The next date on or after ``today`` falling on month/day (29 Feb → 28 Feb in common years)."""
    for year in (today.year, today.year + 1):
        actual_day = min(day, calendar.monthrange(year, month)[1])
        candidate = date(year, month, actual_day)
        if candidate >= today:
            return candidate
    return None


def _person(employee, departments):
    return {
        "employee_id": str(employee.id),
        "name": f"{employee.preferred_name or employee.first_name} {employee.last_name}".strip(),
        "department": departments.get(employee.id),
        "avatar_key": employee.avatar_key,
    }


def organisation_anniversary(institution, today, until):
    """The organisation's next ErgonX anniversary (from when it was created on ErgonX), if within the window."""
    if not institution.created_at:
        return None
    joined = timezone.localdate(institution.created_at)
    when = _occurrence(joined.month, joined.day, today)
    years = when.year - joined.year if when else 0
    if not when or when > until or years < 1:
        return None
    return {"name": institution.name, "joined_on": joined, "date": when, "days_away": (when - today).days, "years": years}


def celebrations(*, institution, user, days=14, today=None):
    days = max(0, min(int(days), MAX_DAYS))
    today = today or timezone.localdate()
    until = today + timedelta(days=days)
    employees = list(
        Employee.objects.for_institution(institution)
        .filter(status=Employee.Status.ACTIVE)
        .only("id", "user_id", "first_name", "last_name", "preferred_name", "avatar_key", "date_of_birth", "hire_date", "share_birthday", "share_work_anniversary")
    )
    departments = dict(
        Employment.objects.filter(institution=institution, is_current=True, employee__in=[employee.id for employee in employees])
        .values_list("employee_id", "department__name")
    )
    birthdays, anniversaries = [], []
    mine = None
    for employee in employees:
        is_me = employee.user_id is not None and employee.user_id == user.id
        if employee.share_birthday and employee.date_of_birth:
            when = _occurrence(employee.date_of_birth.month, employee.date_of_birth.day, today)
            if when and when <= until:
                birthdays.append({**_person(employee, departments), "date": when, "days_away": (when - today).days, "is_me": is_me})
                if is_me and when == today:
                    mine = {"kind": "BIRTHDAY"}
        if employee.share_work_anniversary and employee.hire_date and employee.hire_date < today:
            when = _occurrence(employee.hire_date.month, employee.hire_date.day, today)
            years = when.year - employee.hire_date.year if when else 0
            if when and when <= until and years >= 1:
                anniversaries.append({**_person(employee, departments), "date": when, "days_away": (when - today).days, "years": years, "is_me": is_me})
                if is_me and when == today and mine is None:
                    mine = {"kind": "WORK_ANNIVERSARY", "years": years}
    order = lambda row: (row["days_away"], row["name"])  # noqa: E731
    return {
        "today": today,
        "days": days,
        "birthdays": sorted(birthdays, key=order),
        "anniversaries": sorted(anniversaries, key=order),
        "my_celebration_today": mine,
        "organisation_anniversary": organisation_anniversary(institution, today, until),
    }
