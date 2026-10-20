from django.utils import timezone
from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.institutions.services import effective_permission_codes
from apps.operations.models import BackgroundJob, ExportJob, ImportJob, ImportRowResult
from apps.operations.serializers import BackgroundJobSerializer, ExportJobSerializer, ImportJobSerializer, ImportRowResultSerializer
from apps.operations.services import enqueue_background_job
from apps.operations import employee_import
from apps.reports.services import normalize_report_type
from apps.reports.views import report_scope
from common.scoping import INSTITUTION, data_scope
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet


class ImportJobViewSet(TenantModelViewSet):
    model = ImportJob
    serializer_class = ImportJobSerializer
    permission_resource = "import_job"
    # Records are kept for audit: no hard DELETE route (W0-API-02).
    http_method_names = ("get", "post", "head", "options")

    def get_required_permission(self):
        if self.action in {"confirm", "employee_upload", "employee_template", "employee_columns"}:
            return "import_job.create"
        return super().get_required_permission()

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, initiated_by=self.request.user)

    @extend_schema(summary="Employee import template", responses={(200, "text/csv"): OpenApiTypes.BINARY}, filters=False)
    @action(detail=False, methods=("get",), url_path="employee-template", filter_backends=(), pagination_class=None)
    def employee_template(self, request):
        """A CSV with the import columns and one example row to replace."""
        response = HttpResponse(employee_import.template_csv(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="ergonx-employee-import-template.csv"'
        return response

    @extend_schema(
        summary="Employee import columns",
        responses=inline_serializer("EmployeeImportColumn", {"name": serializers.CharField(), "required": serializers.BooleanField(), "help": serializers.CharField()}, many=True),
        filters=False,
    )
    @action(detail=False, methods=("get",), url_path="employee-columns", filter_backends=(), pagination_class=None)
    def employee_columns(self, request):
        """The columns an employee import file may contain, for the upload guide."""
        return Response([{"name": name, "required": required, "help": help_text} for name, required, help_text in employee_import.COLUMNS])

    @extend_schema(
        summary="Upload an employee import file",
        request={"multipart/form-data": inline_serializer("EmployeeImportUpload", {"file": serializers.FileField()})},
        responses=ImportJobSerializer,
        filters=False,
    )
    @action(detail=False, methods=("post",), url_path="employee-upload", filter_backends=(), parser_classes=(MultiPartParser, FormParser))
    def employee_upload(self, request):
        """Validate a CSV or XLSX of employees row by row. Nothing is created until the job is confirmed."""
        upload = request.FILES.get("file")
        if upload is None:
            raise DRFValidationError({"file": "Choose a CSV or Excel (.xlsx) file."})
        job = call_validated_service(
            employee_import.validate_employee_import,
            institution=request.institution,
            actor=request.user,
            filename=upload.name or "employees.csv",
            content=upload.read(),
        )
        return Response(self.get_serializer(job).data, status=201)

    @action(detail=True, methods=("post",))
    def confirm(self, request, pk=None):
        job = self.get_object()
        if job.import_type == "EMPLOYEE" and job.metadata.get("format") == employee_import.FORMAT:
            # Committed in the request: production runs no background worker.
            job = call_validated_service(employee_import.commit_employee_rows, import_job=job, actor=request.user)
            return Response(self.get_serializer(job).data)
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
    filterset_fields = ("import_job", "status")
    ordering_fields = ("row_number",)

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
