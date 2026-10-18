from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.performance.goal_views import GoalViewSet
from apps.performance.talent_views import SuccessionPlanViewSet, TalentGridView
from apps.performance.views import CompetencyViewSet, FeedbackRequestViewSet, PerformanceReviewViewSet, ReviewCycleViewSet

router = DefaultRouter()
router.register("performance-competencies", CompetencyViewSet, basename="performance-competency")
router.register("succession-plans", SuccessionPlanViewSet, basename="succession-plan")
router.register("goals", GoalViewSet, basename="goal")
router.register("feedback-requests", FeedbackRequestViewSet, basename="feedback-request")
router.register("review-cycles", ReviewCycleViewSet, basename="review-cycle")
router.register("performance-reviews", PerformanceReviewViewSet, basename="performance-review")
urlpatterns = [path("talent-grid/", TalentGridView.as_view(), name="talent-grid"), *router.urls]
