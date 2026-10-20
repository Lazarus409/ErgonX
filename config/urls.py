from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from common import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/live/", health.live, name="health-live"),
    path("api/v1/health/ready/", health.ready, name="health-ready"),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/v1/", include(("config.v1_urls", "api-v1"), namespace="v1")),
]
