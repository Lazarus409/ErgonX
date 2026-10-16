from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.http import FileResponse
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import field_changes, record_audit_event, snapshot
from apps.documents.checklist import checklists, compliance_overview, summarize
from apps.documents import policies as policy_service
from apps.documents.models import POLICY_ENTITY_TYPE, Document, DocumentRequirement, DocumentRequirementWaiver, ImageAsset, Policy
from apps.documents.serializers import DocumentRequirementSerializer, DocumentRequirementWaiverSerializer, DocumentSerializer, ImageAssetSerializer, PolicyAcknowledgementSerializer, PolicyAcknowledgeSerializer, PolicyFileSerializer, PolicyNewVersionSerializer, PolicySerializer
from apps.employees.models import Employee
from apps.employees.services import ensure_not_self_hr_mutation
from common.permissions import TenantContextPermission, TenantRBACPermission
from common.scoping import LEAVE_BROAD, scope_to_employees
from common.serializers import call_validated_service
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
        if category == "LEAVE_SUPPORTING":
            return "LEAVE"
        return "ACCOUNTING" if category == "EXPENSE_RECEIPT" else None

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
        if category == "EXPENSE_RECEIPT" and self.action in ("create", "retrieve", "download"):
            # Receipts for expense claims (Wave 6): claimants upload their own;
            # finance reads them through expense.view.
            from apps.institutions.services import effective_permission_codes

            held = effective_permission_codes(getattr(self.request, "membership", None))
            return "expense.view" if self.action != "create" and "expense.view" in held else "expense.claim_own"
        if self.action == "download":
            return "document.view"
        return super().get_required_permission()

    def get_queryset(self):
        queryset = super().get_queryset()
        membership = getattr(self.request, "membership", None)
        if membership is not None and membership.role.permissions.filter(code="document.view").exists():
            return queryset
        # Reached through leave permissions only: a supporting document is visible
        # to its uploader and to whoever can see or approve the request it supports.
        from apps.leave.models import LeaveRequest

        visible_requests = scope_to_employees(
            LeaveRequest.objects.for_institution(self.request.institution), self.request, broad=LEAVE_BROAD
        ).values("pk")
        leave_documents = Q(category="LEAVE_SUPPORTING") & (
            Q(uploaded_by=self.request.user)
            | Q(leave_requests__in=visible_requests)
            | Q(leave_requests__approvals__approver=self.request.user)
        )
        # Expense receipts: the uploader, the claimant and the claim's approvers;
        # finance (expense.view) sees every receipt.
        if membership is not None and membership.role.permissions.filter(code="expense.view").exists():
            receipt_documents = Q(category="EXPENSE_RECEIPT")
        else:
            receipt_documents = Q(category="EXPENSE_RECEIPT") & (
                Q(uploaded_by=self.request.user)
                | Q(expense_lines__expense__claimant__user=self.request.user)
                | Q(expense_lines__expense__approvals__approver=self.request.user)
            )
        return queryset.filter(leave_documents | receipt_documents).distinct()

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, uploaded_by=self.request.user)

    @action(detail=True, methods=("get",), url_path="download")
    def download(self, request, pk=None):
        document = self.get_object()
        if not document.stored_file:
            raise NotFound("This document has no managed file content.")
        response = FileResponse(
            document.stored_file.open("rb"),
            as_attachment=True,
            filename=document.original_filename,
            content_type=document.content_type or "application/octet-stream",
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response


class ImageAssetViewSet(TenantModelViewSet):
    model = ImageAsset
    serializer_class = ImageAssetSerializer
    permission_resource = "image"
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ("owner_type", "owner_id")
    http_method_names = ("get", "post", "delete", "head", "options")

    def get_queryset(self):
        # filter_backends omits OrderingFilter, so order explicitly for stable pagination.
        return super().get_queryset().filter(is_active=True).order_by("-created_at", "id")

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


REQUIREMENT_FIELDS = ("name", "description", "document_category", "employment_types", "validity_months", "is_mandatory", "sort_order", "is_active")


class DocumentRequirementViewSet(TenantModelViewSet):
    """Documents HR requires on file, and the organization's compliance with them."""

    model = DocumentRequirement
    serializer_class = DocumentRequirementSerializer
    http_method_names = ("get", "post", "patch", "delete", "head", "options")
    filterset_fields = ("is_active", "is_mandatory")
    search_fields = ("name", "document_category")
    ordering_fields = ("sort_order", "name", "created_at")
    ordering = ("sort_order", "name")

    def get_required_permission(self):
        return "document_requirement.view" if self.action in ("list", "retrieve", "compliance") else "document_requirement.manage"

    def perform_create(self, serializer):
        requirement = serializer.save(institution=self.request.institution)
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=requirement, action="document_requirement.created", metadata={"name": requirement.name})

    def perform_update(self, serializer):
        before = snapshot(serializer.instance, REQUIREMENT_FIELDS)
        requirement = serializer.save()
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=requirement, action="document_requirement.updated", metadata={"changes": field_changes(before, snapshot(requirement, REQUIREMENT_FIELDS))})

    def perform_destroy(self, instance):
        super().perform_destroy(instance)  # Deactivates: history and waivers are kept.
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=instance, action="document_requirement.deactivated", metadata={"name": instance.name})

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=("get",), url_path="compliance")
    def compliance(self, request):
        employees = scope_to_employees(Employee.objects.for_institution(request.institution), request, "")
        department = request.query_params.get("department")
        if department:
            employees = employees.filter(employments__is_current=True, employments__department_id=department).distinct()
        return Response(compliance_overview(request.institution, employees))


