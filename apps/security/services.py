"""Security overview and compliance evidence for one institution.

Everything here is computed from data ErgonX already keeps (memberships, MFA
settings, the audit trail, API keys, exports, restore-test records); nothing
is collected for monitoring's sake.
"""

import csv
import io
import json
import zipfile
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.institutions.models import InstitutionMembership

STALE_AFTER = timedelta(days=90)
INVITE_STALE_AFTER = timedelta(days=30)
RESTORE_TEST_MAX_AGE = timedelta(days=90)
EXPORT_BURST = 20
SECURITY_ACTION_PREFIXES = ("account.", "access.", "integrations.", "privacy.", "settings.security", "auth.")


def _privileged_permission_codes():
    from apps.institutions.services import PRIVILEGED_PERMISSIONS

    return PRIVILEGED_PERMISSIONS


def _members(institution):
    return InstitutionMembership.objects.filter(institution=institution, status=InstitutionMembership.Status.ACTIVE).select_related("user", "role")


def _privileged_members(institution):
    codes = _privileged_permission_codes()
    return [membership for membership in _members(institution).prefetch_related("role__permissions") if any(permission.code in codes for permission in membership.role.permissions.all())]


def _check(code, title, status, detail, items=None, route=""):
    return {"code": code, "title": title, "status": status, "detail": detail, "items": items or [], "route": route}


