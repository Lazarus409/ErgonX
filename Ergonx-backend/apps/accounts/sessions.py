"""Signed-in sessions (Wave 2): issue tokens bound to a session, list and revoke them."""

from django.conf import settings
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import UserSession
from apps.accounts.security import client_ip
from apps.audit.services import record_audit_event

SESSION_CLAIM = "sid"


def start_session(user, request=None):
    """Create a session and return its refresh token (access via ``.access_token``)."""
    meta = getattr(request, "META", {}) if request is not None else {}
    ip_address = client_ip(request)[0] if request is not None else None
    user_agent = str(meta.get("HTTP_USER_AGENT", ""))[:300]
    previous = UserSession.objects.filter(user=user)
    new_device = previous.exists() and not previous.filter(user_agent=user_agent).exists() and not (ip_address and previous.filter(ip_address=ip_address).exists())
    session = UserSession.objects.create(user=user, ip_address=ip_address, user_agent=user_agent, last_seen_at=timezone.now())
    if new_device:
        alert_new_sign_in(user, session)
    refresh = RefreshToken.for_user(user)
    refresh["email"] = user.email
    refresh[SESSION_CLAIM] = str(session.id)
    return refresh


def session_is_active(sid):
    return UserSession.objects.filter(pk=sid, revoked_at__isnull=True).exists()


def active_sessions(user):
    """Unrevoked sessions whose refresh token can still be valid."""
    cutoff = timezone.now() - settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    return UserSession.objects.filter(user=user, revoked_at__isnull=True, last_seen_at__gte=cutoff).order_by("-last_seen_at")


def revoke_sessions(user, *, actor, reason, keep_sid=None, only=None):
    """Revoke the user's sessions (all, all but ``keep_sid``, or ``only`` one). Returns the count."""
    sessions = UserSession.objects.filter(user=user, revoked_at__isnull=True)
    if only is not None:
        sessions = sessions.filter(pk=only)
    elif keep_sid:
        sessions = sessions.exclude(pk=keep_sid)
    ids = [str(pk) for pk in sessions.values_list("pk", flat=True)]
    if not ids:
        return 0
    UserSession.objects.filter(pk__in=ids).update(revoked_at=timezone.now(), revoked_reason=reason[:40])
    record_audit_event(actor=actor, entity=user, action="account.session.revoked", metadata={"sessions": ids, "reason": reason})
    return len(ids)



def alert_new_sign_in(user, session):
    """Tell the person their account signed in from a device or network it has not used before.

    An in-app notification in their primary organisation, and an email when email delivery is
    on. Security alerts are sent regardless of notification preferences.
    """
    import logging

    from django.db import transaction

    from apps.audit.devices import describe_user_agent
    from apps.institutions.models import InstitutionMembership
    from apps.notifications.models import Notification

    device = describe_user_agent(session.user_agent) or "an unrecognised device"
    when = timezone.localtime(session.created_at).strftime("%d %b %Y at %H:%M")
    where = f" from {session.ip_address}" if session.ip_address else ""
    message = (
        f"Your ErgonX account signed in on {device}{where} on {when}. If this was you, there's nothing to do. "
        "If not, change your password now and sign out the session under Settings > Security."
    )
    record_audit_event(actor=user, entity=user, action="account.sign_in.new_device", metadata={"session": str(session.id), "device": device, "ip_address": session.ip_address})
    membership = (
        InstitutionMembership.objects.filter(user=user, status=InstitutionMembership.Status.ACTIVE)
        .order_by("-is_primary", "created_at").select_related("institution").first()
    )
    if membership is not None:
        Notification.objects.create(
            institution=membership.institution, user=user, notification_type="SECURITY_NEW_SIGN_IN",
            title="New sign-in to your account", message=message, channel=Notification.Channel.IN_APP,
            metadata={"session_id": str(session.id), "device": device},
        )
    if getattr(settings, "EMAIL_DELIVERY_ENABLED", False) and user.email:
        def send():
            from django.core.mail import send_mail

            try:
                send_mail("New sign-in to your ErgonX account", message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
            except Exception:  # noqa: BLE001 - the in-app alert and audit event are the record
                logging.getLogger("ergonx.security").exception("New sign-in email failed for user %s", user.pk)

        transaction.on_commit(send)
