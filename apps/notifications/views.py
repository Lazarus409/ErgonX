from django.utils import timezone
from django.conf import settings
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification, PushSubscription
from apps.notifications.push import push_enabled
from apps.notifications.serializers import NotificationBulkActionSerializer, NotificationPreferencesSerializer, NotificationSerializer
from apps.notifications.services import MODULES, email_modules, institution_allows_email, notification_module, save_email_modules
from common.permissions import TenantContextPermission, TenantRBACPermission


class NotificationPermissionMixin:
    permission_classes = [TenantContextPermission, TenantRBACPermission]
    required_module = None

    def get_required_permission(self):
        return "home.view"


class NotificationListView(NotificationPermissionMixin, ListAPIView):
    serializer_class = NotificationSerializer

    @extend_schema(
        responses=NotificationSerializer(many=True),
        parameters=[
            OpenApiParameter("unread", OpenApiTypes.BOOL),
            OpenApiParameter("archived", OpenApiTypes.BOOL, description="true lists the archive; default lists the inbox."),
            OpenApiParameter("module", OpenApiTypes.STR, enum=MODULES),
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        queryset = Notification.objects.for_institution(self.request.institution).filter(
            user=self.request.user, channel=Notification.Channel.IN_APP
        )
        params = self.request.query_params
        queryset = queryset.filter(archived_at__isnull=params.get("archived") != "true")
        if params.get("unread") == "true":
            queryset = queryset.exclude(status=Notification.Status.READ)
        module = params.get("module")
        if module in MODULES:
            # Categories are derived, so filter in Python over this member's own inbox.
            ids = [item.id for item in queryset.only("id", "notification_type", "metadata") if notification_module(item.notification_type, item.metadata) == module]
            queryset = queryset.filter(id__in=ids)
        return queryset


class NotificationMarkReadView(NotificationPermissionMixin, APIView):
    serializer_class = NotificationSerializer
    @extend_schema(responses={200: NotificationSerializer})
    def post(self, request, notification_id):
        notification = Notification.objects.for_institution(request.institution).filter(
            id=notification_id, user=request.user, channel=Notification.Channel.IN_APP
        ).first()
        if notification is None:
            return Response({"detail": "Notification not found."}, status=404)
        if notification.status != Notification.Status.READ:
            notification.status = Notification.Status.READ
            notification.read_at = timezone.now()
            notification.save(update_fields=("status", "read_at", "updated_at"))
        return Response(NotificationSerializer(notification).data)


class NotificationMarkAllReadView(NotificationPermissionMixin, APIView):
    serializer_class = NotificationSerializer
    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        updated = Notification.objects.for_institution(request.institution).filter(
            user=request.user, channel=Notification.Channel.IN_APP, archived_at__isnull=True,
        ).exclude(status=Notification.Status.READ).update(
            status=Notification.Status.READ, read_at=timezone.now()
        )
        return Response({"updated": updated})


class NotificationBulkActionView(NotificationPermissionMixin, APIView):
    """Mark read, archive or restore several of the caller's own notifications."""

    serializer_class = NotificationBulkActionSerializer

    @extend_schema(request=NotificationBulkActionSerializer, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        payload = NotificationBulkActionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        # Recipient isolation: ids that are not this member's in-app notifications are ignored.
        own = Notification.objects.for_institution(request.institution).filter(
            user=request.user, channel=Notification.Channel.IN_APP, id__in=payload.validated_data["ids"]
        )
        now = timezone.now()
        action = payload.validated_data["action"]
        if action == "mark_read":
            updated = own.exclude(status=Notification.Status.READ).update(status=Notification.Status.READ, read_at=now)
        elif action == "archive":
            updated = own.filter(archived_at__isnull=True).update(archived_at=now)
        else:
            updated = own.filter(archived_at__isnull=False).update(archived_at=None)
        return Response({"action": action, "updated": updated})


class NotificationPreferencesView(NotificationPermissionMixin, APIView):
    """Which modules also reach the member by email. In-app notifications cannot be muted."""

    serializer_class = NotificationPreferencesSerializer

    def _body(self, request, modules):
        available = bool(settings.EMAIL_DELIVERY_ENABLED) and institution_allows_email(request.institution)
        return {"email_modules": modules, "email_available": available}

    @extend_schema(responses=NotificationPreferencesSerializer)
    def get(self, request):
        return Response(self._body(request, email_modules(request.user, request.institution)))

    @extend_schema(request=NotificationPreferencesSerializer, responses=NotificationPreferencesSerializer)
    def put(self, request):
        payload = NotificationPreferencesSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        chosen = save_email_modules(request.user, request.institution, payload.validated_data["email_modules"])
        return Response(self._body(request, chosen))


class PushSubscribeSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=1000)
    keys = serializers.DictField(child=serializers.CharField(max_length=200))

    def validate_endpoint(self, value):
        if not value.startswith("https://"):
            raise serializers.ValidationError("Push endpoints must use HTTPS.")
        return value

    def validate_keys(self, value):
        if not value.get("p256dh") or not value.get("auth"):
            raise serializers.ValidationError("Both p256dh and auth keys are required.")
        return value


class PushUnsubscribeSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=1000)


class PushConfigView(NotificationPermissionMixin, APIView):
    """Whether web push is available, and the public key a browser subscribes with."""

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        enabled = push_enabled()
        return Response({
            "enabled": enabled,
            "public_key": settings.WEB_PUSH_PUBLIC_KEY if enabled else "",
            "devices": PushSubscription.objects.filter(user=request.user).count(),
        })


class PushSubscriptionView(NotificationPermissionMixin, APIView):
    """Turn push on (POST) or off (DELETE) for this browser or phone."""

    @extend_schema(request=PushSubscribeSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        if not push_enabled():
            return Response({"detail": "Push notifications are not set up on this server."}, status=409)
        payload = PushSubscribeSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        # An endpoint belongs to one browser: re-subscribing (or a new user on it) takes it over.
        PushSubscription.objects.update_or_create(
            endpoint=data["endpoint"],
            defaults={"user": request.user, "p256dh": data["keys"]["p256dh"], "auth": data["keys"]["auth"], "user_agent": request.META.get("HTTP_USER_AGENT", "")[:300]},
        )
        return Response({"subscribed": True}, status=201)

    @extend_schema(request=PushUnsubscribeSerializer, responses=OpenApiTypes.OBJECT)
    def delete(self, request):
        payload = PushUnsubscribeSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        removed, _ = PushSubscription.objects.filter(user=request.user, endpoint=payload.validated_data["endpoint"]).delete()
        return Response({"subscribed": False, "removed": removed})
