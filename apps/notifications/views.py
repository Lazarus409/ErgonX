from django.utils import timezone
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer
from common.permissions import TenantContextPermission, TenantRBACPermission


class NotificationPermissionMixin:
    permission_classes = [TenantContextPermission, TenantRBACPermission]
    required_module = None

    def get_required_permission(self):
        return "home.view"


class NotificationListView(NotificationPermissionMixin, ListAPIView):
    serializer_class = NotificationSerializer

    @extend_schema(responses=NotificationSerializer(many=True))
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        queryset = Notification.objects.for_institution(self.request.institution).filter(
            user=self.request.user, channel=Notification.Channel.IN_APP
        )
        if self.request.query_params.get("unread") == "true":
            queryset = queryset.exclude(status=Notification.Status.READ)
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
            user=request.user, channel=Notification.Channel.IN_APP
        ).exclude(status=Notification.Status.READ).update(
            status=Notification.Status.READ, read_at=timezone.now()
        )
        return Response({"updated": updated})