class DocumentRequirementWaiverViewSet(TenantModelViewSet):
    model = DocumentRequirementWaiver
    serializer_class = DocumentRequirementWaiverSerializer
    http_method_names = ("get", "post", "delete", "head", "options")
    filterset_fields = ("employee", "requirement")

    def get_required_permission(self):
        return "document_requirement.view" if self.action in ("list", "retrieve") else "document_requirement.manage"

    def get_queryset(self):
        return scope_to_employees(super().get_queryset().select_related("requirement", "employee", "waived_by"), self.request)

    def perform_create(self, serializer):
        employee = serializer.validated_data["employee"]
        if not scope_to_employees(Employee.objects.for_institution(self.request.institution), self.request, "").filter(pk=employee.pk).exists():
            raise NotFound("Employee not found.")
        call_validated_service(ensure_not_self_hr_mutation, actor=self.request.user, employee=employee)
        waiver = serializer.save(institution=self.request.institution, waived_by=self.request.user)
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=waiver, action="document_requirement.waived", metadata={"requirement": waiver.requirement.name, "employee_id": str(employee.id), "reason": waiver.reason})

    def perform_destroy(self, instance):
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=instance, action="document_requirement.waiver_removed", metadata={"requirement": instance.requirement.name, "employee_id": str(instance.employee_id)})
        instance.delete()


def _checklist_payload(institution, employee):
    items = checklists(institution, [employee])[employee.id]
    return {"employee_id": str(employee.id), "employee": employee.full_name, "summary": summarize(items), "items": items}


class EmployeeDocumentChecklistView(APIView):
    """One employee's document checklist, for HR and the employee's managers."""

    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "CORE_HR"

    def get_required_permission(self):
        return "document_requirement.view"

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request, pk):
        employee = get_object_or_404(scope_to_employees(Employee.objects.for_institution(request.institution), request, ""), pk=pk)
        return Response(_checklist_payload(request.institution, employee))


class SelfServiceDocumentChecklistView(APIView):
    """The signed-in employee's own document checklist."""

    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "CORE_HR"

    def get_required_permission(self):
        return "home.view"

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        employee = get_object_or_404(Employee.objects.for_institution(request.institution), user=request.user)
        return Response(_checklist_payload(request.institution, employee))


# ---------------------------------------------------------------- policies


def _file_response(document):
    if document is None or not document.stored_file:
        raise NotFound("This policy has no attached document.")
    response = FileResponse(document.stored_file.open("rb"), as_attachment=True, filename=document.original_filename, content_type=document.content_type or "application/octet-stream")
    response["X-Content-Type-Options"] = "nosniff"
    return response


def _store_policy_file(request, policy):
    """Saves an uploaded policy document; earlier versions' files are kept for the record."""
    uploaded = request.FILES.get("uploaded_file")
    if uploaded is None:
        return None
    serializer = DocumentSerializer(data={"uploaded_file": uploaded, "category": "Policy", "classification": Document.Classification.INTERNAL})
    serializer.is_valid(raise_exception=True)
    return serializer.save(institution=request.institution, uploaded_by=request.user, entity_type=POLICY_ENTITY_TYPE, entity_id=policy.id)


