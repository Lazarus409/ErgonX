"""File contents kept in the database (see apps.filestore.storage)."""

from django.db import models


class StoredFile(models.Model):
    """One uploaded file's bytes, addressed by its storage name.

    Rows are written and read only through ``DatabaseStorage``; the records that
    own a file (documents, complaint attachments, images) keep the name in their
    FileField and do their own access control.
    """

    name = models.CharField(max_length=500, unique=True)
    content = models.BinaryField()
    size = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name
