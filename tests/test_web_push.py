import json
from unittest import mock

import pytest
from django.test import override_settings
from pywebpush import WebPushException

from apps.notifications.models import Notification, PushSubscription

pytestmark = pytest.mark.django_db
KEYS = {"WEB_PUSH_PUBLIC_KEY": "BPublicKeyForTests", "WEB_PUSH_PRIVATE_KEY": "private-key-for-tests"}
SUBSCRIPTION = {"endpoint": "https://push.example.com/send/abc", "keys": {"p256dh": "BKey", "auth": "secret"}}


@pytest.fixture
def member(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory()
    user = user_factory()
    membership_factory(user=user, institution=institution, role_code="EMPLOYEE", is_primary=True)
    api_client.force_authenticate(user)
    return {"institution": institution, "user": user, "client": api_client}


def test_push_is_unavailable_until_keys_are_set(member):
    assert member["client"].get("/api/v1/notifications/push/config/").data["enabled"] is False
    assert member["client"].post("/api/v1/notifications/push/subscription/", SUBSCRIPTION, format="json").status_code == 409


@override_settings(**KEYS)
def test_subscribe_then_notifications_are_pushed_after_commit(member, django_capture_on_commit_callbacks):
    client = member["client"]
    assert client.get("/api/v1/notifications/push/config/").data == {"enabled": True, "public_key": "BPublicKeyForTests", "devices": 0}
    assert client.post("/api/v1/notifications/push/subscription/", SUBSCRIPTION, format="json").status_code == 201
    assert client.post("/api/v1/notifications/push/subscription/", {**SUBSCRIPTION, "endpoint": "http://insecure.example.com"}, format="json").status_code == 400

    with mock.patch("pywebpush.webpush") as webpush, django_capture_on_commit_callbacks(execute=True):
        Notification.objects.create(
            institution=member["institution"], user=member["user"], notification_type="PAYSLIP_AVAILABLE",
            title="Payslip available", message="Your payslip for September 2026 is available.",
            channel=Notification.Channel.IN_APP, metadata={"payslip_id": "x"},
        )

    webpush.assert_called_once()
    kwargs = webpush.call_args.kwargs
    assert kwargs["subscription_info"]["endpoint"] == SUBSCRIPTION["endpoint"]
    assert json.loads(kwargs["data"])["title"] == "Payslip available"
    assert PushSubscription.objects.get().last_success_at is not None


@override_settings(**KEYS)
def test_gone_subscriptions_are_removed(member, django_capture_on_commit_callbacks):
    member["client"].post("/api/v1/notifications/push/subscription/", SUBSCRIPTION, format="json")
    gone = WebPushException("gone", response=mock.Mock(status_code=410))

    with mock.patch("pywebpush.webpush", side_effect=gone), django_capture_on_commit_callbacks(execute=True):
        Notification.objects.create(institution=member["institution"], user=member["user"], notification_type="TEST", title="Hi", message="Hi", channel=Notification.Channel.IN_APP)

    assert not PushSubscription.objects.exists()


@override_settings(**KEYS)
def test_unsubscribe_removes_only_your_own_device(member, user_factory):
    other = user_factory()
    PushSubscription.objects.create(user=other, endpoint="https://push.example.com/other", p256dh="k", auth="a")
    member["client"].post("/api/v1/notifications/push/subscription/", SUBSCRIPTION, format="json")

    response = member["client"].delete("/api/v1/notifications/push/subscription/", {"endpoint": "https://push.example.com/other"}, format="json")
    assert response.data["removed"] == 0
    response = member["client"].delete("/api/v1/notifications/push/subscription/", {"endpoint": SUBSCRIPTION["endpoint"]}, format="json")
    assert response.data["removed"] == 1