def overview(institution):
    now = timezone.now()
    members = list(_members(institution))
    user_ids = [membership.user_id for membership in members]
    checks = []

    privileged = _privileged_members(institution)
    without_mfa = [membership for membership in privileged if not (hasattr(membership.user, "mfa") and membership.user.mfa.is_enabled)]
    checks.append(_check(
        "PRIVILEGED_WITHOUT_MFA", "Administrators without two-step sign-in",
        "CRITICAL" if without_mfa else "OK",
        f"{len(without_mfa)} of {len(privileged)} people with administrator powers have no MFA." if without_mfa else f"All {len(privileged)} administrators use MFA.",
        [{"name": membership.user.get_full_name() or membership.user.email, "role": membership.role.name} for membership in without_mfa], "/settings/users",
    ))

    failures = AuditLog.objects.filter(action="account.login.failed", actor_id__in=user_ids, created_at__gte=now - timedelta(days=1))
    by_user = list(failures.values("actor__email").annotate(count=Count("id")).order_by("-count")[:10])
    heavy = [row for row in by_user if row["count"] >= 5]
    checks.append(_check(
        "FAILED_SIGN_INS", "Failed sign-ins (last 24 hours)", "WARNING" if heavy else "OK",
        f"{failures.count()} failed sign-ins; {len(heavy)} account(s) with 5 or more (likely locked or targeted)." if failures.exists() else "No failed sign-ins.",
        [{"name": row["actor__email"], "count": row["count"]} for row in by_user],
    ))

    stale = [
        membership for membership in members
        if (membership.user.last_login and membership.user.last_login < now - STALE_AFTER)
        or (not membership.user.last_login and membership.created_at < now - INVITE_STALE_AFTER)
    ]
    checks.append(_check(
        "STALE_ACCOUNTS", "Unused accounts", "WARNING" if stale else "OK",
        f"{len(stale)} active account(s) not used for 90 days (or never used). Deactivate those no longer needed." if stale else "Every active account has been used recently.",
        [{"name": membership.user.get_full_name() or membership.user.email, "last_login": membership.user.last_login.isoformat() if membership.user.last_login else None} for membership in stale[:20]], "/settings/users",
    ))

    grants = AuditLog.objects.filter(institution=institution, action__in=("access.membership.updated", "access.membership.invited", "access.role.updated", "access.role.created"), created_at__gte=now - timedelta(days=30))
    checks.append(_check(
        "ACCESS_CHANGES", "Role and access changes (last 30 days)", "INFO" if grants.exists() else "OK",
        f"{grants.count()} change(s) to roles or memberships. Confirm each was expected." if grants.exists() else "No role or access changes.",
        [{"action": row.action, "by": (row.actor.get_full_name() or row.actor.email) if row.actor else "System", "at": row.created_at.isoformat()} for row in grants.select_related("actor")[:10]], "/audit",
    ))

    from apps.integrations.models import ApiKey

    keys = ApiKey.objects.filter(institution=institution, revoked_at__isnull=True)
    old_keys = [key for key in keys if key.expires_at is None and key.created_at < now - timedelta(days=365)]
    unused_keys = [key for key in keys if key.last_used_at is None and key.created_at < now - timedelta(days=30)]
    checks.append(_check(
        "API_KEYS", "API keys", "WARNING" if old_keys or unused_keys else "OK",
        f"{keys.count()} active key(s); {len(old_keys)} over a year old without expiry, {len(unused_keys)} never used." if keys.exists() else "No active API keys.",
        [{"name": key.name, "created_at": key.created_at.isoformat(), "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None} for key in (old_keys + unused_keys)[:10]], "/settings/integrations",
    ))

    from apps.operations.models import ExportJob

    exports = ExportJob.objects.filter(institution=institution, created_at__gte=now - timedelta(days=1)).values("initiated_by__email").annotate(count=Count("id")).order_by("-count")
    burst = [row for row in exports if row["count"] >= EXPORT_BURST]
    checks.append(_check(
        "EXPORT_VOLUME", "Data exports (last 24 hours)", "WARNING" if burst else "OK",
        f"{len(burst)} person(s) ran {EXPORT_BURST} or more exports in a day; check it was legitimate." if burst else "Export volume is normal.",
        [{"name": row["initiated_by__email"], "count": row["count"]} for row in burst],
    ))

    from apps.security.models import RestoreTest

    latest = RestoreTest.objects.first()
    restore_status = "WARNING" if latest is None or latest.performed_on < (now - RESTORE_TEST_MAX_AGE).date() or latest.result == RestoreTest.Result.FAILED else "OK"
    checks.append(_check(
        "RESTORE_TEST", "Backup restore tests", restore_status,
        f"Last restore test {latest.performed_on:%d %b %Y}: {latest.get_result_display().lower()}." if latest else "No restore test has been recorded. The platform operator should test a restore at least every 90 days.",
    ))

    events = AuditLog.objects.filter(Q(institution=institution) | Q(institution__isnull=True, actor_id__in=user_ids)).filter(
        Q(*[Q(action__startswith=prefix) for prefix in SECURITY_ACTION_PREFIXES], _connector=Q.OR)
    ).select_related("actor").order_by("-created_at")[:50]
    order = {"CRITICAL": 0, "WARNING": 1, "INFO": 2, "OK": 3}
    return {
        "generated_at": now,
        "score": {"critical": sum(1 for check in checks if check["status"] == "CRITICAL"), "warning": sum(1 for check in checks if check["status"] == "WARNING")},
        "checks": sorted(checks, key=lambda check: order[check["status"]]),
        "events": [{"action": event.action, "actor": (event.actor.get_full_name() or event.actor.email) if event.actor else "System", "ip_address": event.ip_address, "at": event.created_at} for event in events],
    }


def _csv(rows, header):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue()


def evidence_zip(institution, *, start, end):
    """A ZIP of CSV/JSON evidence for an audit or certification review."""
    from apps.documents.models import Policy, PolicyAcknowledgement
    from apps.privacy.models import DataSubjectRequest, LegalHold, RetentionRule
    from apps.security.models import RestoreTest

    members = _members(institution)
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr("README.txt", (
            f"ErgonX compliance evidence for {institution.name} ({institution.code})\n"
            f"Period: {start:%Y-%m-%d} to {end:%Y-%m-%d}\nGenerated: {timezone.now():%Y-%m-%d %H:%M %Z}\n\n"
            "users_and_roles.csv - active members, role, MFA and last sign-in\n"
            "audit_trail.csv - every audited action in the period\n"
            "security_checks.json - the security overview at generation time\n"
            "retention_and_holds.csv - retention rules and legal holds\n"
            "data_subject_requests.csv - requests and how they were handled\n"
            "policy_acknowledgements.csv - policy sign-off by version\n"
            "restore_tests.csv - platform backup restore tests\n"
        ))
        bundle.writestr("users_and_roles.csv", _csv(
            [[membership.user.email, membership.user.get_full_name(), membership.role.name, "yes" if hasattr(membership.user, "mfa") and membership.user.mfa.is_enabled else "no", membership.user.last_login.isoformat() if membership.user.last_login else "", membership.created_at.date().isoformat()] for membership in members],
            ["email", "name", "role", "mfa", "last_sign_in", "member_since"],
        ))
        audit = AuditLog.objects.filter(institution=institution, created_at__date__gte=start, created_at__date__lte=end).select_related("actor").order_by("created_at")
        bundle.writestr("audit_trail.csv", _csv(
            [[entry.created_at.isoformat(), entry.action, entry.actor.email if entry.actor else "", entry.entity_type, entry.entity_id or "", entry.ip_address or ""] for entry in audit.iterator()],
            ["at", "action", "actor", "entity_type", "entity_id", "ip_address"],
        ))
        bundle.writestr("security_checks.json", json.dumps(overview(institution), indent=2, default=str))
        rows = [["rule", rule.get_category_display(), f"keep {rule.keep_months} months, {rule.get_action_display().lower()}", "active" if rule.is_active else "off", rule.last_run_at.isoformat() if rule.last_run_at else ""] for rule in RetentionRule.objects.filter(institution=institution)]
        rows += [["legal_hold", hold.title, hold.reason, "released" if hold.released_at else "active", hold.created_at.isoformat()] for hold in LegalHold.objects.filter(institution=institution)]
        bundle.writestr("retention_and_holds.csv", _csv(rows, ["kind", "name", "detail", "state", "date"]))
        bundle.writestr("data_subject_requests.csv", _csv(
            [[request.get_request_type_display(), request.received_at.isoformat(), request.due_on.isoformat(), request.get_status_display(), request.closed_at.isoformat() if request.closed_at else "", "yes" if request.closed_at and request.closed_at.date() > request.due_on else "no"] for request in DataSubjectRequest.objects.filter(institution=institution, received_at__date__lte=end)],
            ["type", "received", "due", "status", "closed", "late"],
        ))
        policy_rows = []
        for policy in Policy.objects.filter(institution=institution).exclude(status=Policy.Status.DRAFT):
            signed = PolicyAcknowledgement.objects.filter(policy=policy, version=policy.version).count()
            policy_rows.append([policy.title, policy.version, policy.get_status_display(), policy.published_at.isoformat() if policy.published_at else "", signed])
        bundle.writestr("policy_acknowledgements.csv", _csv(policy_rows, ["policy", "version", "status", "published", "acknowledgements"]))
        bundle.writestr("restore_tests.csv", _csv(
            [[test.performed_on.isoformat(), test.get_result_display(), test.backup_reference, test.environment, test.duration_minutes or "", test.checks, test.issues] for test in RestoreTest.objects.all()[:50]],
            ["performed_on", "result", "backup", "environment", "minutes", "checks", "issues"],
        ))
    return archive.getvalue()
