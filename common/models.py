import uuid

from django.db import models


class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


def changed_actor_fields(instance, fields):
    """The actor stamps (``created_by``, ``approved_by``, ...) being set by this save.

    A stamp is checked against active membership when it is recorded. Once
    recorded it stays valid after that member leaves, so their records can
    still be approved, voided or settled by others.
    """
    fields = tuple(fields)
    if instance._state.adding:
        return fields
    stored = type(instance)._base_manager.filter(pk=instance.pk).values(*(f"{field}_id" for field in fields)).first()
    if stored is None:
        return fields
    return tuple(field for field in fields if getattr(instance, f"{field}_id") != stored[f"{field}_id"])


class TenantQuerySet(models.QuerySet):
    def for_institution(self, institution):
        if institution is None:
            return self.none()
        return self.filter(institution=institution)


class TenantManager(models.Manager.from_queryset(TenantQuerySet)):
    pass


class TenantOwnedModel(BaseModel):
    objects = TenantManager()

    def save(self, *args, **kwargs):
        if not kwargs.get("raw", False):
            # Cross-table tenant constraints cannot generally be expressed as SQL
            # CHECK constraints. Always execute model-level invariant validation.
            self.full_clean(validate_constraints=False)
        super().save(*args, **kwargs)

    class Meta:
        abstract = True
