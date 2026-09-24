from django.urls import path

from apps.notifications.views import (
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
)

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/mark-all-read/", NotificationMarkAllReadView.as_view(), name="notification-mark-all-read"),
    path("notifications/<uuid:notification_id>/mark-read/", NotificationMarkReadView.as_view(), name="notification-mark-read"),
]
