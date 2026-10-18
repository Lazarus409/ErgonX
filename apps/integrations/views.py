from datetime import timedelta

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from apps.integrations import services
from apps.integrations.models import ApiKey, WebhookDelivery, WebhookEndpoint
from common.permissions import TenantContextPermission, TenantRBACPermission
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet


# ------------------------------------------------------------- admin: keys


class ApiKeySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ApiKey
        fields = ("id", "name", "prefix", "scopes", "created_by_name", "last_used_at", "expires_at", "revoked_at", "created_at")
        read_only_fields = fields

    def get_created_by_name(self, key):
        return key.created_by.get_full_name() or key.created_by.email


class ApiKeyCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    scopes = serializers.ListField(child=serializers.ChoiceField(choices=ApiKey.Scope.choices), min_length=1)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class ApiKeyViewSet(TenantModelViewSet):
    model = ApiKey
    serializer_class = ApiKeySerializer
    http_method_names = ("get", "post", "head", "options")
    required_permission = "integrations.manage"

    def get_queryset(self):
        return super().get_queryset().select_related("created_by")

    def create(self, request, *args, **kwargs):
        payload = ApiKeyCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        key, plaintext = call_validated_service(services.create_api_key, institution=request.institution, actor=request.user, **payload.validated_data)
        # The key is shown once and never again.
        return Response({**ApiKeySerializer(key).data, "key": plaintext}, status=201)

    @extend_schema(request=None, responses=ApiKeySerializer)
    @action(detail=True, methods=("post",))
    def revoke(self, request, pk=None):
        return Response(ApiKeySerializer(services.revoke_api_key(key=self.get_object(), actor=request.user)).data)


# --------------------------------------------------------- admin: webhooks


class WebhookEndpointSerializer(serializers.ModelSerializer):
    recent_failures = serializers.SerializerMethodField()

    class Meta:
        model = WebhookEndpoint
        fields = ("id", "url", "description", "events", "is_active", "consecutive_failures", "recent_failures", "created_at", "updated_at")
        read_only_fields = ("id", "url", "consecutive_failures", "recent_failures", "created_at", "updated_at")

    def get_recent_failures(self, endpoint):
        return endpoint.deliveries.filter(status=WebhookDelivery.Status.FAILED, created_at__gte=timezone.now() - timedelta(days=7)).count()

    def validate_events(self, value):
        unknown = [event for event in value if event not in services.EVENT_NAMES]
        if not value or unknown:
            raise serializers.ValidationError(f"Choose events from: {', '.join(services.EVENT_NAMES)}.")
        return list(dict.fromkeys(value))


class WebhookCreateSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=500)
    events = serializers.ListField(child=serializers.CharField(), min_length=1)
    description = serializers.CharField(max_length=200, required=False, allow_blank=True)


class WebhookDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookDelivery
        fields = ("id", "event", "status", "attempts", "last_status_code", "last_error", "next_attempt_at", "delivered_at", "created_at")
        read_only_fields = fields


class WebhookEndpointViewSet(TenantModelViewSet):
    model = WebhookEndpoint
    serializer_class = WebhookEndpointSerializer
    http_method_names = ("get", "post", "patch", "delete", "head", "options")
    required_permission = "integrations.manage"

    def create(self, request, *args, **kwargs):
        payload = WebhookCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        endpoint, secret = call_validated_service(services.create_webhook, institution=request.institution, actor=request.user, **payload.validated_data)
        return Response({**WebhookEndpointSerializer(endpoint).data, "secret": secret}, status=201)

    def perform_update(self, serializer):
        endpoint = serializer.save()
        if endpoint.is_active and endpoint.consecutive_failures:
            WebhookEndpoint.objects.filter(pk=endpoint.pk).update(consecutive_failures=0)

    def perform_destroy(self, instance):
        from apps.audit.services import record_audit_event

        record_audit_event(actor=self.request.user, institution=self.request.institution, entity=instance, action="integrations.webhook.deleted", metadata={"url": instance.url})
        instance.delete()

    @extend_schema(responses=WebhookDeliverySerializer(many=True))
    @action(detail=True, methods=("get",))
    def deliveries(self, request, pk=None):
        return Response(WebhookDeliverySerializer(self.get_object().deliveries.all()[:50], many=True).data)

    @extend_schema(request=None, responses=WebhookDeliverySerializer)
    @action(detail=True, methods=("post",))
    def ping(self, request, pk=None):
        """Sends a test event to check the endpoint and its signature handling."""
        endpoint = self.get_object()
        with transaction.atomic():
            delivery = WebhookDelivery(institution=request.institution, endpoint=endpoint, event="ping", payload={}, next_attempt_at=timezone.now())
            delivery.payload = {"id": str(delivery.id), "event": "ping", "occurred_at": timezone.now().isoformat(), "institution": {"id": str(request.institution.id), "code": request.institution.code}, "data": {}}
            delivery.save()
        result = services.deliver(delivery.id)
        return Response(WebhookDeliverySerializer(result).data)

    @extend_schema(request=None, responses=WebhookDeliverySerializer)
    @action(detail=True, methods=("post",), url_path=r"deliveries/(?P<delivery_id>[0-9a-f-]+)/retry")
    def retry(self, request, pk=None, delivery_id=None):
        delivery = self.get_object().deliveries.filter(pk=delivery_id).first()
        if delivery is None:
            raise NotFound("Delivery not found.")
        WebhookDelivery.objects.filter(pk=delivery.pk).update(status=WebhookDelivery.Status.PENDING, attempts=0, next_attempt_at=timezone.now())
        return Response(WebhookDeliverySerializer(services.deliver(delivery.pk)).data)


