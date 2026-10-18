from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.audit.models import AuditLog


@receiver(post_save, sender=AuditLog, dispatch_uid="integrations_webhooks_from_audit")
def queue_webhooks(sender, instance, created, raw=False, **kwargs):
    """Every new audit entry may notify subscribed webhooks (see apps.integrations.services.EVENTS)."""
    if created and not raw:
        from apps.integrations.services import EVENTS, queue_for_audit_log

        if instance.action in EVENTS:
            queue_for_audit_log(instance)
