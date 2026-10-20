"""Copy uploaded files out of the database into a bucket or a persistent disk.

Uploads live in the database by default in production (apps.filestore). When that grows
too large, set up the destination, run this command, then switch MEDIA_STORAGE:

    # S3-compatible bucket (Cloudflare R2, AWS S3...): set MEDIA_S3_* first
    python manage.py move_media --to s3
    # or a persistent disk mounted at MEDIA_ROOT
    python manage.py move_media --to filesystem --media-root /var/data/media

Names are kept exactly, so every document, receipt and image keeps working once
MEDIA_STORAGE points at the destination. Files already there with the same size are
skipped, so the command can be re-run. Nothing is deleted unless --delete-copied is given,
and only after the copy is verified.
"""

import os

from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.core.management.base import BaseCommand, CommandError

from apps.filestore.models import StoredFile
from config.settings.storage import media_storage_settings


def _destination(kind, media_root):
    if kind == "filesystem":
        if not media_root:
            raise CommandError("Give --media-root (or set MEDIA_ROOT) for a filesystem destination.")
        return FileSystemStorage(location=media_root)
    storages, _root, chosen = media_storage_settings({**os.environ, "MEDIA_STORAGE": "s3"})
    if chosen != "s3":
        raise CommandError("S3 settings were not recognised.")
    from storages.backends.s3 import S3Storage

    return S3Storage(**storages["default"]["OPTIONS"])


class Command(BaseCommand):
    help = "Copy database-stored uploads to an S3-compatible bucket or a persistent disk, keeping their names."

    def add_arguments(self, parser):
        parser.add_argument("--to", choices=("s3", "filesystem"), required=True)
        parser.add_argument("--media-root", default=os.environ.get("MEDIA_ROOT", ""))
        parser.add_argument("--dry-run", action="store_true", help="Report what would be copied without writing.")
        parser.add_argument("--delete-copied", action="store_true", help="Remove database copies once verified at the destination.")

    def handle(self, *args, **options):
        destination = _destination(options["to"], options["media_root"])
        copied = skipped = failed = 0
        total_bytes = 0
        for row in StoredFile.objects.order_by("name").iterator(chunk_size=50):
            name = row.name
            try:
                if destination.exists(name):
                    if destination.size(name) == row.size:
                        skipped += 1
                        if options["delete_copied"] and not options["dry_run"]:
                            row.delete()
                        continue
                    self.stderr.write(f"CONFLICT {name}: a different file with this name is already at the destination.")
                    failed += 1
                    continue
                if options["dry_run"]:
                    copied += 1
                    total_bytes += row.size
                    continue
                saved = destination.save(name, ContentFile(bytes(row.content)))
                if saved != name or destination.size(name) != row.size:
                    self.stderr.write(f"FAILED {name}: stored as {saved!r} or size differs.")
                    failed += 1
                    continue
                copied += 1
                total_bytes += row.size
                if options["delete_copied"]:
                    row.delete()
            except Exception as exc:  # noqa: BLE001 - report every file, keep going
                self.stderr.write(f"FAILED {name}: {exc}")
                failed += 1
        verb = "Would copy" if options["dry_run"] else "Copied"
        self.stdout.write(f"{verb} {copied} file(s) ({total_bytes / 1_048_576:.1f} MB); {skipped} already there; {failed} failed.")
        if failed:
            raise CommandError(f"{failed} file(s) were not copied; fix them and run the command again.")
        if not options["dry_run"]:
            self.stdout.write(f"Next: set MEDIA_STORAGE={options['to']} and redeploy." if options["to"] == "s3"
                              else "Next: set MEDIA_ROOT to that folder (on a persistent disk), unset MEDIA_STORAGE, and redeploy.")
