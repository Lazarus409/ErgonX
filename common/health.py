"""Health endpoints for the load balancer, uptime monitors and the release gate.

/api/v1/health/live/  - the process answers (no dependencies), for restarts.
/api/v1/health/ready/ - the database, cache and migrations are usable, for routing traffic.
Neither needs authentication or reveals anything beyond pass/fail per check and the release.
"""

import os
import time

from django.core.cache import cache
from django.db import DEFAULT_DB_ALIAS, connections
from django.db.migrations.executor import MigrationExecutor
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

RELEASE = os.environ.get("RENDER_GIT_COMMIT", os.environ.get("GIT_COMMIT", ""))[:12]


@never_cache
@require_GET
def live(request):
    return JsonResponse({"status": "ok", "release": RELEASE})


def _check(name, probe):
    started = time.monotonic()
    try:
        probe()
        return name, {"ok": True, "ms": round((time.monotonic() - started) * 1000)}
    except Exception as exc:  # noqa: BLE001 - any failure means "not ready"
        return name, {"ok": False, "error": type(exc).__name__}


def _database():
    with connections[DEFAULT_DB_ALIAS].cursor() as cursor:
        cursor.execute("SELECT 1")


def _cache():
    cache.set("health:probe", "1", 10)
    if cache.get("health:probe") != "1":
        raise RuntimeError("cache read-back failed")


_migrations_applied = False


def _migrations():
    # Loading the migration graph costs about a second; once applied, migrations stay
    # applied for the life of this process (a deploy starts a new one).
    global _migrations_applied
    if _migrations_applied:
        return
    executor = MigrationExecutor(connections[DEFAULT_DB_ALIAS])
    if executor.migration_plan(executor.loader.graph.leaf_nodes()):
        raise RuntimeError("unapplied migrations")
    _migrations_applied = True


@never_cache
@require_GET
def ready(request):
    checks = dict(_check(name, probe) for name, probe in (("database", _database), ("cache", _cache), ("migrations", _migrations)))
    healthy = all(check["ok"] for check in checks.values())
    return JsonResponse({"status": "ok" if healthy else "unavailable", "release": RELEASE, "checks": checks}, status=200 if healthy else 503)
