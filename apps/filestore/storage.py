"""A Django storage that keeps uploaded files in the application database.

Hosted servers such as Render wipe the container disk on every deploy, and
not every deployment wants an S3 bucket. Storing the bytes in PostgreSQL
keeps uploads alongside the rest of the data, inside the same backups, with
nothing extra to configure. Files are capped by DOCUMENT_UPLOAD_MAX_MB (25 MB
by default), so reading one into memory to serve it is fine.

There are no public URLs: every download streams through an API view that
checks the caller's access first.
"""

from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


def _key(name):
    """Storage names always use forward slashes (Django builds some with os.path)."""
    return str(name).replace("\\", "/")


@deconstructible
class DatabaseStorage(Storage):
    def _model(self):
        from apps.filestore.models import StoredFile

        return StoredFile

    def _open(self, name, mode="rb"):
        name = _key(name)
        if "w" in mode or "a" in mode:
            raise ValueError("DatabaseStorage files are read-only once saved; save a new file instead.")
        row = self._model().objects.filter(name=name).only("content").first()
        if row is None:
            raise FileNotFoundError(name)
        file = ContentFile(bytes(row.content), name=name)
        file.mode = mode
        return file

    def _save(self, name, content):
        name = _key(name)
        if hasattr(content, "seek"):
            content.seek(0)
        data = content.read() if hasattr(content, "read") else bytes(content)
        if isinstance(data, str):
            data = data.encode()
        self._model().objects.create(name=name, content=data, size=len(data))
        return name

    def exists(self, name):
        name = _key(name)
        return self._model().objects.filter(name=name).exists()

    def delete(self, name):
        name = _key(name)
        self._model().objects.filter(name=name).delete()

    def size(self, name):
        name = _key(name)
        row = self._model().objects.filter(name=name).values("size").first()
        if row is None:
            raise FileNotFoundError(name)
        return row["size"]

    def listdir(self, path):
        prefix = path.strip("/")
        prefix = f"{prefix}/" if prefix else ""
        directories, files = set(), []
        for name in self._model().objects.filter(name__startswith=prefix).values_list("name", flat=True):
            rest = name[len(prefix):]
            if "/" in rest:
                directories.add(rest.split("/", 1)[0])
            else:
                files.append(rest)
        return sorted(directories), sorted(files)

    def url(self, name):
        raise NotImplementedError("Files in the database are served through the API, not by URL.")

    def get_modified_time(self, name):
        name = _key(name)
        row = self._model().objects.filter(name=name).values("updated_at").first()
        if row is None:
            raise FileNotFoundError(name)
        return row["updated_at"]

    def get_created_time(self, name):
        name = _key(name)
        row = self._model().objects.filter(name=name).values("created_at").first()
        if row is None:
            raise FileNotFoundError(name)
        return row["created_at"]
