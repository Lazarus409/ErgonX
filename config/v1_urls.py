from django.urls import include, path

from apps.institutions.access import AccessRequestView
from apps.institutions.views import UniversalSearchView, SearchEntriesView

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
    path("institutions/", include("apps.institutions.urls")),
    path("platform/", include("apps.accounts.platform_urls")),
    path("", include("apps.audit.urls")),
    path("search/", UniversalSearchView.as_view(), name="universal-search"),
    path("search/entries/", SearchEntriesView.as_view(), name="search-entries"),
    path("access-requests/", AccessRequestView.as_view(), name="access-requests"),
    path("", include("apps.organization.urls")),
    path("", include("apps.employees.urls")),
    path("", include("apps.leave.urls")),
    path("", include("apps.scheduling.urls")),
    path("", include("apps.attendance.urls")),
    path("", include("apps.compensation.urls")),
    path("", include("apps.payroll.urls")),
    path("", include("apps.accounting.urls")),
    path("", include("apps.documents.urls")),
    path("", include("apps.workflows.urls")),
    path("", include("apps.operations.urls")),
    path("", include("apps.dashboards.urls")),
    path("", include("apps.reports.urls")),
    path("", include("apps.recruitment.urls")),
    path("", include("apps.training.urls")),
    path("", include("apps.performance.urls")),
    path("", include("apps.complaints.urls")),
    path("", include("apps.notifications.urls")),
]
