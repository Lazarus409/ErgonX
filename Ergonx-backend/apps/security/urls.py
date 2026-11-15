from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.security.views import EvidenceView, RestoreTestViewSet, SecurityIncidentViewSet, SecurityOverviewView

router = DefaultRouter()
router.register("platform/restore-tests", RestoreTestViewSet, basename="platform-restore-test")
router.register("platform/incidents", SecurityIncidentViewSet, basename="platform-incident")

urlpatterns = [
    path("security/overview/", SecurityOverviewView.as_view(), name="security-overview"),
    path("security/evidence/", EvidenceView.as_view(), name="security-evidence"),
    *router.urls,
]
