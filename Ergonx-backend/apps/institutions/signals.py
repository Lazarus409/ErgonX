from django.db.models.signals import post_migrate, post_save
from django.dispatch import receiver

from apps.institutions.models import Institution
from apps.institutions.services import bootstrap_institution, ensure_system_permissions


@receiver(post_save, sender=Institution)
def initialize_institution(sender, instance, created, **kwargs):
    if created:
        bootstrap_institution(instance)


@receiver(post_migrate)
def initialize_permissions(sender, **kwargs):
    if sender.label == "institutions":
        ensure_system_permissions()
