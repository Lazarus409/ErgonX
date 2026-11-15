from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.assistant.views import AssistantConversationViewSet, AssistantStatusView

router = DefaultRouter()
router.register("assistant/conversations", AssistantConversationViewSet, basename="assistant-conversation")

urlpatterns = [path("assistant/status/", AssistantStatusView.as_view(), name="assistant-status"), *router.urls]
