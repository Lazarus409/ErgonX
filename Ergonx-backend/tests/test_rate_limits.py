import pytest
from django.core.cache import caches
from django.test import override_settings

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def fresh_counters():
    caches["throttle"].clear()
    yield
    caches["throttle"].clear()


@override_settings(API_USER_RATE="3/min")
def test_signed_in_users_are_limited_per_user(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory()
    first, second = user_factory(), user_factory()
    membership_factory(user=first, institution=institution, role_code="HR_ADMIN", is_primary=True)
    membership_factory(user=second, institution=institution, role_code="HR_ADMIN", is_primary=True)

    api_client.force_authenticate(first)
    statuses = [api_client.get("/api/v1/departments/").status_code for _ in range(4)]
    assert statuses == [200, 200, 200, 429]
    limited = api_client.get("/api/v1/departments/")
    assert "Retry-After" in limited

    # Another person is counted separately.
    api_client.force_authenticate(second)
    assert api_client.get("/api/v1/departments/").status_code == 200


@override_settings(API_ANON_RATE="2/min")
def test_public_endpoints_are_limited_per_address(api_client):
    """Protected endpoints refuse anonymous callers before any limit; public ones such as
    invitation lookup are limited per address, which slows token guessing."""
    url = "/api/v1/auth/invitations/not-a-real-token/"
    statuses = [api_client.get(url, REMOTE_ADDR="203.0.113.7").status_code for _ in range(3)]

    assert statuses[2] == 429
    assert statuses[0] != 429 and statuses[1] != 429
    assert api_client.get(url, REMOTE_ADDR="203.0.113.8").status_code != 429


@override_settings(API_ANON_RATE="1/min")
def test_health_probes_are_never_limited(client):
    assert [client.get("/api/v1/health/live/").status_code for _ in range(3)] == [200, 200, 200]
