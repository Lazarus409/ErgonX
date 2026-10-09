from rest_framework import serializers

from apps.complaints.models import Complaint, ComplaintNote


def _name(user):
    return (user.get_full_name() or user.email) if user else ""


class ViewerMixin:
    """The employee who filed a complaint sees it without HR's internal notes."""

    def viewer(self, obj):
        user = self.context["request"].user
        is_complainant = obj.complainant.user_id == user.id
        codes = self.context.get("permission_codes", set())
        is_respondent = bool(obj.respondent_id and obj.respondent.user_id == user.id)
        is_staff = bool(codes & {"complaint.view", "complaint.manage"}) and not is_complainant and not is_respondent
        is_handler = "complaint.manage" in codes and is_staff
        return is_complainant, is_staff, is_handler


class ComplaintListSerializer(ViewerMixin, serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    complainant_name = serializers.CharField(source="complainant.full_name", read_only=True)
    complainant_number = serializers.CharField(source="complainant.employee_number", read_only=True)
    respondent_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = (
            "id", "code", "category", "category_label", "subject", "status", "priority", "complainant", "complainant_name", "complainant_number",
            "respondent", "respondent_name", "assigned_to", "assigned_to_name", "incident_date", "created_at", "resolved_at",
        )
        read_only_fields = fields

    def get_respondent_name(self, obj) -> str:
        return obj.respondent.full_name if obj.respondent_id else obj.respondent_description

    def get_assigned_to_name(self, obj) -> str:
        return _name(obj.assigned_to)


class ComplaintNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    from_hr = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintNote
        fields = ("id", "body", "is_internal", "author_name", "from_hr", "created_at")
        read_only_fields = fields

    def get_author_name(self, obj) -> str:
        return _name(obj.author)

    def get_from_hr(self, obj) -> bool:
        return obj.author_id != obj.complaint.complainant.user_id


class ComplaintSerializer(ComplaintListSerializer):
    respondent_description = serializers.CharField(read_only=True)
    resolved_by_name = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()
    viewer = serializers.SerializerMethodField()

    class Meta(ComplaintListSerializer.Meta):
        fields = ComplaintListSerializer.Meta.fields + (
            "description", "incident_location", "respondent_description", "resolution", "resolved_by_name", "closed_at", "withdrawn_at", "notes", "viewer", "updated_at",
        )
        read_only_fields = fields

    def get_resolved_by_name(self, obj) -> str:
        return _name(obj.resolved_by)

    def get_notes(self, obj) -> list[dict]:
        _, is_staff, _ = self.viewer(obj)
        notes = obj.notes.select_related("author", "complaint__complainant").all()
        if not is_staff:
            notes = [note for note in notes if not note.is_internal]
        return ComplaintNoteSerializer(notes, many=True).data

    def get_viewer(self, obj) -> dict:
        is_complainant, is_staff, is_handler = self.viewer(obj)
        open_ = obj.status in Complaint.OPEN_STATUSES
        return {
            "is_complainant": is_complainant,
            "is_staff": is_staff,
            "can_manage": is_handler and obj.status not in (Complaint.Status.CLOSED, Complaint.Status.WITHDRAWN),
            "can_withdraw": is_complainant and open_,
            "can_message": (is_complainant and (open_ or obj.status == Complaint.Status.RESOLVED)) or (is_handler and obj.status != Complaint.Status.WITHDRAWN),
        }


class FileComplaintSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=Complaint.Category.choices)
    subject = serializers.CharField(max_length=200)
    description = serializers.CharField()
    incident_date = serializers.DateField(required=False, allow_null=True)
    incident_location = serializers.CharField(required=False, allow_blank=True, default="", max_length=200)
    respondent = serializers.UUIDField(required=False, allow_null=True)
    respondent_description = serializers.CharField(required=False, allow_blank=True, default="", max_length=200)


class NoteInputSerializer(serializers.Serializer):
    body = serializers.CharField()
    is_internal = serializers.BooleanField(default=False)


class AssignSerializer(serializers.Serializer):
    assignee = serializers.UUIDField()


class PrioritySerializer(serializers.Serializer):
    priority = serializers.ChoiceField(choices=Complaint.Priority.choices)


class TextSerializer(serializers.Serializer):
    text = serializers.CharField(required=False, allow_blank=True, default="")
