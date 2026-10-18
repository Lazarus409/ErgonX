from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.recruitment.careers_views import (
    CareersApplyView,
    CareersJobView,
    CareersSiteSettingsView,
    CareersSiteView,
    TrackingDocumentsView,
    TrackingInterviewView,
    TrackingOfferView,
    TrackingView,
    TrackingWithdrawView,
)

from apps.recruitment.views import ApplicationViewSet, CandidateEvaluationViewSet, CandidateViewSet, InterviewViewSet, JobPostingViewSet, OfferViewSet, RecruitmentStageViewSet

router = DefaultRouter()
router.register("recruitment/job-postings", JobPostingViewSet, basename="recruitment-job-posting")
router.register("recruitment/candidates", CandidateViewSet, basename="recruitment-candidate")
router.register("recruitment/stages", RecruitmentStageViewSet, basename="recruitment-stage")
router.register("recruitment/applications", ApplicationViewSet, basename="recruitment-application")
router.register("recruitment/interviews", InterviewViewSet, basename="recruitment-interview")
router.register("recruitment/evaluations", CandidateEvaluationViewSet, basename="recruitment-evaluation")
router.register("recruitment/offers", OfferViewSet, basename="recruitment-offer")

urlpatterns = [
    path("recruitment/careers-site/", CareersSiteSettingsView.as_view(), name="careers-site-settings"),
    # Public, no sign-in.
    path("public/careers/track/<str:token>/", TrackingView.as_view(), name="careers-track"),
    path("public/careers/track/<str:token>/documents/", TrackingDocumentsView.as_view(), name="careers-track-documents"),
    path("public/careers/track/<str:token>/withdraw/", TrackingWithdrawView.as_view(), name="careers-track-withdraw"),
    path("public/careers/track/<str:token>/offer/", TrackingOfferView.as_view(), name="careers-track-offer"),
    path("public/careers/track/<str:token>/interviews/<uuid:interview_id>/", TrackingInterviewView.as_view(), name="careers-track-interview"),
    path("public/careers/<slug:slug>/", CareersSiteView.as_view(), name="careers-site"),
    path("public/careers/<slug:slug>/jobs/<uuid:job_id>/", CareersJobView.as_view(), name="careers-job"),
    path("public/careers/<slug:slug>/jobs/<uuid:job_id>/apply/", CareersApplyView.as_view(), name="careers-apply"),
    *router.urls,
]
