"""Institution public holidays: lookups used by leave, attendance and payroll, and yearly suggestions.

Holidays are institution records rather than a built-in table because the observed dates
are fixed by government each year (Eid dates are announced by the Office of the Chief
Imam, and the Public Holidays and Commemorative Days (Amendment) Act, 2025 moves days).
HR reviews the suggestions for a year and saves the ones that apply.
"""

from datetime import date, timedelta

from apps.organization.models import PublicHoliday


def holiday_dates(institution, start_date, end_date):
    """Active holiday dates for an institution within a range, as a set."""
    if institution is None:
        return set()
    return set(
        PublicHoliday.objects.filter(
            institution=institution, is_active=True, date__gte=start_date, date__lte=end_date
        ).values_list("date", flat=True)
    )


def easter_sunday(year):
    """Gregorian Easter (anonymous Gregorian algorithm)."""
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7  # noqa: E741
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = (h + l - 7 * m + 114) % 31 + 1
    return date(year, month, day)


def _observed(day):
    """The 2025 amendment: weekend holidays move to Monday, Tuesday-Thursday ones to Friday."""
    weekday = day.weekday()
    if weekday >= 5:
        return day + timedelta(days=7 - weekday)
    if 1 <= weekday <= 3:
        return day + timedelta(days=4 - weekday)
    return day


# (name, month, day, moves) - religious holidays keep their date.
GHANA_FIXED = (
    ("New Year's Day", 1, 1, True),
    ("Constitution Day", 1, 7, True),
    ("Independence Day", 3, 6, True),
    ("May Day", 5, 1, True),
    ("Republic Day", 7, 1, True),
    ("Founders' Day", 9, 21, True),
    ("Christmas Day", 12, 25, False),
    ("Boxing Day", 12, 26, False),
)
GHANA_NOTE = (
    "Eid-ul-Fitr, Shaqq Day (the day after) and Eid-ul-Adha follow the lunar calendar; add them "
    "when the dates are announced. Observed days follow the Public Holidays and Commemorative Days "
    "(Amendment) Act, 2025; check them against the government's announcement for the year."
)


def ghana_suggestions(year):
    """Ghana's statutory holidays for a year whose dates can be worked out in advance."""
    suggestions = []
    for name, month, day, moves in GHANA_FIXED:
        statutory = date(year, month, day)
        observed = _observed(statutory) if moves else statutory
        suggestions.append({"name": name, "date": observed, "statutory_date": statutory if observed != statutory else None})
    easter = easter_sunday(year)
    suggestions.append({"name": "Good Friday", "date": easter - timedelta(days=2), "statutory_date": None})
    suggestions.append({"name": "Easter Monday", "date": easter + timedelta(days=1), "statutory_date": None})
    first_of_december = date(year, 12, 1)
    farmers_day = first_of_december + timedelta(days=(4 - first_of_december.weekday()) % 7)
    suggestions.append({"name": "Farmers' Day", "date": farmers_day, "statutory_date": None})
    return sorted(suggestions, key=lambda item: item["date"])


SUGGESTERS = {"GH": (ghana_suggestions, GHANA_NOTE)}


def suggested_holidays(institution, year):
    """Suggestions for the institution's country, flagged when that date is already a holiday."""
    suggester, note = SUGGESTERS.get(institution.country_code, (None, ""))
    if suggester is None:
        return {"country_code": institution.country_code, "note": "No holiday suggestions are available for this country yet; add holidays yourself.", "holidays": []}
    existing = holiday_dates(institution, date(year, 1, 1), date(year, 12, 31))
    holidays = [{**item, "already_added": item["date"] in existing} for item in suggester(year)]
    return {"country_code": institution.country_code, "note": note, "holidays": holidays}
