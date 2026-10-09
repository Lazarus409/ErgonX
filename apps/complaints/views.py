from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import User
from apps.complaints.models import Complaint, ComplaintAttachment
from apps.complaints.serializers import (
    AssignSerializer,
    AttachmentUploadSerializer,
    ComplaintListSerializer,
    ComplaintSerializer,
    FileComplaintSerializer,
    NoteInputSerializer,
    PrioritySerializer,
    TextSerializer,
)
from apps.complaints.services import (
    add_attachment,
    add_note,
    assign_complaint,
    close_complaint,
    complaint_overview,
    file_complaint,
    handlers,
    reopen_complaint,
    resolve_complaint,
    set_priority,
    start_investigation,
    withdraw_complaint,
)
from apps.employees.models import Employee, Employment
from common.scoping import permission_codes
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet

# Every employee files, follows, messages and withdraws their own complaints.
SELF_SERVICE = ("list", "retrieve", "create", "withdraw", "notes", "colleagues", "attachments", "download_attachment")
STAFF = {"complaint.view", "complaint.manage"}


class ComplaintViewSet(TenantModelViewSet):
    """HR sees every complaint except one that names them; everyone else sees only their own."""

    model = Complaint
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("status", "category", "priority", "assigned_to")
    search_fields = ("code", "subject", "complainant__first_name", "complainant__last_name", "complainant__employee_number")
    ordering_fields = ("created_at", "priority", "status", "code")
    ordering = ("-created_at",)

    def get_required_permission(self):
        if self.action in SELF_SERVICE:
            return "home.view"
        if self.action in ("overview", "handlers"):
            return "complaint.view"
        return "complaint.manage"

    def get_serializer_class(self):
        return ComplaintListSerializer if self.action == "list" else ComplaintSerializer

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "permission_codes": permission_codes(self.request)}

    def get_queryset(self):
        queryset = super().get_queryset().select_related("complainant", "respondent", "assigned_to", "resolved_by")
        if getattr(self, "swagger_fake_view", False):
            return queryset
        user = self.request.user
        own = Q(complainant__user=user)
        if permission_codes(self.request) & STAFF:
            # Nobody sees a complaint about themselves.
            queryset = queryset.filter(own | ~Q(respondent__user=user) | Q(respondent__isnull=True))
        else:
            queryset = queryset.filter(own)
        if self.request.query_params.get("mine") in ("1", "true"):
            queryset = queryset.filter(own)
        if self.request.query_params.get("assigned") == "me":
            queryset = queryset.filter(assigned_to=user)
        return queryset

    def _respond(self, complaint, code=status.HTTP_200_OK):
        complaint = self.get_queryset().get(pk=complaint.pk)
        return Response(ComplaintSerializer(complaint, context=self.get_serializer_context()).data, status=code)

    @extend_schema(request=FileComplaintSerializer, responses={201: ComplaintSerializer})
    def create(self, request, *args, **kwargs):
        payload = FileComplaintSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        respondent_id = values.pop("respondent", None)
        respondent = None
        if respondent_id:
            respondent = Employee.objects.for_institution(request.institution).filter(pk=respondent_id).first()
            if respondent is None:
                raise NotFound("Employee not found.")
        complaint = call_validated_service(file_complaint, institution=request.institution, actor=request.user, respondent=respondent, **values)
        return self._respond(complaint, status.HTTP_201_CREATED)

    @extend_schema(request=AssignSerializer, responses=ComplaintSerializer)
    @action(detail=True, methods=("post",))
    def assign(self, request, pk=None):
        payload = AssignSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        assignee = get_object_or_404(User, pk=payload.validated_data["assignee"])
        return self._respond(call_validated_service(assign_complaint, complaint=self.get_object(), actor=request.user, assignee=assignee))

    @extend_schema(request=PrioritySerializer, responses=ComplaintSerializer)
    @action(detail=True, methods=("post",))
    def priority(self, request, pk=None):
        payload = PrioritySerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self._respond(call_validated_service(set_priority, complaint=self.get_object(), actor=request.user, priority=payload.validated_data["priority"]))

    @extend_schema(request=None, responses=ComplaintSerializer)
    @action(detail=True, methods=("post",))
    def investigate(self, request, pk=None):
        return self._respond(call_validated_service(start_investigation, complaint=self.get_object(), actor=request.user))

    @extend_schema(request=TextSerializer, responses=ComplaintSerializer)
    @action(detail=True, methods=("post",))
    def resolve(self, request, pk=None):
        payload = TextSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self._respond(call_validated_service(resolve_complaint, complaint=self.get_object(), actor=request.user, resolution=payload.validated_data["text"]))

    @extend_schema(request=TextSerializer, responses=ComplaintSerializer)
    @action(detail=True, methods=("post",))
    def reopen(self, request, pk=None):
        payload = TextSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self._respond(call_validated_service(reopen_complaint, complaint=self.get_object(), actor=request.user, reason=payload.validated_data["text"]))

    @extend_schema(request=None, responses=ComplaintSerializer)
    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        return self._respond(call_validated_service(close_complaint, complaint=self.get_object(), actor=request.user))

    @extend_schema(request=TextSerializer, responses=ComplaintSerializer)
    @action(detail=True, methods=("post",))
    def withdraw(self, request, pk=None):
        payload = TextSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self._respond(call_validated_service(withdraw_complaint, complaint=self.get_object(), actor=request.user, reason=payload.validated_data["text"]))

    @extend_schema(request=NoteInputSerializer, responses=ComplaintSerializer)
    @action(detail=True, methods=("post",))
    def notes(self, request, pk=None):
        payload = NoteInputSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        complaint = self.get_object()
        call_validated_service(add_note, complaint=complaint, actor=request.user, body=payload.validated_data["body"], internal=payload.validated_data["is_internal"])
        return self._respond(complaint)

    @extend_schema(request={"multipart/form-data": AttachmentUploadSerializer}, responses=ComplaintSerializer)
    @action(detail=True, methods=("post",), parser_classes=(MultiPartParser, FormParser))
    def attachments(self, request, pk=None):
        payload = AttachmentUploadSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        complaint = self.get_object()
        call_validated_service(add_attachment, complaint=complaint, actor=request.user, uploaded_file=payload.validated_data["file"], internal=payload.validated_data["is_internal"])
        return self._respond(complaint)

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    @action(detail=True, methods=("get",), url_path=r"attachments/(?P<attachment_id>[0-9a-f-]+)/download")
    def download_attachment(self, request, pk=None, attachment_id=None):
        complaint = self.get_object()  # Applies complaint visibility first.
        attachment = get_object_or_404(ComplaintAttachment, pk=attachment_id, complaint=complaint)
        is_staff = bool(permission_codes(request) & STAFF) and complaint.complainant.user_id != request.user.id
        if attachment.is_internal and not is_staff:
            raise NotFound("File not found.")
        response = FileResponse(attachment.stored_file.open("rb"), as_attachment=True, filename=attachment.original_filename, content_type=attachment.content_type or "application/octet-stream")
        response["X-Content-Type-Options"] = "nosniff"
        return response

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=("get",))
    def overview(self, request):
        return Response(complaint_overview(self.get_queryset().exclude(complainant__user=request.user)))

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=("get",))
    def colleagues(self, request):
        """Name search for "who is this about": name, staff number and department only, at most 20."""
        query = (request.query_params.get("search") or "").strip()
        if len(query) < 2:
            return Response([])
        employees = (
            Employee.objects.for_institution(request.institution)
            .filter(status__in=(Employee.Status.ACTIVE, Employee.Status.SUSPENDED))
            .exclude(user=request.user)
            .filter(Q(first_name__icontains=query) | Q(last_name__icontains=query) | Q(employee_number__icontains=query))
            .order_by("last_name", "first_name")[:20]
        )
        departments = dict(Employment.objects.filter(employee__in=employees, is_current=True).values_list("employee_id", "department__name"))
        return Response([{"id": str(item.id), "name": item.full_name, "employee_number": item.employee_number, "department": departments.get(item.id) or ""} for item in employees])

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=("get",))
    def handlers(self, request):
        """Members who can be assigned complaints."""
        return Response([{"id": str(user.id), "name": user.get_full_name() or user.email, "email": user.email} for user in handlers(request.institution)])