def _policy_row(policy, status, due_date, acknowledgement, *, with_body=False):
    row = {
        "id": str(policy.id), "title": policy.title, "category": policy.category, "category_label": policy.get_category_display(),
        "summary": policy.summary, "version": policy.version, "published_at": policy.published_at, "change_summary": policy.change_summary,
        "requires_acknowledgement": policy.requires_acknowledgement,
        "document": PolicyFileSerializer(policy.document).data if policy.document_id else None,
        "status": status, "due_date": due_date,
        "acknowledgement": PolicyAcknowledgementSerializer(acknowledgement).data if acknowledgement else None,
    }
    if with_body:
        row["body"] = policy.body
    return row


class PolicyViewSet(TenantModelViewSet):
    """Workplace policies HR publishes for employees to read and acknowledge."""

    model = Policy
    serializer_class = PolicySerializer
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    http_method_names = ("get", "post", "patch", "delete", "head", "options")
    filterset_fields = ("status", "category")
    search_fields = ("title", "summary")
    ordering_fields = ("title", "published_at", "created_at")
    ordering = ("title",)

    def get_required_permission(self):
        if self.action == "file" and self.request.method == "POST":
            return "policy.manage"
        return "policy.view" if self.action in ("list", "retrieve", "acknowledgements", "file") else "policy.manage"

    def get_queryset(self):
        return super().get_queryset().select_related("document", "published_by")

    def _summaries(self, policies):
        employees = list(scope_to_employees(policy_service.active_employees(self.request.institution), self.request, ""))
        return {
            policy.id: policy_service.summarize([row["status"] for row in policy_service.policy_compliance(self.request.institution, policy, employees)])
            for policy in policies if policy.status == Policy.Status.PUBLISHED
        }

    def _context(self, policies):
        return {**self.get_serializer_context(), "acknowledgement_summaries": self._summaries(policies)}

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        rows = page if page is not None else list(queryset)
        serializer = PolicySerializer(rows, many=True, context=self._context(rows))
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        policy = self.get_object()
        return Response(PolicySerializer(policy, context=self._context([policy])).data)

    def perform_create(self, serializer):
        policy = serializer.save(institution=self.request.institution)
        document = _store_policy_file(self.request, policy)
        if document is not None:
            policy.document = document
            policy.save(update_fields=("document", "updated_at"))
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=policy, action="policy.created", metadata={"title": policy.title})

    def perform_update(self, serializer):
        if "uploaded_file" in self.request.FILES and serializer.instance.status != Policy.Status.DRAFT:
            raise ValidationError({"uploaded_file": "A published policy can't be edited. Publish a new version instead."})
        policy = serializer.save()
        document = _store_policy_file(self.request, policy)
        if document is not None:
            policy.document = document
            policy.save(update_fields=("document", "updated_at"))
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=policy, action="policy.updated", metadata={"title": policy.title})

    def perform_destroy(self, instance):
        if instance.status != Policy.Status.DRAFT:
            raise ValidationError({"status": "Only drafts can be deleted. Retire a published policy instead."})
        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=instance, action="policy.deleted", metadata={"title": instance.title})
        instance.delete()

    def _respond(self, policy):
        policy = self.get_queryset().get(pk=policy.pk)
        return Response(PolicySerializer(policy, context=self._context([policy])).data)

    @extend_schema(request=None, responses=PolicySerializer)
    @action(detail=True, methods=("post",))
    def publish(self, request, pk=None):
        return self._respond(call_validated_service(policy_service.publish_policy, institution=request.institution, policy=self.get_object(), actor=request.user))

    @extend_schema(request=PolicyNewVersionSerializer, responses=PolicySerializer)
    @action(detail=True, methods=("post",), url_path="new-version")
    def new_version(self, request, pk=None):
        policy = self.get_object()
        payload = PolicyNewVersionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        content = dict(payload.validated_data)
        change_summary = content.pop("change_summary")
        if policy.status != Policy.Status.PUBLISHED:
            raise ValidationError({"status": "Only a published policy can get a new version."})
        document = _store_policy_file(request, policy)
        if document is not None:
            content["document"] = document
        policy = call_validated_service(policy_service.publish_new_version, institution=request.institution, policy=policy, actor=request.user, change_summary=change_summary, **content)
        return self._respond(policy)

    @extend_schema(request=None, responses=PolicySerializer)
    @action(detail=True, methods=("post",))
    def retire(self, request, pk=None):
        return self._respond(call_validated_service(policy_service.retire_policy, institution=request.institution, policy=self.get_object(), actor=request.user))

    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    @action(detail=True, methods=("get", "post"))
    def file(self, request, pk=None):
        """GET downloads the policy document; POST (multipart ``uploaded_file``) replaces it on a draft."""
        policy = self.get_object()
        if request.method == "GET":
            return _file_response(policy.document)
        if policy.status != Policy.Status.DRAFT:
            raise ValidationError({"uploaded_file": "A published policy can't be edited. Publish a new version instead."})
        document = _store_policy_file(request, policy)
        if document is None:
            raise ValidationError({"uploaded_file": "Choose a file to upload."})
        policy.document = document
        policy.save(update_fields=("document", "updated_at"))
        record_audit_event(actor=request.user, institution=request.institution, entity=policy, action="policy.updated", metadata={"title": policy.title, "file": document.original_filename})
        return self._respond(policy)

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=("get",))
    def acknowledgements(self, request, pk=None):
        """Who has and has not acknowledged the current version, within the caller's employee scope."""
        policy = self.get_object()
        employees = scope_to_employees(policy_service.active_employees(request.institution), request, "").order_by("first_name", "last_name")
        rows = policy_service.policy_compliance(request.institution, policy, employees)
        return Response({
            "policy_id": str(policy.id), "version": policy.version,
            "summary": policy_service.summarize([row["status"] for row in rows]),
            "employees": [
                {
                    "employee_id": str(row["employee"].id), "employee": row["employee"].full_name, "employee_number": row["employee"].employee_number,
                    "status": row["status"], "due_date": row["due_date"],
                    "acknowledgement": PolicyAcknowledgementSerializer(row["acknowledgement"]).data if row["acknowledgement"] else None,
                }
                for row in rows
            ],
        })


