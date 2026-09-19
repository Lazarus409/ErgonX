from django_filters.rest_framework import DjangoFilterBackend

from apps.documents.models import Document
from apps.documents.serializers import DocumentSerializer
from common.viewsets import TenantModelViewSet


class DocumentViewSet(TenantModelViewSet):
    model = Document
    serializer_class = DocumentSerializer
    permission_resource = "document"
    filter_backends = (DjangoFilterBackend,)
    filterset_fields = ("category", "classification", "entity_type", "entity_id", "is_active")
    search_fields = ("original_filename", "category", "entity_type")

    def perform_create(self, serializer):
        serializer.save(institution=self.request.institution, uploaded_by=self.request.user)

