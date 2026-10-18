from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.security.views import EvidenceView, RestoreTestViewSet, SecurityOverviewView

router = DefaultRouter()
router.register("platform/restore-tests", RestoreTestViewSet, basename="platform-restore-test")

urlpatterns = [
    path("security/overview/", SecurityOverviewView.as_view(), name="security-overview"),
    path("security/evidence/", EvidenceView.as_view(), name="security-evidence"),
    *router.urls,
]
