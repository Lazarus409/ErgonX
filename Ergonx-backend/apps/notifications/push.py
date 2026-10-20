"""Web push: notifications on the lock screen of a phone or desktop that turned it on.

Enabled when WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY are set (generate them once with
`manage.py generate_vapid_keys`; no third-party account is needed). Each in-app notification
is pushed, after its transaction commits, to every device the recipient subscribed. Pushes
carry the title, message and the page to open; subscriptions the push service reports as
gone are removed.
"""

import json
import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


def push_enabled():
    return bool(settings.WEB_PUSH_PUBLIC_KEY and settings.WEB_PUSH_PRIVATE_KEY)


def _payload(notification):
    from apps.notifications.serializers import NotificationSerializer

    return json.dumps({
        "title": notification.title,
        "body": notification.message[:300],
        "url": NotificationSerializer.route_for(notification.notification_type, notification.metadata) or "/notifications",
        "tag": str(notification.pk),
    })


def send_push(notification):
    from pywebpush import WebPushException, webpush

    from apps.notifications.models import PushSubscription

    payload = _payload(notification)
    for subscription in PushSubscription.objects.filter(user_id=notification.user_id):
        try:
            webpush(
                subscription_info={"endpoint": subscription.endpoint, "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth}},
                data=payload,
                vapid_private_key=settings.WEB_PUSH_PRIVATE_KEY,
                vapid_claims={"sub": settings.WEB_PUSH_SUBJECT},
                ttl=24 * 3600,
                timeout=10,
            )
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                subscription.delete()
            else:
                logger.warning("Web push to subscription %s failed: %s", subscription.pk, exc)
            continue
        except Exception:  # noqa: BLE001 - one device must not stop the others
            logger.exception("Web push to subscription %s failed", subscription.pk)
            continue
        PushSubscription.objects.filter(pk=subscription.pk).update(last_success_at=timezone.now())


def queue_notification_push(notification):
    from apps.notifications.models import Notification, PushSubscription

    if not push_enabled() or notification.channel != Notification.Channel.IN_APP:
        return
    if not PushSubscription.objects.filter(user_id=notification.user_id).exists():
        return
    transaction.on_commit(lambda: send_push(notification))
