from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.integrations.views import (
    ApiKeyViewSet,
    ExternalEmployeesView,
    ExternalLeaveView,
    ExternalPunchesView,
    MyCalendarFeedView,
    PublicCalendarView,
    WebhookEndpointViewSet,
    WebhookEventsView,
)

router = DefaultRouter()
router.register("integrations/api-keys", ApiKeyViewSet, basename="integration-api-key")
router.register("integrations/webhooks", WebhookEndpointViewSet, basename="integration-webhook")

urlpatterns = [
    path("integrations/catalogue/", WebhookEventsView.as_view(), name="integration-catalogue"),
    # For outside systems, with an API key.
    path("integrations/v1/employees/", ExternalEmployeesView.as_view(), name="integration-employees"),
    path("integrations/v1/leave/", ExternalLeaveView.as_view(), name="integration-leave"),
    path("integrations/v1/attendance/punches/", ExternalPunchesView.as_view(), name="integration-punches"),
    # Personal calendar subscription.
    path("me/calendar-feed/", MyCalendarFeedView.as_view(), name="my-calendar-feed"),
    path("public/calendar/<str:token>.ics", PublicCalendarView.as_view(), name="public-calendar"),
    # The web app's API proxy adds a trailing slash to every path it forwards.
    path("public/calendar/<str:token>.ics/", PublicCalendarView.as_view(), name="public-calendar-proxied"),
    *router.urls,
]
