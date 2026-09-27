import uuid

from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """Safe, recipient-scoped representation for the in-app notification UI."""

    route_hint = serializers.SerializerMethodField()

    ALLOWED_ROUTE_PREFIXES = (
        "/leave/requests/", "/payroll/runs/", "/recruitment/interviews/",
        "/recruitment/applications/", "/accounting/journals/", "/attendance/",
    )

    # Notifications addressed to the person the record is about open their own
    # self-service page; everything else opens the record for whoever acts on it.
    SELF_SERVICE_ROUTES = {
        "LEAVE_APPROVED": "/me/leave",
        "LEAVE_REJECTED": "/me/leave",
        "PAYSLIP_AVAILABLE": "/me/payslips",
        "TAX_RELIEF_CLAIM_APPROVED": "/me/payslips",
        "TAX_RELIEF_CLAIM_REJECTED": "/me/payslips",
    }
    RECRUITMENT_ROUTES = {
        "recruitment.JobPosting": "/recruitment/job-postings/{id}",
        "recruitment.Application": "/recruitment/applications/{id}",
        "recruitment.Candidate": "/recruitment/candidates/{id}",
        "recruitment.Offer": "/recruitment/offers/{id}",
        "recruitment.Interview": "/recruitment/interviews",
    }

    @classmethod
    def route_for(cls, notification_type, metadata) -> str | None:
        metadata = metadata if isinstance(metadata, dict) else {}
        explicit = metadata.get("route_hint")
        if isinstance(explicit, str) and explicit.startswith(cls.ALLOWED_ROUTE_PREFIXES):
            return explicit
        if notification_type in cls.SELF_SERVICE_ROUTES:
            return cls.SELF_SERVICE_ROUTES[notification_type]

        def ref(key):
            value = metadata.get(key)
            try:
                return str(uuid.UUID(str(value))) if value else None
            except ValueError:
                return None

        if ref("leave_request_id"):
            return f"/leave/requests/{ref('leave_request_id')}"
        if ref("payroll_run_id"):
            return f"/payroll/runs/{ref('payroll_run_id')}"
        if ref("payslip_id"):
            return f"/payroll/payslips/{ref('payslip_id')}"
        if ref("payroll_adjustment_id"):
            return "/payroll/adjustments"
        if ref("tax_relief_claim_id"):
            return "/payroll"
        if ref("journal_entry_id"):
            return f"/accounting/journals/{ref('journal_entry_id')}"
        if ref("vendor_bill_id"):
            return "/accounting/payables"
        if ref("invoice_id"):
            return "/accounting/receivables"
        if ref("expense_id"):
            return "/accounting/expenses"
        if ref("employee_id"):
            return f"/hr/employees/{ref('employee_id')}"
        template = cls.RECRUITMENT_ROUTES.get(metadata.get("entity_type"))
        if template and ref("entity_id"):
            return template.format(id=ref("entity_id"))
        return None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_route_hint(self, obj) -> str | None:
        return self.route_for(obj.notification_type, obj.metadata)

    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id", "notification_type", "title", "message", "status", "is_read", "route_hint",
            "created_at", "read_at", "metadata",
        )
        read_only_fields = fields

    def get_is_read(self, instance) -> bool:
        return instance.status == Notification.Status.READ or instance.read_at is not None
