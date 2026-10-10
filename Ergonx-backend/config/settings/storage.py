"""Where uploaded files (documents, receipts, complaint files, images) live.

* ``MEDIA_STORAGE=database``: in the application database (apps.filestore).
  Production uses this unless told otherwise: nothing to set up, and the
  files survive deploys and are part of every database backup.
* ``MEDIA_STORAGE=s3``: an S3-compatible bucket (Cloudflare R2, AWS S3, ...).
* Otherwise: the ``MEDIA_ROOT`` folder (default ``<backend>/media``), as in
  development. On a hosted server that folder must be a persistent disk,
  because a container's own disk is wiped on every deploy.

Files are never served from the bucket directly: every download goes through
the API, which checks the caller's access first. The bucket stays private.
"""

import os

S3_REQUIRED = ("MEDIA_S3_BUCKET", "MEDIA_S3_ACCESS_KEY_ID", "MEDIA_S3_SECRET_ACCESS_KEY")


def media_storage_settings(environ=None, base_dir=None):
    """Returns ``(STORAGES, MEDIA_ROOT, kind)`` where kind is "database", "s3" or "filesystem"."""
    environ = os.environ if environ is None else environ
    media_root = environ.get("MEDIA_ROOT") or (str(base_dir / "media") if base_dir is not None else "media")
    staticfiles = {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}
    choice = environ.get("MEDIA_STORAGE", "").strip().lower()
    if choice == "database":
        return {"default": {"BACKEND": "apps.filestore.storage.DatabaseStorage"}, "staticfiles": staticfiles}, media_root, "database"
    if choice != "s3":
        # No fixed location: the storage follows settings.MEDIA_ROOT (and overrides of it).
        default = {"BACKEND": "django.core.files.storage.FileSystemStorage"}
        return {"default": default, "staticfiles": staticfiles}, media_root, "filesystem"

    missing = [name for name in S3_REQUIRED if not environ.get(name)]
    if missing:
        from django.core.exceptions import ImproperlyConfigured

        raise ImproperlyConfigured(f"MEDIA_STORAGE=s3 is missing: {', '.join(missing)}")
    options = {
        "bucket_name": environ["MEDIA_S3_BUCKET"],
        "access_key": environ["MEDIA_S3_ACCESS_KEY_ID"],
        "secret_key": environ["MEDIA_S3_SECRET_ACCESS_KEY"],
        # Cloudflare R2 / Backblaze / MinIO need their endpoint; AWS S3 does not.
        "endpoint_url": environ.get("MEDIA_S3_ENDPOINT_URL") or None,
        "region_name": environ.get("MEDIA_S3_REGION") or None,
        "location": environ.get("MEDIA_S3_PREFIX", "media").strip("/"),
        # Private bucket: no public ACLs, never overwrite an existing object.
        "default_acl": None,
        "querystring_auth": True,
        "file_overwrite": False,
        "signature_version": "s3v4",
    }
    optional = ("endpoint_url", "region_name")
    default = {"BACKEND": "storages.backends.s3.S3Storage", "OPTIONS": {key: value for key, value in options.items() if value is not None or key not in optional}}
    return {"default": default, "staticfiles": staticfiles}, media_root, "s3"
