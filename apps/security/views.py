from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_audit_event
from apps.security import services
from apps.security.models import RestoreTest
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
