from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from apps.employees.models import Employee, Employment
from apps.scheduling import swaps
from apps.scheduling.models import ShiftSwap
from common.scoping import ATTENDANCE_BROAD, scope_to_employees
from common.serializers import call_validated_service
from common.viewsets import TenantModelViewSet


def _person(employee):
    return {"id": str(employee.id), "name": employee.full_name, "employee_number": employee.employee_number}


class ShiftSwapSerializer(serializers.ModelSerializer):
    requester = serializers.SerializerMethodField()
    counterpart = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    decided_by_name = serializers.SerializerMethodField()
    viewer = serializers.SerializerMethodField()

    class Meta:
        model = ShiftSwap
        fields = (
            "id", "requester", "counterpart", "swap_date", "reason", "status", "status_label", "requester_shift_label",
            "counterpart_shift_label", "colleague_responded_at", "decided_by_name", "decided_at", "decision_note", "viewer", "created_at",
        )
        read_only_fields = fields

    def get_requester(self, swap):
        return _person(swap.requester)

    def get_counterpart(self, swap):
        return _person(swap.counterpart)

    def get_decided_by_name(self, swap):
        user = swap.decided_by
        return (user.get_full_name() or user.email) if user else ""

    def get_viewer(self, swap):
        request = self.context["request"]
        user_id = request.user.id
        is_requester, is_counterpart = swap.requester.user_id == user_id, swap.counterpart.user_id == user_id
        approver_ids = self.context.get("decidable_ids", set())
        return {
            "is_requester": is_requester,
            "is_counterpart": is_counterpart,
            "can_answer": is_counterpart and swap.status == ShiftSwap.Status.AWAITING_COLLEAGUE,
            "can_cancel": (is_requester or is_counterpart) and swap.status in (*ShiftSwap.OPEN_STATUSES, ShiftSwap.Status.APPROVED),
            "can_decide": swap.id in approver_ids and not (is_requester or is_counterpart) and swap.status == ShiftSwap.Status.AWAITING_APPROVAL,
        }


class ShiftSwapRequestSerializer(serializers.Serializer):
    counterpart = serializers.UUIDField()
    swap_date = serializers.DateField()
    reason = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class ShiftSwapDecisionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class ShiftSwapViewSet(TenantModelViewSet):
    """Shift swaps the caller is part of, plus (for approvers) those of people in their scope."""

    model = ShiftSwap
    serializer_class = ShiftSwapSerializer
    required_module = "ATTENDANCE"
    http_method_names = ("get", "post", "head", "options")
    filterset_fields = ("status", "swap_date")
    ordering = ("-swap_date", "-created_at")

    def get_required_permission(self):
        if self.action in ("approve", "reject"):
            return "attendance.approve"
        return "attendance.clock"

    def _decidable(self):
        """Swaps whose two people are both inside the caller's approval scope."""
        from apps.institutions.services import effective_permission_codes

        membership = getattr(self.request, "membership", None)
        if membership is None or "attendance.approve" not in effective_permission_codes(membership):
            return ShiftSwap.objects.none()
        employees = scope_to_employees(Employee.objects.for_institution(self.request.institution), self.request, "", broad=ATTENDANCE_BROAD)
        return ShiftSwap.objects.for_institution(self.request.institution).filter(requester__in=employees, counterpart__in=employees)

    def get_queryset(self):
        mine = Q(requester__user=self.request.user) | Q(counterpart__user=self.request.user)
        return super().get_queryset().filter(mine | Q(pk__in=self._decidable().values("pk"))).select_related("requester", "counterpart", "decided_by")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if getattr(self, "swagger_fake_view", False) or not getattr(self.request, "institution", None):
            return context
        context["decidable_ids"] = set(self._decidable().values_list("pk", flat=True))
        return context

    def _me(self):
        employee = Employee.objects.for_institution(self.request.institution).filter(user=self.request.user).first()
        if employee is None:
            raise NotFound("No employee record is linked to your account.")
        return employee

    def create(self, request, *args, **kwargs):
        payload = ShiftSwapRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        counterpart = get_object_or_404(Employee.objects.for_institution(request.institution), pk=payload.validated_data["counterpart"])
        swap = call_validated_service(
            swaps.request_swap, institution=request.institution, requester=self._me(), counterpart=counterpart,
            swap_date=payload.validated_data["swap_date"], reason=payload.validated_data.get("reason", ""), actor=request.user,
        )
        return Response(self.get_serializer(swap).data, status=201)

    def _respond(self, swap):
        return Response(self.get_serializer(self.get_queryset().get(pk=swap.pk)).data)

    @extend_schema(request=ShiftSwapDecisionSerializer, responses=ShiftSwapSerializer)
    @action(detail=True, methods=("post",))
    def accept(self, request, pk=None):
        return self._respond(call_validated_service(swaps.answer_swap, swap=self.get_object(), actor=request.user, accept=True, note=request.data.get("note", "")))

    @extend_schema(request=ShiftSwapDecisionSerializer, responses=ShiftSwapSerializer)
    @action(detail=True, methods=("post",))
    def decline(self, request, pk=None):
        return self._respond(call_validated_service(swaps.answer_swap, swap=self.get_object(), actor=request.user, accept=False, note=request.data.get("note", "")))

    @extend_schema(request=None, responses=ShiftSwapSerializer)
    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        return self._respond(call_validated_service(swaps.cancel_swap, swap=self.get_object(), actor=request.user))

    def _decide(self, request, approve):
        swap = self.get_object()
        payload = ShiftSwapDecisionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        in_scope = self._decidable().filter(pk=swap.pk).exists()
        return self._respond(call_validated_service(swaps.decide_swap, swap=swap, actor=request.user, approve=approve, note=payload.validated_data.get("note", ""), in_scope=in_scope))

    @extend_schema(request=ShiftSwapDecisionSerializer, responses=ShiftSwapSerializer)
    @action(detail=True, methods=("post",))
    def approve(self, request, pk=None):
        return self._decide(request, True)

    @extend_schema(request=ShiftSwapDecisionSerializer, responses=ShiftSwapSerializer)
    @action(detail=True, methods=("post",))
    def reject(self, request, pk=None):
        return self._decide(request, False)

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, methods=("get",))
    def colleagues(self, request):
        """Colleagues in the caller's department or work location who could swap on ``date``, with their shift that day."""
        swap_date = parse_date(request.query_params.get("date") or "")
        if swap_date is None:
            raise ValidationError({"date": "Use YYYY-MM-DD."})
        me = self._me()
        mine = Employment.objects.filter(employee=me, is_current=True).first()
        if mine is None:
            return Response({"my_shift": None, "colleagues": []})
        nearby = Employment.objects.filter(institution=request.institution, is_current=True, employee__status=Employee.Status.ACTIVE).filter(
            Q(department_id=mine.department_id) | Q(location_id=mine.location_id)
        ).exclude(employee=me).select_related("employee").order_by("employee__first_name", "employee__last_name")[:200]
        my_label = swaps.shift_label(me, swap_date)
        rows = []
        for employment in nearby:
            label = swaps.shift_label(employment.employee, swap_date)
            if label is None or label == my_label:
                continue
            rows.append({**_person(employment.employee), "shift": label})
        return Response({"my_shift": my_label, "colleagues": rows})
