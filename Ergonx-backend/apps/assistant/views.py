from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.assistant import services
from apps.assistant.models import AssistantConversation, AssistantMessage
from common.permissions import TenantContextPermission, TenantRBACPermission
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet

# Everyone signed in may use the assistant once their organisation enables it;
# each tool then checks the person's own permissions.
PERMISSION = "home.view"


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantMessage
        fields = ("id", "role", "text", "tools_used", "created_at")


class ConversationSerializer(serializers.ModelSerializer):
    messages = serializers.SerializerMethodField()

    class Meta:
        model = AssistantConversation
        fields = ("id", "title", "created_at", "updated_at", "messages")

    def get_messages(self, obj):
        if not self.context.get("with_messages"):
            return None
        return MessageSerializer(obj.messages.order_by("created_at"), many=True).data


class AskSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=4000)


class AssistantStatusView(APIView):
    permission_classes = [TenantContextPermission, TenantRBACPermission]

    def get_required_permission(self):
        return PERMISSION

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        return Response(services.status(request.user, request.institution))


class AssistantConversationViewSet(TenantModelViewSet):
    """A person's own conversations; nobody else, administrators included, can read them."""

    model = AssistantConversation
    serializer_class = ConversationSerializer
    required_permission = PERMISSION
    http_method_names = ("get", "post", "delete", "head", "options")
    read_only_roles_may_write = True

    def get_queryset(self):
        return super().get_queryset().filter(user=self.request.user)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "with_messages": self.action == "retrieve"}

    def create(self, request, *args, **kwargs):
        """Start a conversation with its first question."""
        text = AskSerializer(data=request.data)
        text.is_valid(raise_exception=True)
        call_validated_service(services.ensure_available, user=request.user, institution=request.institution)
        conversation = AssistantConversation.objects.create(institution=request.institution, user=request.user)
        try:
            call_validated_service(services.ask, request=request, conversation=conversation, question=text.validated_data["text"])
        except Exception:
            conversation.delete()
            raise
        return Response(ConversationSerializer(conversation, context={"with_messages": True}).data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        instance.delete()

    @extend_schema(request=AskSerializer, responses={201: MessageSerializer})
    @action(detail=True, methods=("post",))
    def ask(self, request, pk=None):
        text = AskSerializer(data=request.data)
        text.is_valid(raise_exception=True)
        answer = call_validated_service(services.ask, request=request, conversation=self.get_object(), question=text.validated_data["text"])
        return Response(MessageSerializer(answer).data, status=status.HTTP_201_CREATED)
