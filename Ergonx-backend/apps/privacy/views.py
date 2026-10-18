import json

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_audit_event
from apps.employees.models import Employee
from apps.privacy import services
from apps.privacy.models import DataSubjectRequest, LegalHold, RetentionRule
from apps.recruitment.models import Candidate
from common.permissions import TenantContextPermission, TenantRBACPermission
from common.serializers import ValidatedModelSerializer, call_validated_service
from common.viewsets import TenantModelViewSet


def _read_or_manage(view):
    return "privacy.view" if view.action in ("list", "retrieve", "report", "export", "consents") else "privacy.manage"


class RetentionRuleSerializer(ValidatedModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = RetentionRule
        fields = ("id", "category", "category_label", "keep_months", "action", "is_active", "notes", "last_run_at", "updated_at")
        read_only_fields = ("id", "last_run_at", "updated_at")


class RetentionRuleViewSet(TenantModelViewSet):
    model = RetentionRule
    serializer_class = RetentionRuleSerializer
    http_method_names = ("get", "post", "patch", "head", "options")

    def get_required_permission(self):
        return _read_or_manage(self)

    def perform_create(self, serializer):
        rule = serializer.save(institution=self.request.institution)
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=rule, action="privacy.retention.rule_saved", metadata={"category": rule.category, "keep_months": rule.keep_months, "action": rule.action})

    def perform_update(self, serializer):
        rule = serializer.save()
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=rule, action="privacy.retention.rule_saved", metadata={"category": rule.category, "keep_months": rule.keep_months, "action": rule.action})

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=("get",))
    def report(self, request):
        return Response(services.retention_report(request.institution))

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=("post",))
    def run(self, request, pk=None):
        done = call_validated_service(services.run_retention, institution=request.institution, actor=request.user, rule=self.get_object())
        return Response({"processed": done, "report": services.retention_report(request.institution)})


class LegalHoldSerializer(serializers.ModelSerializer):
    employees = serializers.PrimaryKeyRelatedField(many=True, queryset=Employee.objects.none(), required=False)
    candidates = serializers.PrimaryKeyRelatedField(many=True, queryset=Candidate.objects.none(), required=False)
    employee_names = serializers.SerializerMethodField()
    candidate_names = serializers.SerializerMethodField()

    class Meta:
        model = LegalHold
        fields = ("id", "title", "reason", "employees", "candidates", "employee_names", "candidate_names", "released_at", "created_at")
        read_only_fields = ("id", "released_at", "created_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        institution = getattr(self.context.get("request"), "institution", None)
        if institution is not None:
            self.fields["employees"].child_relation.queryset = Employee.objects.for_institution(institution)
            self.fields["candidates"].child_relation.queryset = Candidate.objects.for_institution(institution)

    def get_employee_names(self, hold):
        return [employee.full_name for employee in hold.employees.all()]

    def get_candidate_names(self, hold):
        return [candidate.full_name for candidate in hold.candidates.all()]


class LegalHoldViewSet(TenantModelViewSet):
    model = LegalHold
    serializer_class = LegalHoldSerializer
    http_method_names = ("get", "post", "patch", "head", "options")

    def get_required_permission(self):
        return _read_or_manage(self)

    def get_queryset(self):
        return super().get_queryset().prefetch_related("employees", "candidates")

    def perform_create(self, serializer):
        hold = serializer.save(institution=self.request.institution, created_by=self.request.user)
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=hold, action="privacy.legal_hold.placed", metadata={"title": hold.title, "employees": hold.employees.count(), "candidates": hold.candidates.count()})

    def perform_update(self, serializer):
        if serializer.instance.released_at:
            raise serializers.ValidationError({"released_at": "A released hold can't be changed."})
        hold = serializer.save()
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=hold, action="privacy.legal_hold.updated", metadata={"title": hold.title})

    @extend_schema(request=None, responses=LegalHoldSerializer)
    @action(detail=True, methods=("post",))
    def release(self, request, pk=None):
        hold = self.get_object()
        if hold.released_at is None:
            hold.released_at, hold.released_by = timezone.now(), request.user
            hold.save(update_fields=("released_at", "released_by", "updated_at"))
            record_audit_event(actor=request.user, institution=request.institution, entity=hold, action="privacy.legal_hold.released", metadata={"title": hold.title})
        return Response(self.get_serializer(hold).data)


class DataSubjectRequestSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source="get_request_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    subject = serializers.SerializerMethodField()
    overdue = serializers.SerializerMethodField()

    class Meta:
        model = DataSubjectRequest
        fields = (
            "id", "request_type", "type_label", "employee", "candidate", "subject", "requester_name", "requester_email", "details", "status",
            "status_label", "received_at", "due_on", "overdue", "outcome", "closed_at",
        )
        read_only_fields = fields

    def get_subject(self, request):
        if request.employee_id:
            return f"Employee: {request.employee.full_name}"
        if request.candidate_id:
            return f"Candidate: {request.candidate.full_name}"
        return "Not linked"

    def get_overdue(self, request):
        return request.status in (DataSubjectRequest.Status.RECEIVED, DataSubjectRequest.Status.IN_PROGRESS) and request.due_on < timezone.localdate()