class WebhookEventsView(APIView):
    permission_classes = (TenantContextPermission, TenantRBACPermission)

    def get_required_permission(self):
        return "integrations.manage"

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        return Response({"events": services.EVENT_NAMES, "scopes": [{"value": value, "label": label} for value, label in ApiKey.Scope.choices]})


# ---------------------------------------------------- external: API keys


class ApiKeyThrottle(SimpleRateThrottle):
    rate = "600/min"
    scope = "integration_api_key"

    def get_cache_key(self, request, view):
        key = getattr(request, "api_key", None)
        return self.cache_format % {"scope": self.scope, "ident": key.id if key else self.get_ident(request)}


class ApiKeyView(APIView):
    """Endpoints for outside systems, authenticated with ``Authorization: Api-Key <key>``."""

    authentication_classes = ()
    permission_classes = (AllowAny,)
    required_scope = None

    def initial(self, request, *args, **kwargs):
        header = request.headers.get("Authorization", "")
        raw = header[len("Api-Key "):].strip() if header.startswith("Api-Key ") else request.headers.get("X-Api-Key", "")
        key = services.authenticate_api_key(raw)
        if key is None:
            raise AuthenticationFailed("A valid API key is required.")
        if self.required_scope not in key.scopes:
            raise PermissionDenied(f"This key lacks the {self.required_scope} scope.")
        request.api_key = key
        super().initial(request, *args, **kwargs)

    def get_throttles(self):
        return [ApiKeyThrottle()]


class ExternalEmployeesView(ApiKeyView):
    required_scope = "employees.read"

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        from apps.employees.models import Employee, Employment

        institution = request.api_key.institution
        employees = Employee.objects.for_institution(institution).order_by("employee_number")
        status = request.query_params.get("status")
        if status:
            employees = employees.filter(status=status.upper())
        employments = {row.employee_id: row for row in Employment.objects.filter(employee__in=employees, is_current=True).select_related("department", "position", "location")}
        return Response({"employees": [
            {
                "id": str(employee.id), "employee_number": employee.employee_number, "first_name": employee.first_name, "last_name": employee.last_name,
                "work_email": employee.work_email, "status": employee.status,
                "department": employments[employee.id].department.name if employee.id in employments and employments[employee.id].department_id else None,
                "position": employments[employee.id].position.title if employee.id in employments and employments[employee.id].position_id else None,
                "location": employments[employee.id].location.name if employee.id in employments and employments[employee.id].location_id else None,
            }
            for employee in employees
        ]})


class ExternalLeaveView(ApiKeyView):
    required_scope = "leave.read"

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        from apps.leave.models import LeaveRequest

        start = parse_date(request.query_params.get("from") or "") or timezone.localdate()
        end = parse_date(request.query_params.get("to") or "") or start + timedelta(days=31)
        if end < start or (end - start).days > 366:
            raise ValidationError({"to": "Ask for at most one year at a time."})
        leaves = LeaveRequest.objects.for_institution(request.api_key.institution).filter(status=LeaveRequest.Status.APPROVED, end_date__gte=start, start_date__lte=end).select_related("employee", "leave_type")
        # Leave types are reported, never reasons or attachments.
        return Response({"leave": [
            {"employee_number": leave.employee.employee_number, "leave_type": leave.leave_type.name, "start_date": leave.start_date, "end_date": leave.end_date, "days": str(leave.requested_days)}
            for leave in leaves
        ]})


