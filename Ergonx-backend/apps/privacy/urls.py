from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.privacy.views import DataSubjectRequestViewSet, LegalHoldViewSet, MyPrivacyView, RetentionRuleViewSet

router = DefaultRouter()
router.register("privacy/retention-rules", RetentionRuleViewSet, basename="privacy-retention-rule")
router.register("privacy/legal-holds", LegalHoldViewSet, basename="privacy-legal-hold")
router.register("privacy/requests", DataSubjectRequestViewSet, basename="privacy-request")

urlpatterns = [path("me/privacy/", MyPrivacyView.as_view(), name="my-privacy"), *router.urls]
