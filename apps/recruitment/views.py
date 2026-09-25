from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.recruitment.models import Application, ApplicationStageHistory, Candidate, CandidateEvaluation, Interview, JobPosting, Offer, RecruitmentStage
from apps.recruitment.selectors import applications_for_institution, candidate_scorecard, recruitment_pipeline
from apps.recruitment.serializers import (ApplicationSerializer, ApplicationStageHistorySerializer, CandidateEvaluationSerializer, CandidateSerializer, CommentSerializer, HireCandidateSerializer, InterviewSerializer, InterviewStatusSerializer, JobPostingSerializer, OfferSerializer, RecruitmentStageSerializer, RejectionSerializer, StageMoveSerializer)
from apps.recruitment.services import (close_job_posting, decide_offer, extend_offer, hire_candidate, move_application_stage, publish_job_posting, reject_application, submit_application, update_interview_status, withdraw_application, withdraw_offer)
from apps.institutions.services import record_user_activity
from apps.documents.models import Document
from apps.documents.serializers import DocumentSerializer
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet


class RecruitmentViewSet(TenantModelViewSet):
    required_module = "RECRUITMENT"


class JobPostingViewSet(RecruitmentViewSet):
    model = JobPosting
    serializer_class = JobPostingSerializer
    permission_resource = "job_posting"
    filterset_fields = ("status", "department", "position", "location", "employment_type")
    search_fields = ("code", "title", "description")
    ordering_fields = ("code", "title", "opens_on", "closes_on", "created_at", "updated_at")

    @extend_schema(operation_id="recruitment_job_posting_publish")
    @action(detail=True, methods=("post",))
    def publish(self, request, pk=None):
        return Response(self.get_serializer(call_validated_service(publish_job_posting, job_posting=self.get_object(), actor=request.user)).data)

    @action(detail=True, methods=("post",))
    def close(self, request, pk=None):
        return Response(self.get_serializer(call_validated_service(close_job_posting, job_posting=self.get_object(), actor=request.user)).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        return Response(self.get_serializer(call_validated_service(close_job_posting, job_posting=self.get_object(), actor=request.user, cancelled=True)).data)

    def get_required_permission(self):
        if self.action in {"publish", "close", "cancel"}:
            return "job_posting.update"
        return super().get_required_permission()


class CandidateViewSet(RecruitmentViewSet):
    model = Candidate
    serializer_class = CandidateSerializer
    permission_resource = "candidate"
    filterset_fields = ("status", "source")
    search_fields = ("first_name", "middle_name", "last_name", "email", "phone")
    ordering_fields = ("first_name", "last_name", "email", "created_at", "updated_at")

    def perform_create(self, serializer):
        candidate = serializer.save(institution=self.request.institution)
        record_user_activity(
            actor=self.request.user,
            institution=self.request.institution,
            activity_code="candidate.create",
            entity=candidate,
        )

    @action(detail=True, methods=("get",), url_path="scorecard")
    def scorecard(self, request, pk=None):
        candidate = candidate_scorecard(institution=request.institution, candidate=self.get_object())
        return Response({"candidate_id": candidate.id, "average_score": candidate.average_score, "application_count": candidate.application_count})

    @action(detail=True, methods=("get",))
    def documents(self, request, pk=None):
        candidate = self.get_object()
        documents = Document.objects.for_institution(request.institution).filter(
            entity_type="recruitment.Candidate", entity_id=candidate.id, is_active=True
        )
        return Response(DocumentSerializer(documents, many=True, context={"request": request}).data)

    def get_required_permission(self):
        if self.action == "documents":
            return "document.view"
        return super().get_required_permission()


class RecruitmentStageViewSet(RecruitmentViewSet):
    model = RecruitmentStage
    serializer_class = RecruitmentStageSerializer
    filterset_fields = ("is_active", "is_terminal")
    search_fields = ("name",)
    ordering_fields = ("sequence", "name", "created_at", "updated_at")

    def get_required_permission(self):
        return "recruitment_stage.view" if self.action in {"list", "retrieve"} else "recruitment_stage.manage"


class ApplicationViewSet(RecruitmentViewSet):
    model = Application
    serializer_class = ApplicationSerializer
    http_method_names = ("get", "post", "put", "patch", "head", "options")
    filterset_fields = ("job_posting", "candidate", "current_stage", "status")
    search_fields = ("candidate__first_name", "candidate__last_name", "candidate__email", "job_posting__code", "job_posting__title")
    ordering_fields = ("applied_at", "created_at", "updated_at")

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Application.objects.none()
        return applications_for_institution(institution=self.request.institution)

    def get_required_permission(self):
        return {"create": "candidate.create", "submit": "candidate.create", "move_stage": "candidate.update", "withdraw": "candidate.update", "reject": "candidate.update", "stage_history": "candidate.view"}.get(self.action, "candidate.view")

    @action(detail=True, methods=("post",))
    def submit(self, request, pk=None):
        return Response(self.get_serializer(call_validated_service(submit_application, application=self.get_object(), actor=request.user)).data)

    @action(detail=True, methods=("post",), url_path="move-stage")
    def move_stage(self, request, pk=None):
        payload = StageMoveSerializer(data=request.data); payload.is_valid(raise_exception=True)
        stage = RecruitmentStage.objects.for_institution(request.institution).get(pk=payload.validated_data["stage"])
        return Response(self.get_serializer(call_validated_service(move_application_stage, application=self.get_object(), stage=stage, actor=request.user, comment=payload.validated_data.get("comment", ""))).data)

    @action(detail=True, methods=("post",))
    def withdraw(self, request, pk=None):
        return Response(self.get_serializer(call_validated_service(withdraw_application, application=self.get_object(), actor=request.user)).data)

    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        payload = RejectionSerializer(data=request.data); payload.is_valid(raise_exception=True)
        return Response(self.get_serializer(call_validated_service(reject_application, application=self.get_object(), actor=request.user, reason=payload.validated_data.get("reason", ""))).data)

    @action(detail=True, methods=("get",), url_path="stage-history")
    def stage_history(self, request, pk=None):
        history = ApplicationStageHistory.objects.for_institution(request.institution).filter(application=self.get_object()).select_related("from_stage", "to_stage", "changed_by")
        return Response(ApplicationStageHistorySerializer(history, many=True).data)

    @action(detail=False, methods=("get",))
    def pipeline(self, request):
        return Response(recruitment_pipeline(institution=request.institution))


class InterviewViewSet(RecruitmentViewSet):
    model = Interview
    serializer_class = InterviewSerializer
    permission_resource = "interview"
    filterset_fields = ("application", "interviewer", "status", "scheduled_at")
    search_fields = ("application__candidate__first_name", "application__candidate__last_name", "interview_type")
    ordering_fields = ("scheduled_at", "created_at", "updated_at")

    def get_queryset(self):
        return super().get_queryset().select_related("application__candidate", "interviewer")

    @action(detail=True, methods=("post",), url_path="set-status")
    def set_status(self, request, pk=None):
        payload = InterviewStatusSerializer(data=request.data); payload.is_valid(raise_exception=True)
        interview = call_validated_service(update_interview_status, interview=self.get_object(), actor=request.user, status=payload.validated_data["status"])
        return Response(self.get_serializer(interview).data)

    def get_required_permission(self):
        if self.action == "set_status":
            return "interview.manage"
        return super().get_required_permission()


class CandidateEvaluationViewSet(RecruitmentViewSet):
    model = CandidateEvaluation
    serializer_class = CandidateEvaluationSerializer
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("application", "interviewer", "recommendation")
    ordering_fields = ("score", "created_at")

    def get_required_permission(self):
        return "candidate_evaluation.create" if self.action == "create" else "interview.view"


class OfferViewSet(RecruitmentViewSet):
    model = Offer
    serializer_class = OfferSerializer
    permission_resource = "offer"
    filterset_fields = ("application", "status", "department", "position", "proposed_start_date")
    search_fields = ("application__candidate__first_name", "application__candidate__last_name", "application__job_posting__title")
    ordering_fields = ("proposed_start_date", "created_at", "updated_at")

    def get_queryset(self):
        return super().get_queryset().select_related("application__candidate", "application__job_posting", "department", "position", "grade", "location", "salary_structure", "hired_employee")

    def get_required_permission(self):
        return {"extend": "offer.create", "accept": "offer.manage", "decline": "offer.manage", "withdraw": "offer.manage", "hire": "offer.manage"}.get(self.action, super().get_required_permission())

    @action(detail=True, methods=("post",))
    def extend(self, request, pk=None):
        return Response(self.get_serializer(call_validated_service(extend_offer, offer=self.get_object(), actor=request.user)).data)

    @action(detail=True, methods=("post",))
    def accept(self, request, pk=None):
        return Response(self.get_serializer(call_validated_service(decide_offer, offer=self.get_object(), actor=request.user, accepted=True)).data)

    @action(detail=True, methods=("post",))
    def decline(self, request, pk=None):
        return Response(self.get_serializer(call_validated_service(decide_offer, offer=self.get_object(), actor=request.user, accepted=False)).data)

    @action(detail=True, methods=("post",))
    def withdraw(self, request, pk=None):
        return Response(self.get_serializer(call_validated_service(withdraw_offer, offer=self.get_object(), actor=request.user)).data)

    @action(detail=True, methods=("post",))
    def hire(self, request, pk=None):
        payload = HireCandidateSerializer(data=request.data); payload.is_valid(raise_exception=True)
        employee = call_validated_service(hire_candidate, offer=self.get_object(), actor=request.user, employee_number=payload.validated_data["employee_number"])
        return Response({"employee_id": employee.id, "employee_number": employee.employee_number})
