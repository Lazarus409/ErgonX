"""Default API rate limits.

Every API view gets a per-user limit (signed in) and a per-address limit (anonymous)
unless it sets its own throttles, as sign-in, password reset and the careers site do.
Counters live in each worker's memory rather than the shared database cache: a limit
check on every request must not add database queries. With several workers the
effective ceiling is a multiple of the rate, which is fine for abuse protection.
"""

from django.conf import settings
from django.core.cache import caches
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from apps.accounts.security import client_ip


class ApiUserThrottle(UserRateThrottle):
    scope = "api_user"
    cache = caches["throttle"]

    def get_rate(self):
        return settings.API_USER_RATE

    def allow_request(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return True
        return super().allow_request(request, view)


class ApiAnonThrottle(AnonRateThrottle):
    scope = "api_anon"
    cache = caches["throttle"]

    def get_rate(self):
        return settings.API_ANON_RATE

    def get_ident(self, request):
        ip, _trusted = client_ip(request)
        return ip or super().get_ident(request)
