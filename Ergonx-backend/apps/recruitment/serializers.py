from rest_framework import serializers

from apps.compensation.models import SalaryStructure
from apps.organization.models import Department, Grade, Location, Position
from apps.recruitment.models import Application, ApplicationStageHistory, Candidate, CandidateEvaluation, Interview, JobPosting, Offer, RecruitmentStage
from apps.recruitment.services import record_evaluation
from common.serializers import ValidatedModelSerializer, call_validated_service


class TenantRelationSerializer(ValidatedModelSerializer):
    tenant_relations = {}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        institution = getattr(self.context.get("request"), "institution", None)
        if institution:
            for name, model in self.tenant_relations.items():
                self.fields[name].queryset = model.objects.for_institution(institution)


class JobPostingSerializer(TenantRelationSerializer):
    tenant_relations = {"department": Department, "position": Position, "location": Location}

    class Meta:
        model = JobPosting
        fields = ("id", "code", "title", "department", "position", "location", "hiring_manager", "description", "employment_type", "openings", "status", "opens_on", "closes_on", "created_at", "updated_at")
        read_only_fields = ("id", "status", "opens_on", "created_at", "updated_at")

    def validate_hiring_manager(self, value):
        institution = self.context["request"].institution
        if value and not value.memberships.filter(institution=institution, status="ACTIVE").exists():
            raise serializers.ValidationError("Hiring manager must be an active institution member.")
        return value


class CandidateSerializer(TenantRelationSerializer):
    class Meta:
        model = Candidate
        fields = ("id", "first_name", "middle_name", "last_name", "email", "phone", "source", "status", "notes", "created_at", "updated_at")
        read_only_fields = ("id", "status", "created_at", "updated_at")


class RecruitmentStageSerializer(TenantRelationSerializer):
    class Meta:
        model = RecruitmentStage
        fields = ("id", "name", "sequence", "is_terminal", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class ApplicationSerializer(TenantRelationSerializer):
    tenant_relations = {"job_posting": JobPosting, "candidate": Candidate, "current_stage": RecruitmentStage}

    class Meta:
        model = Application
        fields = ("id", "job_posting", "candidate", "current_stage", "status", "applied_at", "withdrawn_at", "rejected_at", "rejection_reason", "notes", "created_at", "updated_at")
        read_only_fields = ("id", "current_stage", "status", "applied_at", "withdrawn_at", "rejected_at", "rejection_reason", "created_at", "updated_at")


class ApplicationStageHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationStageHistory
        fields = ("id", "application", "from_stage", "to_stage", "changed_by", "comment", "created_at")
        read_only_fields = fields


class InterviewSerializer(TenantRelationSerializer):
    tenant_relations = {"application": Application}

    class Meta:
        model = Interview
        fields = ("id", "application", "scheduled_at", "duration_minutes", "interview_type", "location_or_link", "interviewer", "status", "notes", "created_at", "updated_at")
        read_only_fields = ("id", "status", "created_at", "updated_at")

    def validate_interviewer(self, value):
        institution = self.context["request"].institution
        if value and not value.memberships.filter(institution=institution, status="ACTIVE").exists():
            raise serializers.ValidationError("Interviewer must be an active institution member.")
        return value


class CandidateEvaluationSerializer(TenantRelationSerializer):
    tenant_relations = {"application": Application, "interview": Interview}
    interviewer = serializers.UUIDField(read_only=True, source="interviewer_id")

    class Meta:
        model = CandidateEvaluation
        fields = ("id", "application", "interviewer", "interview", "score", "recommendation", "comments", "created_at", "updated_at")
        read_only_fields = ("id", "interviewer", "created_at", "updated_at")

    def create(self, validated_data):
        request = self.context["request"]
        return call_validated_service(record_evaluation, institution=request.institution, interviewer=request.user, actor=request.user, **validated_data)


class OfferSerializer(TenantRelationSerializer):
    tenant_relations = {"application": Application, "department": Department, "position": Position, "grade": Grade, "location": Location, "salary_structure": SalaryStructure}

    class Meta:
        model = Offer
        fields = ("id", "application", "status", "proposed_start_date", "expires_on", "employment_type", "department", "position", "grade", "location", "staff_category", "salary_structure", "base_salary", "currency", "extended_at", "accepted_at", "declined_at", "hired_employee", "terms", "created_at", "updated_at")
        read_only_fields = ("id", "status", "extended_at", "accepted_at", "declined_at", "hired_employee", "created_at", "updated_at")


class CommentSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, max_length=4000)


class StageMoveSerializer(CommentSerializer):
    stage = serializers.UUIDField()


class InterviewStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=(Interview.Status.COMPLETED, Interview.Status.CANCELLED, Interview.Status.NO_SHOW))


class RejectionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=4000)


class HireCandidateSerializer(serializers.Serializer):
    # Blank means "generate the next employee number".
    employee_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
