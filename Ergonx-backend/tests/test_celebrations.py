from datetime import date

import pytest

from apps.dashboards.celebrations import _occurrence, celebrations

pytestmark = pytest.mark.django_db

TODAY = date(2026, 11, 12)


def test_occurrence_rolls_over_the_year_and_handles_29_february():
    assert _occurrence(11, 12, TODAY) == TODAY
    assert _occurrence(1, 3, TODAY) == date(2027, 1, 3)
    assert _occurrence(2, 29, date(2027, 2, 1)) == date(2027, 2, 28)
    assert _occurrence(2, 29, date(2028, 2, 1)) == date(2028, 2, 29)


def test_birthdays_are_opt_in_and_never_reveal_the_year(institution_factory, user_factory, membership_factory, employee_factory):
    institution = institution_factory(code="CEL")
    me = user_factory()
    membership_factory(user=me, institution=institution, role_code="EMPLOYEE", is_primary=True)
    employee_factory(institution, user=me, first_name="Ama", last_name="Owusu", date_of_birth=date(1990, 11, 12), share_birthday=True, hire_date=date(2020, 11, 12))
    employee_factory(institution, first_name="Kofi", last_name="Private", date_of_birth=date(1985, 11, 13))  # not opted in
    employee_factory(institution, first_name="Esi", last_name="Soon", date_of_birth=date(1999, 11, 20), share_birthday=True, preferred_name="Essie")
    employee_factory(institution, first_name="Yaw", last_name="Far", date_of_birth=date(1999, 12, 30), share_birthday=True)
    employee_factory(institution, first_name="Old", last_name="Leaver", date_of_birth=date(1970, 11, 14), share_birthday=True, status="INACTIVE")
    employee_factory(institution, first_name="New", last_name="Starter", hire_date=date(2026, 11, 13))  # under a year: no anniversary
    employee_factory(institution, first_name="Quiet", last_name="Veteran", hire_date=date(2015, 11, 15), share_work_anniversary=False)
    employee_factory(institution, first_name="Kwame", last_name="Veteran", hire_date=date(2016, 11, 16))
    other = institution_factory(code="OTH")
    employee_factory(other, first_name="Other", last_name="Org", date_of_birth=date(1990, 11, 12), share_birthday=True)

    result = celebrations(institution=institution, user=me, days=14, today=TODAY)
    assert [(row["name"], row["days_away"], row["is_me"]) for row in result["birthdays"]] == [("Ama Owusu", 0, True), ("Essie Soon", 8, False)]
    assert all(set(row) == {"employee_id", "name", "department", "avatar_key", "date", "days_away", "is_me"} for row in result["birthdays"])
    assert result["birthdays"][1]["date"] == date(2026, 11, 20)  # this year's occurrence, not the birth year
    assert [(row["name"], row["years"]) for row in result["anniversaries"]] == [("Ama Owusu", 6), ("Kwame Veteran", 10)]
    assert result["my_celebration_today"] == {"kind": "BIRTHDAY"}


def test_endpoint_is_open_to_every_member(api_client, institution_factory, user_factory, membership_factory, employee_factory):
    institution = institution_factory(code="CEP")
    user = user_factory()
    membership_factory(user=user, institution=institution, role_code="EMPLOYEE", is_primary=True)
    employee_factory(institution, user=user, first_name="Self", last_name="Service")
    api_client.force_authenticate(user)
    api_client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))
    response = api_client.get("/api/v1/home/celebrations/?days=500")
    assert response.status_code == 200 and response.data["days"] == 60
    profile = api_client.patch("/api/v1/employees/me/profile/", {"share_birthday": True, "share_work_anniversary": False}, format="json")
    assert profile.status_code == 200, profile.data
    assert profile.data["share_birthday"] is True and profile.data["share_work_anniversary"] is False


def test_organisation_anniversary_counts_whole_years_on_ergonx(institution_factory, user_factory):
    from datetime import datetime, timezone as dt_timezone

    from apps.dashboards.celebrations import organisation_anniversary
    from apps.institutions.models import Institution

    institution = institution_factory(code="ANV")
    Institution.objects.filter(pk=institution.pk).update(created_at=datetime(2024, 11, 20, 12, tzinfo=dt_timezone.utc))
    institution.refresh_from_db()
    upcoming = organisation_anniversary(institution, TODAY, date(2026, 11, 26))
    assert upcoming == {"name": institution.name, "joined_on": date(2024, 11, 20), "date": date(2026, 11, 20), "days_away": 8, "years": 2}
    assert organisation_anniversary(institution, TODAY, date(2026, 11, 19)) is None  # outside the window
    Institution.objects.filter(pk=institution.pk).update(created_at=datetime(2026, 1, 5, 12, tzinfo=dt_timezone.utc))
    institution.refresh_from_db()
    assert organisation_anniversary(institution, TODAY, date(2027, 1, 31)) == {"name": institution.name, "joined_on": date(2026, 1, 5), "date": date(2027, 1, 5), "days_away": 54, "years": 1}
    assert organisation_anniversary(institution, date(2026, 1, 5), date(2026, 2, 1)) is None  # the day it joined is not an anniversary
    result = celebrations(institution=institution, user=user_factory(), days=14, today=TODAY)
    assert result["organisation_anniversary"] is None
