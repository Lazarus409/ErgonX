
from rest_framework import serializers

from apps.documents.models import Document, DocumentRequirement, DocumentRequirementWaiver, ImageAsset, Policy, PolicyAcknowledgement
from common.serializers import ValidatedModelSerializer
from common.uploads import inspect_upload


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_file = serializers.FileField(write_only=True, required=False)
    uploaded_by = serializers.UUIDField(read_only=True, source="uploaded_by_id")

    class Meta:
        model = Document
        fields = (
            "id", "institution", "uploaded_by", "file_reference", "uploaded_file", "original_filename",
            "content_type", "size_bytes", "category", "classification", "checksum",
            "entity_type", "entity_id", "is_active", "created_at", "updated_at",
        )
        read_only_fields = ("id", "institution", "uploaded_by", "created_at", "updated_at")
        extra_kwargs = {
            "original_filename": {"required": False},
            "content_type": {"required": False},
            "size_bytes": {"required": False},
        }

    def validate(self, attrs):
        request = self.context.get("request")
        new_level = attrs.get("classification")
        old_level = getattr(self.instance, "classification", None)
        touches_restricted = Document.Classification.RESTRICTED in (new_level, old_level if new_level and new_level != old_level else None)
        if request is not None and touches_restricted:
            from apps.documents.access import can_view_restricted

            if not can_view_restricted(request):
                raise serializers.ValidationError({"classification": "Only roles that can open Restricted documents can set or remove that classification."})
        uploaded_file = attrs.get("uploaded_file")
        # A file or reference is needed when creating; a metadata-only update keeps the existing one.
        has_existing = self.instance is not None and (self.instance.stored_file or self.instance.file_reference)
        if uploaded_file is None and not attrs.get("file_reference", "").strip() and not has_existing:
            raise serializers.ValidationError({"file_reference": "Provide an approved storage reference or upload a file."})
        if uploaded_file is not None:
            # Most file types are accepted; programs, scripts, macro files and files whose
            # contents don't match their extension are refused (common/uploads.py).
            # Downloads are always sent as attachments with nosniff.
            name, content_type = inspect_upload(uploaded_file, field="uploaded_file")
            attrs["content_type"] = content_type
            attrs["size_bytes"] = uploaded_file.size
            attrs["original_filename"] = name
        return attrs

    def create(self, validated_data):
        uploaded_file = validated_data.pop("uploaded_file", None)
        if uploaded_file is not None:
            validated_data["stored_file"] = uploaded_file
        instance = super().create(validated_data)
        if uploaded_file is not None:
            instance.file_reference = f"managed:{instance.stored_file.name}"
            instance.save(update_fields=("file_reference", "updated_at"))
        return instance

    def validate_file_reference(self, value):
        if not value.strip():
            raise serializers.ValidationError("A storage reference is required.")
        return value


class ImageAssetSerializer(serializers.ModelSerializer):
    uploaded_file = serializers.FileField(write_only=True)

    class Meta:
        model = ImageAsset
        fields = ("id", "institution", "owner_type", "owner_id", "uploaded_file", "original_filename", "content_type", "size_bytes", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "institution", "original_filename", "content_type", "size_bytes", "created_at", "updated_at")

    ALLOWED = {"image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG\r\n\x1a\n", "image/gif": b"GIF8"}
    MAX_BYTES = 5 * 1024 * 1024

    def validate(self, attrs):
        uploaded = attrs["uploaded_file"]
        content_type = (uploaded.content_type or "").lower()
        if content_type not in self.ALLOWED:
            raise serializers.ValidationError({"uploaded_file": "Only JPEG, PNG, or GIF images are supported."})
        if uploaded.size > self.MAX_BYTES:
            raise serializers.ValidationError({"uploaded_file": "Images must be 5 MB or smaller."})
        header = uploaded.read(12)
        uploaded.seek(0)
        if not header.startswith(self.ALLOWED[content_type]):
            raise serializers.ValidationError({"uploaded_file": "The image content does not match its declared type."})
        attrs["original_filename"] = uploaded.name[:255]
        attrs["content_type"] = content_type
        attrs["size_bytes"] = uploaded.size
        return attrs

    def create(self, validated_data):
        uploaded = validated_data.pop("uploaded_file")
        validated_data["stored_file"] = uploaded
        return super().create(validated_data)



