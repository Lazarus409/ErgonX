from django.utils import timezone
from django.http import HttpResponse
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.institutions.services import effective_permission_codes
from apps.operations.models import BackgroundJob, ExportJob, ImportJob, ImportRowResult
from apps.operations.serializers import BackgroundJobSerializer, ExportJobSerializer, ImportJobSerializer, ImportRowResultSerializer
from apps.operations.services import enqueue_background_job
from apps.reports.services import normalize_report_type
from apps.reports.views import report_scope
from common.scoping import INSTITUTION, data_scope
from common.viewsets import TenantModelViewSet


class ImportJobViewSet(TenantModelViewSet):
    model = ImportJob
    serializer_class = ImportJobSerializer
    permission_resource = "import_job"
    # Records are kept for audit: no hard DELETE route (W0-API-02).
    http_method_names = ("get", "post", "head", "options")

    def get_required_permission(self):
        if self.action == "confirm":
            return "import_job.create"
        return super().get_required_permission()

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, initiated_by=self.request.user)

    @action(detail=True, methods=("post",))
    def confirm(self, request, pk=None):
        job = self.get_object()
        if job.status != ImportJob.Status.READY:
            return Response({"detail": "Only validated import jobs can be confirmed."}, status=409)
        job.status = ImportJob.Status.COMMITTING
        job.confirmed_at = timezone.now()
        job.save(update_fields=("status", "confirmed_at", "updated_at"))
        enqueue_background_job(job_type="IMPORT_COMMIT", institution=request.institution, initiated_by=request.user, metadata={"import_job_id": str(job.id)})
        return Response(self.get_serializer(job).data)


class ImportRowResultViewSet(TenantModelViewSet):
    model = ImportRowResult
    serializer_class = ImportRowResultSerializer
    permission_resource = "import_job"
    http_method_names = ("get", "head", "options")

    def get_queryset(self):
        return super().get_queryset().select_related("import_job")


class ExportJobViewSet(TenantModelViewSet):
    model = ExportJob
    serializer_class = ExportJobSerializer
    permission_resource = "export_job"
    # Records are kept for audit: no hard DELETE route (W0-API-02).
    http_method_names = ("get", "post", "head", "options")

    def get_required_permission(self):
        if self.action == "download":
            return "export_job.view"
        return super().get_required_permission()

    def get_queryset(self):
        # An export holds report data: people see their own, report.all sees every export.
        queryset = super().get_queryset()
        if getattr(self, "swagger_fake_view", False):
            return queryset
        if "report.all" in effective_permission_codes(self.request.membership):
            return queryset
        return queryset.filter(initiated_by=self.request.user)

    def _authorize(self, export_type):
        name = normalize_report_type(export_type)
        report_scope(self.request, name)
        # The export runs later without the requester's data scope, so it is
        # offered only to members who read the report institution-wide.
        if data_scope(self.request) != INSTITUTION and "report.all" not in effective_permission_codes(self.request.membership):
            raise PermissionDenied("Your access to this report is limited to your team; download it from the report page instead.")

    def perform_create(self, serializer):
        self._authorize(serializer.validated_data["export_type"])
        item = serializer.save(institution=self.request.institution, initiated_by=self.request.user)
        enqueue_background_job(job_type="EXPORT_GENERATE", institution=self.request.institution, initiated_by=self.request.user, metadata={"export_job_id": str(item.id)})

    @action(detail=True, methods=("get",), url_path="download")
    def download(self, request, pk=None):
        item = self.get_object()
        self._authorize(item.export_type)
        if item.status != ExportJob.Status.COMPLETED or not item.result_content:
            return Response({"detail": "This export is not ready for download."}, status=409)
        response = HttpResponse(item.result_content, content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{item.export_type}.csv"'
        return response


class BackgroundJobViewSet(TenantModelViewSet):
    model = BackgroundJob
    serializer_class = BackgroundJobSerializer
    required_permission = "background_job.view"
    http_method_names = ("get", "head", "options")
