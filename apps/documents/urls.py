from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.documents.views import (
    DocumentRequirementViewSet,
    DocumentRequirementWaiverViewSet,
    DocumentViewSet,
    EmployeeDocumentChecklistView,
    ImageAssetViewSet,
    PolicyViewSet,
    SelfServiceDocumentChecklistView,
    SelfServicePoliciesView,
    SelfServicePolicyAcknowledgeView,
    SelfServicePolicyDetailView,
    SelfServicePolicyFileView,
)

router = DefaultRouter()
router.register("documents", DocumentViewSet, basename="document")
router.register("images", ImageAssetViewSet, basename="image")
router.register("document-requirements", DocumentRequirementViewSet, basename="document-requirement")
router.register("policies", PolicyViewSet, basename="policy")
router.register("document-requirement-waivers", DocumentRequirementWaiverViewSet, basename="document-requirement-waiver")
urlpatterns = [
    path("employees/me/policies/", SelfServicePoliciesView.as_view(), name="self-service-policies"),
    path("employees/me/policies/<uuid:pk>/", SelfServicePolicyDetailView.as_view(), name="self-service-policy"),
    path("employees/me/policies/<uuid:pk>/file/", SelfServicePolicyFileView.as_view(), name="self-service-policy-file"),
    path("employees/me/policies/<uuid:pk>/acknowledge/", SelfServicePolicyAcknowledgeView.as_view(), name="self-service-policy-acknowledge"),
    path("employees/me/document-checklist/", SelfServiceDocumentChecklistView.as_view(), name="self-service-document-checklist"),
    path("employees/<uuid:pk>/document-checklist/", EmployeeDocumentChecklistView.as_view(), name="employee-document-checklist"),
    *router.urls,
]
