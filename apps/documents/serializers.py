from rest_framework import serializers

from apps.documents.models import Document


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.UUIDField(read_only=True, source="uploaded_by_id")

    class Meta:
        model = Document
        fields = (
            "id", "institution", "uploaded_by", "file_reference", "original_filename",
            "content_type", "size_bytes", "category", "classification", "checksum",
            "entity_type", "entity_id", "is_active", "created_at", "updated_at",
        )
        read_only_fields = ("id", "institution", "uploaded_by", "created_at", "updated_at")

    def validate_file_reference(self, value):
        if not value.strip():
            raise serializers.ValidationError("A storage reference is required.")
        return value

