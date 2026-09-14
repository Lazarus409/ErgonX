from rest_framework.routers import DefaultRouter

from apps.workflows.views import ApprovalActionViewSet, ApprovalRequestViewSet, WorkflowDefinitionViewSet, WorkflowStepViewSet

router = DefaultRouter()
router.register("approval-workflows", WorkflowDefinitionViewSet, basename="approval-workflow")
router.register("approval-workflow-steps", WorkflowStepViewSet, basename="approval-workflow-step")
router.register("approval-requests", ApprovalRequestViewSet, basename="approval-request")
router.register("approval-actions", ApprovalActionViewSet, basename="approval-action")
urlpatterns = router.urls
