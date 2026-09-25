from django_filters.rest_framework import DjangoFilterBackend
from django.http import FileResponse
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.documents.models import Document, ImageAsset
from apps.documents.serializers import DocumentSerializer, ImageAssetSerializer
from apps.employees.models import Employee
from common.viewsets import TenantModelViewSet


class DocumentViewSet(TenantModelViewSet):
    model = Document
    serializer_class = DocumentSerializer
    permission_resource = "document"
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ("category", "classification", "entity_type", "entity_id", "is_active")
    search_fields = ("original_filename", "category", "entity_type")

    @property
    def required_module(self):
        category = self.request.data.get("category")
        if not category and self.kwargs.get("pk"):
            category = Document.objects.filter(id=self.kwargs["pk"], institution=self.request.institution).values_list("category", flat=True).first()
        return "LEAVE" if category == "LEAVE_SUPPORTING" else None

    def get_required_permission(self):
        # Employee self-service may upload only a supporting document for its
        # own leave workflow; all other document creation remains governed by
        # the institution's document.create permission.
        category = self.request.data.get("category")
        if self.kwargs.get("pk") and not category:
            category = Document.objects.filter(id=self.kwargs["pk"], institution=self.request.institution).values_list("category", flat=True).first()
        if category == "LEAVE_SUPPORTING":
            if self.action in ("create", "retrieve", "download"):
                return "leave.request" if self.action == "create" else "leave.view"
        return super().get_required_permission()

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, uploaded_by=self.request.user)

    @action(detail=True, methods=("get",), url_path="download")
    def download(self, request, pk=None):
        document = self.get_object()
        if not document.stored_file:
            raise NotFound("This document has no managed file content.")
        response = FileResponse(document.stored_file.open("rb"), content_type=document.content_type)
        response["Content-Disposition"] = f'attachment; filename="{document.original_filename}"'
        return response


class ImageAssetViewSet(TenantModelViewSet):
    model = ImageAsset
    serializer_class = ImageAssetSerializer
    permission_resource = "image"
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ("owner_type", "owner_id")
    http_method_names = ("get", "post", "delete", "head", "options")

    def get_queryset(self):
        return super().get_queryset().filter(is_active=True)

    @property
    def required_module(self):
        owner_type = self.request.data.get("owner_type")
        if not owner_type and self.kwargs.get("pk"):
            owner_type = ImageAsset.objects.filter(id=self.kwargs["pk"], institution=self.request.institution).values_list("owner_type", flat=True).first()
        return "CORE_HR" if owner_type == ImageAsset.OwnerType.EMPLOYEE else None

    def get_required_permission(self):
        owner_type = self.request.data.get("owner_type")
        owner_id = str(self.request.data.get("owner_id") or "")
        if self.kwargs.get("pk") and not owner_type:
            asset = ImageAsset.objects.filter(id=self.kwargs["pk"], institution=self.request.institution).values("owner_type", "owner_id").first()
            if asset:
                owner_type = asset["owner_type"]
                owner_id = str(asset["owner_id"])
        if owner_type == ImageAsset.OwnerType.USER and owner_id == str(self.request.user.id):
            return "home.view"
        if owner_type == ImageAsset.OwnerType.EMPLOYEE and Employee.objects.for_institution(self.request.institution).filter(id=owner_id, user=self.request.user).exists():
            return "home.view"
        if owner_type == ImageAsset.OwnerType.INSTITUTION and owner_id == str(self.request.institution.id):
            # Every member sees the institution logo in the shell and on
            # documents; only institution managers may replace or remove it.
            if self.action in ("retrieve", "content"):
                return "home.view"
            return "settings.institution.manage"
        return "employee.update"

    def perform_create(self, serializer):
        values = serializer.validated_data
        owner_type = values["owner_type"]
        owner_id = values["owner_id"]
        if owner_type == ImageAsset.OwnerType.USER and owner_id != self.request.user.id:
            raise PermissionDenied("A user image may only be managed for the signed-in account.")
        if owner_type == ImageAsset.OwnerType.INSTITUTION and owner_id != self.request.institution.id:
            raise PermissionDenied("The institution image must belong to the active institution.")
        if owner_type == ImageAsset.OwnerType.EMPLOYEE:
            employee = Employee.objects.for_institution(self.request.institution).filter(id=owner_id).first()
            if employee is None:
                raise NotFound("Employee image target was not found.")
        ImageAsset.objects.filter(institution=self.request.institution, owner_type=owner_type, owner_id=owner_id, is_active=True).update(is_active=False)
        serializer.save(institution=self.request.institution)

    @action(detail=True, methods=("get",), url_path="content")
    def content(self, request, pk=None):
        image = self.get_object()
        response = FileResponse(image.stored_file.open("rb"), content_type=image.content_type)
        response["Cache-Control"] = "private, no-store"
        return response

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=("is_active", "updated_at"))

