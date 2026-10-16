"""Location checks for self-service clocking.

A work location can ask where people clock in (``Location.clock_location_rule``):

* ``OFF``     - no position is asked for or stored;
* ``RECORD``  - the position is stored and the clock is flagged on or off site;
* ``REQUIRE`` - the clock is refused unless the position is within the site's radius.

Only self-service clocks are checked: an attendance manager entering a missed
punch for someone else is not standing where that person was. The position is
taken once, at the moment of clocking; nothing tracks people in between.
Browser positions can be faked, so treat a flag as a prompt to follow up, not proof.
"""

import math

from django.core.exceptions import ValidationError

from apps.attendance.models import AttendanceRecord
from apps.employees.models import Employment
from apps.organization.models import Location

EARTH_RADIUS_M = 6_371_000
# Positions less precise than this can't show someone is on a site.
MAX_USEFUL_ACCURACY_M = 1_000


def distance_m(lat1, lng1, lat2, lng2):
    """Great-circle (haversine) distance in metres."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi, d_lambda = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def work_location(employee):
    employment = Employment.objects.filter(employee=employee, is_current=True).select_related("location").order_by("-start_date").first()
    return employment.location if employment else None


def clock_policy(employee):
    """What the clock screen needs to know before asking for the device's position."""
    location = work_location(employee)
    rule = location.clock_location_rule if location and not location.is_remote and location.latitude is not None else Location.ClockLocationRule.OFF
    return {
        "rule": rule,
        "location_id": str(location.id) if location else None,
        "location_name": location.name if location else "",
        "radius_m": location.geofence_radius_m if location else None,
    }


def check_clock_position(*, employee, actor, position):
    """Returns ``(stored_position, site_check)`` for a clock, or raises when the site requires presence.

    ``position`` is ``{"lat", "lng", "accuracy_m"}`` from the device, or ``None``.
    """
    if employee.user_id != actor.id:
        return None, ""
    location = work_location(employee)
    if location is None or location.is_remote or location.latitude is None or location.clock_location_rule == Location.ClockLocationRule.OFF:
        return None, ""
    required = location.clock_location_rule == Location.ClockLocationRule.REQUIRE
    if position is None:
        if required:
            raise ValidationError({"position": f"Share your location to clock in or out at {location.name}. Allow location access in your browser and try again."})
        return None, AttendanceRecord.SiteCheck.NO_POSITION
    accuracy = position.get("accuracy_m")
    distance = distance_m(float(location.latitude), float(location.longitude), position["lat"], position["lng"])
    stored = {
        "lat": round(position["lat"], 6), "lng": round(position["lng"], 6),
        "accuracy_m": round(accuracy) if accuracy is not None else None,
        "distance_m": round(distance), "location": location.name,
    }
    # Allow for the device's stated error, up to the size of the site itself.
    tolerance = min(accuracy or 0, location.geofence_radius_m)
    on_site = distance <= location.geofence_radius_m + tolerance
    if required:
        if accuracy is not None and accuracy > MAX_USEFUL_ACCURACY_M:
            raise ValidationError({"position": f"Your location is too imprecise (about {round(accuracy)} m). Turn on precise location or step outside, then try again."})
        if not on_site:
            raise ValidationError({"position": f"You're about {_readable(distance)} from {location.name}. Clocking is allowed within {_readable(location.geofence_radius_m)} of the site."})
    return stored, AttendanceRecord.SiteCheck.ON_SITE if on_site else AttendanceRecord.SiteCheck.OFF_SITE


def _readable(metres):
    return f"{metres / 1000:.1f} km" if metres >= 1000 else f"{round(metres)} m"
