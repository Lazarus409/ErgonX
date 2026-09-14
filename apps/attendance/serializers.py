from rest_framework import serializers

from apps.attendance.models import AttendanceAdjustment, AttendanceRecord, OvertimeRecord
from apps.attendance.services import request_adjustment
from apps.employees.models import Employee
from common.serializers import ValidatedModelSerializer, call_validated_service


class AttendanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceRecord
        fields = (
            "id",
            "employee",
            "schedule_assignment",
            "attendance_date",
            "check_in",
            "check_out",
            "worked_minutes",
            "late_minutes",
            "early_departure_minutes",
            "overtime_minutes",
            "status",
            "source",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class ClockInSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())
    at = serializers.DateTimeField(required=False)
    source = serializers.ChoiceField(
        choices=AttendanceRecord.Source.choices,
        default=AttendanceRecord.Source.WEB,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        institution = getattr(self.context.get("request"), "institution", None)
        if institution:
            self.fields["employee"].queryset = Employee.objects.for_institution(institution)


class ClockOutSerializer(serializers.Serializer):
    at = serializers.DateTimeField(required=False)


class AttendanceClassificationSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.none())
    attendance_date = serializers.DateField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        institution = getattr(self.context.get("request"), "institution", None)
        if institution:
            self.fields["employee"].queryset = Employee.objects.for_institution(institution)


class AttendanceAdjustmentSerializer(ValidatedModelSerializer):
    class Meta:
        model = AttendanceAdjustment
        fields = (
            "id",
            "attendance_record",
            "requested_by",
            "reason",
            "old_values",
            "proposed_values",
            "status",
            "approved_by",
            "acted_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "requested_by",
            "old_values",
            "status",
            "approved_by",
            "acted_at",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        institution = getattr(self.context.get("request"), "institution", None)
        if institution:
            self.fields["attendance_record"].queryset = AttendanceRecord.objects.for_institution(
                institution
            )

    def create(self, validated_data):
        return call_validated_service(
            request_adjustment,
            actor=self.context["request"].user,
            **validated_data,
        )


class OvertimeRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = OvertimeRecord
        fields = (
            "id",
            "employee",
            "attendance_record",
            "calculated_minutes",
            "approved_minutes",
            "rate_multiplier",
            "status",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class OvertimeDecisionSerializer(serializers.Serializer):
    approved_minutes = serializers.IntegerField(required=False, min_value=0)