class DocumentRequirementSerializer(ValidatedModelSerializer):
    class Meta:
        model = DocumentRequirement
        fields = (
            "id", "name", "description", "document_category", "employment_types", "validity_months",
            "is_mandatory", "sort_order", "is_active", "created_at", "updated_at",
        )
        read_only_fields = ("id", "is_active", "created_at", "updated_at")


class DocumentRequirementWaiverSerializer(ValidatedModelSerializer):
    requirement_name = serializers.CharField(source="requirement.name", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    waived_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DocumentRequirementWaiver
        fields = ("id", "requirement", "requirement_name", "employee", "employee_name", "reason", "waived_by", "waived_by_name", "created_at")
        read_only_fields = ("id", "waived_by", "created_at")

    def get_waived_by_name(self, obj) -> str:
        return (obj.waived_by.get_full_name() or obj.waived_by.email) if obj.waived_by else ""


class PolicyFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ("id", "original_filename", "content_type", "size_bytes", "created_at")
        read_only_fields = fields


class PolicySerializer(ValidatedModelSerializer):
    """HR's view of a policy. Content changes only while it is a draft."""

    CONTENT_FIELDS = ("title", "category", "summary", "body", "employment_types", "requires_acknowledgement", "acknowledge_within_days")

    category_label = serializers.CharField(source="get_category_display", read_only=True)
    document = PolicyFileSerializer(read_only=True)
    published_by_name = serializers.SerializerMethodField()
    acknowledgement_summary = serializers.SerializerMethodField()

    class Meta:
        model = Policy
        fields = (
            "id", "title", "category", "category_label", "summary", "body", "document", "employment_types",
            "requires_acknowledgement", "acknowledge_within_days", "version", "status", "published_at",
            "published_by_name", "change_summary", "acknowledgement_summary", "created_at", "updated_at",
        )
        read_only_fields = ("id", "document", "version", "status", "published_at", "published_by_name", "change_summary", "acknowledgement_summary", "created_at", "updated_at")

    def get_published_by_name(self, policy):
        user = policy.published_by
        return (user.get_full_name() or user.email) if user else ""

    def get_acknowledgement_summary(self, policy):
        summaries = self.context.get("acknowledgement_summaries") or {}
        return summaries.get(policy.id)

    def validate(self, attrs):
        if self.instance is not None and self.instance.status != Policy.Status.DRAFT and any(field in attrs for field in self.CONTENT_FIELDS):
            raise serializers.ValidationError({"status": "A published policy can't be edited. Publish a new version instead."})
        return attrs


class PolicyNewVersionSerializer(serializers.Serializer):
    change_summary = serializers.CharField(max_length=500)
    title = serializers.CharField(max_length=150, required=False)
    category = serializers.ChoiceField(choices=Policy.Category.choices, required=False)
    summary = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    body = serializers.CharField(max_length=100_000, required=False, allow_blank=True)
    requires_acknowledgement = serializers.BooleanField(required=False)
    acknowledge_within_days = serializers.IntegerField(min_value=1, max_value=365, required=False)


class PolicyAcknowledgementSerializer(serializers.ModelSerializer):
    class Meta:
        model = PolicyAcknowledgement
        fields = ("id", "version", "signed_name", "acknowledged_at")
        read_only_fields = fields


class PolicyAcknowledgeSerializer(serializers.Serializer):
    signed_name = serializers.CharField(max_length=200)
    confirm = serializers.BooleanField()

    def validate_confirm(self, value):
        if not value:
            raise serializers.ValidationError("Confirm that you have read and understood the policy.")
        return value
