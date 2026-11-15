from django.urls import path

from apps.accounts.platform import (
    PlatformAuditLogView,
    PlatformInstitutionDetailView,
    PlatformInstitutionExportView,
    PlatformInstitutionSignOutView,
    PlatformInstitutionListView,
    PlatformInstitutionStatusView,
    PlatformOverviewView,
)

urlpatterns = [
    path("overview/", PlatformOverviewView.as_view(), name="platform-overview"),
    path("institutions/", PlatformInstitutionListView.as_view(), name="platform-institution-list"),
    path("institutions/<uuid:pk>/", PlatformInstitutionDetailView.as_view(), name="platform-institution-detail"),
    path("institutions/<uuid:pk>/sign-out/", PlatformInstitutionSignOutView.as_view(), name="platform-institution-sign-out"),
    path("institutions/<uuid:pk>/export/", PlatformInstitutionExportView.as_view(), name="platform-institution-export"),
    path("institutions/<uuid:pk>/<str:action>/", PlatformInstitutionStatusView.as_view(), name="platform-institution-status"),
    path("audit/", PlatformAuditLogView.as_view(), name="platform-audit"),
]
