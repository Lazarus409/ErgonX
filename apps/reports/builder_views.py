import csv
import io

from django.db.models import Q
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_audit_event
from apps.institutions.services import effective_permission_codes
from apps.reports import builder
from apps.reports.models import CustomReport
from common.permissions import TenantContextPermission, TenantRBACPermission
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet


class BuilderBase(APIView):
    permission_classes = (TenantContextPermission, TenantRBACPermission)

    def get_required_permission(self):
        # Each dataset checks its own permission; anyone may open the builder.
        return "home.view"


def _csv_response(result, name):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([column["label"] for column in result["columns"]])
    for row in result["rows"]:
        writer.writerow([row.get(column["key"], "") for column in result["columns"]])
    response = HttpResponse(buffer.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{name}.csv"'
    return response


class DatasetsView(BuilderBase):
    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        permissions = set(effective_permission_codes(request.membership))
        enabled = set(request.institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
        return Response({"datasets": builder.available_datasets(permissions, enabled)})


class RunSerializer(serializers.Serializer):
    dataset = serializers.CharField(max_length=40)
    definition = serializers.DictField()
    format = serializers.ChoiceField(choices=("json", "csv"), default="json")


class RunView(BuilderBase):
    @extend_schema(request=RunSerializer, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        payload = RunSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = call_validated_service(builder.run, request=request, dataset_key=payload.validated_data["dataset"], definition=payload.validated_data["definition"])
        if payload.validated_data["format"] == "csv":
            record_audit_event(actor=request.user, institution=request.institution, entity=request.institution, action="reports.builder.exported", metadata={"dataset": result["dataset"], "rows": len(result["rows"])})
            return _csv_response(result, f"report-{result['dataset']}")
        return Response(result)


class CustomReportSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = CustomReport
        fields = ("id", "name", "description", "dataset", "definition", "visibility", "owner_name", "is_owner", "created_at", "updated_at")
        read_only_fields = ("id", "owner_name", "is_owner", "created_at", "updated_at")

    def get_owner_name(self, report):
        return report.owner.get_full_name() or report.owner.email

    def get_is_owner(self, report):
        return report.owner_id == self.context["request"].user.id

    def validate(self, attrs):
        request = self.context["request"]
        dataset = attrs.get("dataset", getattr(self.instance, "dataset", None))
        definition = attrs.get("definition", getattr(self.instance, "definition", None))
        permissions = set(effective_permission_codes(request.membership))
        enabled = set(request.institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
        call_validated_service(builder.validate, dataset_key=dataset, definition=definition or {}, permissions=permissions, enabled_modules=enabled)
        return attrs


class CustomReportViewSet(TenantModelViewSet):
    """Saved builder reports: your own, plus those shared with everyone that you have the data access to run."""

    model = CustomReport
    serializer_class = CustomReportSerializer
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    def get_required_permission(self):
        return "home.view"

    def get_queryset(self):
        permissions = set(effective_permission_codes(self.request.membership))
        enabled = set(self.request.institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
        runnable = [row["key"] for row in builder.available_datasets(permissions, enabled)]
        return super().get_queryset().filter(Q(owner=self.request.user) | Q(visibility=CustomReport.Visibility.INSTITUTION, dataset__in=runnable)).select_related("owner")

    def perform_create(self, serializer):
        report = serializer.save(institution=self.request.institution, owner=self.request.user)
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=report, action="reports.custom_report.saved", metadata={"name": report.name, "dataset": report.dataset})

    def _require_owner(self, report):
        if report.owner_id != self.request.user.id:
            raise PermissionDenied("Only the report's owner can change it. Save a copy instead.")

    def perform_update(self, serializer):
        self._require_owner(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_owner(instance)
        instance.delete()

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=("get",))
    def run(self, request, pk=None):
        report = self.get_object()
        result = call_validated_service(builder.run, request=request, dataset_key=report.dataset, definition=report.definition)
        if request.query_params.get("format") == "csv":
            record_audit_event(actor=request.user, institution=request.institution, entity=report, action="reports.builder.exported", metadata={"dataset": report.dataset, "rows": len(result["rows"])})
            return _csv_response(result, report.name.replace('"', "").replace("/", "-")[:80] or "report")
        return Response({**result, "report": CustomReportSerializer(report, context={"request": request}).data})