class DataSubjectRequestCreateSerializer(serializers.Serializer):
    request_type = serializers.ChoiceField(choices=DataSubjectRequest.Type.choices)
    requester_name = serializers.CharField(max_length=200)
    requester_email = serializers.EmailField(required=False, allow_blank=True)
    details = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    employee = serializers.UUIDField(required=False, allow_null=True)
    candidate = serializers.UUIDField(required=False, allow_null=True)
    received_at = serializers.DateTimeField(required=False)


class DataSubjectRequestViewSet(TenantModelViewSet):
    """Requests HR handles, including those received by email or letter and entered here."""

    model = DataSubjectRequest
    serializer_class = DataSubjectRequestSerializer
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("status", "request_type")

    def get_required_permission(self):
        return _read_or_manage(self)

    def get_queryset(self):
        return super().get_queryset().select_related("employee", "candidate")

    def create(self, request, *args, **kwargs):
        payload = DataSubjectRequestCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        if values.get("employee"):
            values["employee"] = get_object_or_404(Employee.objects.for_institution(request.institution), pk=values["employee"])
        if values.get("candidate"):
            values["candidate"] = get_object_or_404(Candidate.objects.for_institution(request.institution), pk=values["candidate"])
        created = call_validated_service(services.create_request, institution=request.institution, actor=request.user, **values)
        return Response(self.get_serializer(created).data, status=201)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=DataSubjectRequestSerializer)
    @action(detail=True, methods=("post",), url_path="status")
    def update_status(self, request, pk=None):
        updated = call_validated_service(services.close_request, request=self.get_object(), actor=request.user, status=str(request.data.get("status") or ""), outcome=str(request.data.get("outcome") or ""))
        return Response(self.get_serializer(updated).data)

    @extend_schema(responses={(200, "application/json"): OpenApiTypes.OBJECT})
    @action(detail=True, methods=("get",))
    def export(self, request, pk=None):
        item = self.get_object()
        data = call_validated_service(services.export_personal_data, request=item)
        record_audit_event(actor=request.user, institution=request.institution, entity=item, action="privacy.request.exported", metadata={"type": item.request_type})
        response = HttpResponse(json.dumps(data, indent=2, default=str), content_type="application/json")
        response["Content-Disposition"] = f'attachment; filename="personal-data-{item.id}.json"'
        return response

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=("post",))
    def erase(self, request, pk=None):
        """Carries out an erasure request for a candidate. Employees' records are kept under employment law; record the outcome instead."""
        item = self.get_object()
        if item.request_type != DataSubjectRequest.Type.ERASURE or not item.candidate_id:
            raise serializers.ValidationError({"request": "Erasure can be carried out here for candidates only."})
        call_validated_service(lambda: services.anonymise_candidate(item.candidate, actor=request.user, reason=f"Erasure request {item.id}"))
        updated = call_validated_service(services.close_request, request=item, actor=request.user, status=DataSubjectRequest.Status.COMPLETED, outcome="Candidate details anonymised and documents deleted.")
        return Response(self.get_serializer(updated).data)

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=("get",))
    def consents(self, request):
        return Response({"consents": services.consent_register(request.institution)})


class MyPrivacyView(APIView):
    """The signed-in employee's own requests, and making a new one."""

    permission_classes = (TenantContextPermission, TenantRBACPermission)

    def get_required_permission(self):
        return "home.view"

    def _employee(self, request):
        return get_object_or_404(Employee.objects.for_institution(request.institution), user=request.user)

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        employee = self._employee(request)
        rows = DataSubjectRequest.objects.for_institution(request.institution).filter(employee=employee)
        return Response({"requests": DataSubjectRequestSerializer(rows, many=True).data})

    @extend_schema(request=OpenApiTypes.OBJECT, responses={201: OpenApiTypes.OBJECT})
    def post(self, request):
        employee = self._employee(request)
        request_type = str(request.data.get("request_type") or "")
        if request_type not in DataSubjectRequest.Type.values:
            raise serializers.ValidationError({"request_type": "Choose what you are asking for."})
        open_same = DataSubjectRequest.objects.filter(employee=employee, request_type=request_type, status__in=(DataSubjectRequest.Status.RECEIVED, DataSubjectRequest.Status.IN_PROGRESS)).exists()
        if open_same:
            raise serializers.ValidationError({"request_type": "You already have a request of this kind in progress."})
        created = services.create_request(
            institution=request.institution, actor=request.user, request_type=request_type, requester_name=employee.full_name,
            requester_email=employee.work_email or request.user.email, details=str(request.data.get("details") or "")[:4000], employee=employee,
        )
        return Response(DataSubjectRequestSerializer(created).data, status=201)
