from unittest import mock

import pytest

pytestmark = pytest.mark.django_db


def test_live_needs_no_authentication(client):
    response = client.get("/api/v1/health/live/")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert "no-cache" in response["Cache-Control"]


def test_ready_checks_database_cache_and_migrations(client):
    response = client.get("/api/v1/health/ready/")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert {name: check["ok"] for name, check in body["checks"].items()} == {"database": True, "cache": True, "migrations": True}


def test_ready_reports_503_when_a_dependency_fails(client):
    with mock.patch("common.health._cache", side_effect=ConnectionError("down")):
        response = client.get("/api/v1/health/ready/")

    assert response.status_code == 503
    assert response.json()["checks"]["cache"] == {"ok": False, "error": "ConnectionError"}


def test_health_rejects_writes(client):
    assert client.post("/api/v1/health/ready/").status_code == 405
