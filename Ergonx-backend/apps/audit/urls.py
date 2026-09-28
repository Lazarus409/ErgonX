from django.urls import path

from apps.audit.history import RecordHistoryView
from apps.audit.views import AuditLogListView

urlpatterns = [
    path("audit/", AuditLogListView.as_view(), name="audit-log-list"),
    path("record-history/<str:record_type>/<uuid:pk>/", RecordHistoryView.as_view(), name="record-history"),
]