class PunchSerializer(serializers.Serializer):
    employee_number = serializers.CharField(max_length=50)
    timestamp = serializers.DateTimeField()
    direction = serializers.ChoiceField(choices=("IN", "OUT"))
    device_id = serializers.CharField(max_length=100, required=False, allow_blank=True)


class ExternalPunchesView(ApiKeyView):
    """Clock-ins and clock-outs from biometric or badge devices, recorded as device punches."""

    required_scope = "attendance.punch"

    @extend_schema(request=OpenApiTypes.OBJECT, responses={200: OpenApiTypes.OBJECT})
    def post(self, request):
        from apps.attendance.models import AttendanceRecord
        from apps.attendance.services import _local_date, clock_in, clock_out
        from apps.employees.models import Employee

        punches = request.data.get("punches")
        if not isinstance(punches, list) or not punches or len(punches) > 500:
            raise ValidationError({"punches": "Send between 1 and 500 punches."})
        key = request.api_key
        institution = key.institution
        if "ATTENDANCE" not in set(institution.modules.filter(is_enabled=True).values_list("module_code", flat=True)):
            raise PermissionDenied("Attendance is not enabled for this organisation.")
        results = []
        for index, raw in enumerate(punches):
            serializer = PunchSerializer(data=raw)
            if not serializer.is_valid():
                results.append({"index": index, "status": "error", "message": "; ".join(f"{field}: {errors[0]}" for field, errors in serializer.errors.items())})
                continue
            punch = serializer.validated_data
            employee = Employee.objects.for_institution(institution).filter(employee_number=punch["employee_number"]).first()
            if employee is None:
                results.append({"index": index, "status": "error", "message": "Unknown employee number."})
                continue
            if punch["timestamp"] > timezone.now() + timedelta(minutes=5):
                results.append({"index": index, "status": "error", "message": "Timestamp is in the future."})
                continue
            try:
                with transaction.atomic():
                    # Device punches are entered by the key's creator, who must manage attendance.
                    if punch["direction"] == "IN":
                        record = clock_in(employee=employee, actor=key.created_by, at=punch["timestamp"], source=AttendanceRecord.Source.DEVICE)
                    else:
                        day = _local_date(employee, punch["timestamp"])
                        record = AttendanceRecord.objects.filter(employee=employee, attendance_date=day, check_in__isnull=False, check_out__isnull=True).first()
                        if record is None:
                            raise ValidationError({"direction": "No open clock-in for this day."})
                        record = clock_out(attendance_record=record, actor=key.created_by, at=punch["timestamp"])
                results.append({"index": index, "status": "ok", "attendance_record": str(record.id)})
            except ValidationError as exc:
                messages = exc.message_dict.values() if hasattr(exc, "message_dict") else [exc.messages]
                results.append({"index": index, "status": "error", "message": "; ".join(str(message) for group in messages for message in group)[:300]})
        accepted = sum(1 for row in results if row["status"] == "ok")
        return Response({"accepted": accepted, "rejected": len(results) - accepted, "results": results})


# ------------------------------------------------------------- calendar


class MyCalendarFeedView(APIView):
    permission_classes = (TenantContextPermission, TenantRBACPermission)

    def get_required_permission(self):
        return "home.view"

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        from apps.integrations.models import CalendarFeed

        feed = CalendarFeed.objects.filter(institution=request.institution, user=request.user, revoked_at__isnull=True).first()
        return Response({"active": feed is not None, "created_at": feed.created_at if feed else None, "last_used_at": feed.last_used_at if feed else None})

    @extend_schema(request=None, responses={201: OpenApiTypes.OBJECT})
    def post(self, request):
        token = services.create_calendar_feed(institution=request.institution, user=request.user)
        # The link is shown once; creating a new one replaces it.
        return Response({"active": True, "path": f"/api/v1/public/calendar/{token}.ics"}, status=201)

    @extend_schema(request=None, responses={204: None})
    def delete(self, request):
        from apps.integrations.models import CalendarFeed

        CalendarFeed.objects.filter(institution=request.institution, user=request.user, revoked_at__isnull=True).update(revoked_at=timezone.now())
        return Response(status=204)


class CalendarFeedThrottle(SimpleRateThrottle):
    rate = "120/hour"
    scope = "calendar_feed"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class PublicCalendarView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (CalendarFeedThrottle,)

    @extend_schema(responses={(200, "text/calendar"): OpenApiTypes.STR})
    def get(self, request, token):
        feed = services.feed_for_token(token)
        if feed is None:
            raise NotFound("Unknown calendar link.")
        response = HttpResponse(services.calendar_ics(feed), content_type="text/calendar; charset=utf-8")
        response["Cache-Control"] = "private, max-age=900"
        return response
