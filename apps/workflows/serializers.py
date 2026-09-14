from rest_framework import serializers

from apps.workflows.models import ApprovalAction, ApprovalRequest, ApprovalWorkflowDefinition, ApprovalWorkflowStep


class ApprovalWorkflowDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalWorkflowDefinition
        fields = ("id", "institution", "code", "name", "workflow_type", "entity_type", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "institution", "created_at", "updated_at")


class ApprovalWorkflowStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalWorkflowStep
        fields = ("id", "institution", "workflow", "order", "name", "approver_role", "approver_user", "due_after_hours", "created_at", "updated_at")
        read_only_fields = ("id", "institution", "created_at", "updated_at")

    def validate(self, attrs):
        institution = self.context["request"].institution
        workflow = attrs.get("workflow", getattr(self.instance, "workflow", None))
        if workflow and workflow.institution_id != institution.id:
            raise serializers.ValidationError({"workflow": "Workflow must belong to the selected institution."})
        return attrs


class ApprovalRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalRequest
        fields = ("id", "institution", "workflow", "entity_type", "entity_id", "requested_by", "current_step", "status", "due_at", "completed_at", "metadata", "created_at", "updated_at")
        read_only_fields = ("id", "institution", "requested_by", "current_step", "status", "due_at", "completed_at", "created_at", "updated_at")


class ApprovalActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalAction
        fields = ("id", "request", "step", "actor", "action", "comments", "acted_at")
        read_only_fields = fields


class ApprovalDecisionSerializer(serializers.Serializer):
    comments = serializers.CharField(required=False, allow_blank=True, max_length=5000)
