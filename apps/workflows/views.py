from rest_framework.decorators import action
from rest_framework.response import Response

from apps.workflows.models import ApprovalAction, ApprovalRequest, ApprovalWorkflowDefinition, ApprovalWorkflowStep
from apps.workflows.serializers import ApprovalActionSerializer, ApprovalDecisionSerializer, ApprovalRequestSerializer, ApprovalWorkflowDefinitionSerializer, ApprovalWorkflowStepSerializer
from apps.workflows.services import decide_approval_request, submit_approval_request
from common.viewsets import TenantModelViewSet


class WorkflowDefinitionViewSet(TenantModelViewSet):
    model = ApprovalWorkflowDefinition
    serializer_class = ApprovalWorkflowDefinitionSerializer
    permission_resource = "approval_workflow"


class WorkflowStepViewSet(TenantModelViewSet):
    model = ApprovalWorkflowStep
    serializer_class = ApprovalWorkflowStepSerializer
    permission_resource = "approval_workflow"


class ApprovalRequestViewSet(TenantModelViewSet):
    model = ApprovalRequest
    serializer_class = ApprovalRequestSerializer
    permission_resource = "approval_request"

    def perform_create(self, serializer):
        request = self.request
        instance = submit_approval_request(institution=request.institution, workflow=serializer.validated_data["workflow"], entity_type=serializer.validated_data["entity_type"], entity_id=serializer.validated_data["entity_id"], requested_by=request.user, metadata=serializer.validated_data.get("metadata"))
        serializer.instance = instance

    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return self._decide(request, ApprovalAction.Action.APPROVE)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return self._decide(request, ApprovalAction.Action.REJECT)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        return self._decide(request, ApprovalAction.Action.CANCEL)

    def _decide(self, request, action):
        serializer = ApprovalDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = self.get_object()
        result = decide_approval_request(request=item, actor=request.user, action=action, comments=serializer.validated_data.get("comments", ""))
        return Response(self.get_serializer(result).data)


class ApprovalActionViewSet(TenantModelViewSet):
    model = ApprovalAction
    serializer_class = ApprovalActionSerializer
    permission_resource = "approval_request"
    http_method_names = ("get", "head", "options")
