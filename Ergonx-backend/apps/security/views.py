from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView

from apps.audit.services import record_audit_event
from apps.security import services
from apps.institutions.models import Institution
from apps.security import incidents
from apps.security.models import IncidentUpdate, RestoreTest, SecurityIncident
from common.serializers import call_validated_service
from common.permissions import TenantContextPermission, TenantRBACPermission
from common.scoping import permission_codes

READERS = ("settings.security.manage", "audit.view")


class SecurityBaseView(APIView):
    """Administrators and auditors (settings.security.manage or audit.view)."""

    permission_classes = (TenantContextPermission, TenantRBACPermission)

    def get_required_permission(self):
        return "home.view"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not set(READERS) & permission_codes(request):
            raise PermissionDenied("Security oversight is for administrators and auditors.")


class SecurityOverviewView(SecurityBaseView):
    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        return Response(services.overview(request.institution))


class EvidenceView(SecurityBaseView):
    @extend_schema(responses={(200, "application/zip"): OpenApiTypes.BINARY})
    def get(self, request):
        today = timezone.localdate()
        start = parse_date(request.query_params.get("from") or "") or today - timedelta(days=90)
        end = parse_date(request.query_params.get("to") or "") or today
        if end < start or (end - start).days > 400:
            raise ValidationError({"to": "Choose a period of up to about a year."})
        content = services.evidence_zip(request.institution, start=start, end=end)
        record_audit_event(actor=request.user, institution=request.institution, entity=request.institution, action="security.evidence.exported", metadata={"from": str(start), "to": str(end)})
        response = HttpResponse(content, content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="ergonx-evidence-{request.institution.code}-{start}-{end}.zip"'
        return response


class RestoreTestSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()
    result_label = serializers.CharField(source="get_result_display", read_only=True)

    class Meta:
        model = RestoreTest
        fields = ("id", "performed_on", "backup_reference", "environment", "result", "result_label", "duration_minutes", "checks", "issues", "performed_by_name", "created_at")
        read_only_fields = ("id", "performed_by_name", "created_at")

    def get_performed_by_name(self, test):
        return (test.performed_by.get_full_name() or test.performed_by.email) if test.performed_by else ""


class RestoreTestViewSet(viewsets.ModelViewSet):
    """Platform administrators record backup restore tests; records are kept, never edited away."""

    serializer_class = RestoreTestSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "head", "options")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (request.user.is_platform_admin or request.user.is_superuser):
            raise PermissionDenied("Only platform administrators record restore tests.")

    def get_queryset(self):
        return RestoreTest.objects.select_related("performed_by")

    def perform_create(self, serializer):
        test = serializer.save(performed_by=self.request.user)
        record_audit_event(actor=self.request.user, entity=test, action="security.restore_test.recorded", metadata={"result": test.result, "performed_on": str(test.performed_on)})


class PlatformOnlyMixin:
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (request.user.is_platform_admin or request.user.is_superuser):
            raise PermissionDenied("Only platform administrators handle platform incidents.")


class IncidentUpdateSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = IncidentUpdate
        fields = ("id", "note", "status", "status_label", "author_name", "created_at")

    def get_author_name(self, entry):
        return (entry.author.get_full_name() or entry.author.email) if entry.author_id else "System"

    def get_status_label(self, entry):
        return SecurityIncident.Status(entry.status).label if entry.status else ""


class SecurityIncidentSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    severity_label = serializers.CharField(source="get_severity_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    affected_institutions = serializers.PrimaryKeyRelatedField(many=True, queryset=Institution.objects.all(), required=False)
    affected_names = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    timings = serializers.SerializerMethodField()
    updates = IncidentUpdateSerializer(many=True, read_only=True)

    class Meta:
        model = SecurityIncident
        fields = (
            "id", "title", "summary", "kind", "kind_label", "severity", "severity_label", "status", "status_label",
            "detected_at", "contained_at", "recovered_at", "closed_at", "personal_data_affected", "affected_institutions",
            "affected_names", "root_cause", "lessons_learned", "lead", "lead_name", "timings", "updates", "created_at",
        )
        read_only_fields = ("id", "status", "contained_at", "recovered_at", "closed_at", "created_at")

    def get_affected_names(self, incident):
        return [institution.name for institution in incident.affected_institutions.all()]

    def get_lead_name(self, incident):
        return (incident.lead.get_full_name() or incident.lead.email) if incident.lead_id else None

    def get_timings(self, incident):
        return incidents.timings(incident)


class SecurityIncidentViewSet(PlatformOnlyMixin, viewsets.ModelViewSet):
    """The platform incident register, with each incident's timeline and recovery times against the targets."""

    serializer_class = SecurityIncidentSerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "post", "patch", "head", "options")

    def get_queryset(self):
        return SecurityIncident.objects.select_related("lead").prefetch_related("affected_institutions", "updates__author")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data = {"targets": incidents.recovery_targets(), **(response.data if isinstance(response.data, dict) else {"results": response.data})}
        return response

    def create(self, request, *args, **kwargs):
        payload = self.get_serializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        incident = call_validated_service(incidents.record_incident, actor=request.user, affected_institutions=values.pop("affected_institutions", []), **values)
        return Response(self.get_serializer(self.get_queryset().get(pk=incident.pk)).data, status=201)

    def partial_update(self, request, *args, **kwargs):
        incident = self.get_object()
        payload = self.get_serializer(incident, data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        call_validated_service(incidents.update_incident, incident=incident, actor=request.user, affected_institutions=values.pop("affected_institutions", None), **values)
        return Response(self.get_serializer(self.get_queryset().get(pk=incident.pk)).data)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=SecurityIncidentSerializer)
    @action(detail=True, methods=("post",))
    def updates(self, request, pk=None):
        incident = self.get_object()
        call_validated_service(incidents.add_update, incident=incident, actor=request.user, note=str(request.data.get("note") or ""), status=str(request.data.get("status") or ""))
        return Response(self.get_serializer(self.get_queryset().get(pk=incident.pk)).data)
