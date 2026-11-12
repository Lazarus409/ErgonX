from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.privacy.views import DataBreachViewSet, DataCatalogueView, DataSubjectRequestViewSet, PrivacyProfileView, LegalHoldViewSet, MyPrivacyView, RetentionRuleViewSet

router = DefaultRouter()
router.register("privacy/retention-rules", RetentionRuleViewSet, basename="privacy-retention-rule")
router.register("privacy/legal-holds", LegalHoldViewSet, basename="privacy-legal-hold")
router.register("privacy/requests", DataSubjectRequestViewSet, basename="privacy-request")
router.register("privacy/breaches", DataBreachViewSet, basename="privacy-breach")

urlpatterns = [
    path("me/privacy/", MyPrivacyView.as_view(), name="my-privacy"),
    path("privacy/data-catalogue/", DataCatalogueView.as_view(), name="privacy-data-catalogue"),
    path("privacy/profile/", PrivacyProfileView.as_view(), name="privacy-profile"),
    *router.urls,
]
