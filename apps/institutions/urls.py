from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.institutions.views import CurrentInstitutionView, InstitutionModuleViewSet, InstitutionOnboardingView, InstitutionSettingsView, MembershipViewSet, MyMembershipsView, MyPreferencesView, PermissionCatalogView, RoleViewSet, UniversalSearchView

router = DefaultRouter()
router.register("roles", RoleViewSet, basename="role")
router.register("members", MembershipViewSet, basename="membership")
router.register("modules", InstitutionModuleViewSet, basename="institution-module")

urlpatterns = [
    path("current/", CurrentInstitutionView.as_view(), name="current"),
    path("memberships/", MyMembershipsView.as_view(), name="memberships"),
    path("permissions/", PermissionCatalogView.as_view(), name="permission-catalog"),
    path("preferences/", MyPreferencesView.as_view(), name="my-preferences"),
    path("settings/", InstitutionSettingsView.as_view(), name="institution-settings"),
    path("onboarding/", InstitutionOnboardingView.as_view(), name="institution-onboarding"),
    path("search/", UniversalSearchView.as_view(), name="universal-search"),
]

urlpatterns += router.urls
