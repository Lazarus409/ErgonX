from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.reports.builder_views import CustomReportViewSet, DatasetsView, RunView
from apps.reports.library import AnalyticsLibraryViewSet
from apps.reports.views import ReportsViewSet

router = DefaultRouter()
router.register("reports", ReportsViewSet, basename="report")
router.register("report-library", AnalyticsLibraryViewSet, basename="report-library")
router.register("custom-reports", CustomReportViewSet, basename="custom-report")
urlpatterns = [
    path("report-builder/datasets/", DatasetsView.as_view(), name="report-builder-datasets"),
    path("report-builder/run/", RunView.as_view(), name="report-builder-run"),
    *router.urls,
]