class SelfServicePolicyBaseView(APIView):
    permission_classes = (TenantContextPermission, TenantRBACPermission)
    required_module = "CORE_HR"

    def get_required_permission(self):
        return "home.view"

    def employee(self, request):
        return get_object_or_404(Employee.objects.for_institution(request.institution), user=request.user)

    def policy_row(self, request, pk):
        employee = self.employee(request)
        for policy, status, due_date, acknowledgement in policy_service.policies_for_employee(request.institution, employee):
            if str(policy.id) == str(pk):
                return employee, policy, status, due_date, acknowledgement
        raise NotFound("Policy not found.")


class SelfServicePoliciesView(SelfServicePolicyBaseView):
    """The published policies that apply to the signed-in employee, with their acknowledgement status."""

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        employee = self.employee(request)
        rows = policy_service.policies_for_employee(request.institution, employee)
        outstanding = (policy_service.OVERDUE, policy_service.PENDING)
        return Response({
            "summary": policy_service.summarize([status for _, status, _, _ in rows]),
            "policies": [_policy_row(*row) for row in sorted(rows, key=lambda row: (row[1] not in outstanding, row[0].title))],
        })


class SelfServicePolicyDetailView(SelfServicePolicyBaseView):
    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request, pk):
        _, policy, status, due_date, acknowledgement = self.policy_row(request, pk)
        return Response(_policy_row(policy, status, due_date, acknowledgement, with_body=True))


class SelfServicePolicyFileView(SelfServicePolicyBaseView):
    @extend_schema(responses={(200, "application/octet-stream"): OpenApiTypes.BINARY})
    def get(self, request, pk):
        _, policy, _, _, _ = self.policy_row(request, pk)
        return _file_response(policy.document)


class SelfServicePolicyAcknowledgeView(SelfServicePolicyBaseView):
    @extend_schema(request=PolicyAcknowledgeSerializer, responses={200: OpenApiTypes.OBJECT})
    def post(self, request, pk):
        employee, policy, _, _, _ = self.policy_row(request, pk)
        payload = PolicyAcknowledgeSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        call_validated_service(policy_service.acknowledge_policy, institution=request.institution, policy=policy, employee=employee, user=request.user, signed_name=payload.validated_data["signed_name"])
        _, policy, status, due_date, acknowledgement = self.policy_row(request, pk)
        return Response(_policy_row(policy, status, due_date, acknowledgement, with_body=True))
