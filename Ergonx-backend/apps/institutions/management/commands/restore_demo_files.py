"""Report uploaded files whose content is missing from storage, and restore the demo's.

Before persistent storage was configured, uploads on the hosted server were
written to the container's disk and lost on the next deploy; demo seeds run
from another machine never reached the server at all. The database rows
survive, so lists and checklists look complete while downloads fail.

    python manage.py restore_demo_files              # report only, every institution
    python manage.py restore_demo_files --restore    # APEX-DEMO: write placeholder files

Only the synthetic APEX-DEMO institution is restored (placeholders stand in
for its seeded PDFs, receipts and images). Real organisations' lost files are
reported but cannot be recreated: their users must upload them again.
"""

import base64
from collections import Counter

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError

from apps.complaints.models import ComplaintAttachment
from apps.documents.models import Document, ImageAsset
from apps.institutions.management.commands.seed_ergonx_demo import DEMO_INSTITUTION_CODE, DEMO_SEED_REFUSAL, demo_seed_allowed

MINIMAL_PDF = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
)
# A 1x1 light-grey PNG.
MINIMAL_PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC")


def placeholder(content_type, name):
    content_type = (content_type or "").lower()
    if content_type == "application/pdf" or name.lower().endswith(".pdf"):
        return MINIMAL_PDF
    if content_type.startswith("image/"):
        return MINIMAL_PNG
    return b"Demo file restored after a storage migration. The original content was a seeded placeholder.\n"


class Command(BaseCommand):
    help = "Report uploaded files missing from storage; with --restore, recreate the APEX-DEMO placeholders."

    def add_arguments(self, parser):
        parser.add_argument("--restore", action="store_true", help="Write placeholder content for missing APEX-DEMO files.")

    def _files(self):
        for model in (Document, ComplaintAttachment, ImageAsset):
            for row in model.objects.exclude(stored_file="").exclude(stored_file__isnull=True).select_related("institution").iterator():
                yield row

    def handle(self, *args, **options):
        if options["restore"] and not demo_seed_allowed():
            raise CommandError(DEMO_SEED_REFUSAL.format("restore_demo_files --restore"))
        missing, restored = Counter(), 0
        for row in self._files():
            name = row.stored_file.name
            if default_storage.exists(name):
                continue
            missing[row.institution.code] += 1
            if options["restore"] and row.institution.code == DEMO_INSTITUTION_CODE:
                saved = default_storage.save(name, ContentFile(placeholder(getattr(row, "content_type", ""), name)))
                if saved != name:
                    type(row).objects.filter(pk=row.pk).update(stored_file=saved)
                restored += 1
        if not missing:
            self.stdout.write(self.style.SUCCESS("Every stored file is present."))
            return
        for code, count in missing.most_common():
            self.stdout.write(f"  {code}: {count} file(s) missing")
        if options["restore"]:
            self.stdout.write(self.style.SUCCESS(f"Restored {restored} {DEMO_INSTITUTION_CODE} file(s) as placeholders."))
            others = sum(count for code, count in missing.items() if code != DEMO_INSTITUTION_CODE)
            if others:
                self.stdout.write(self.style.WARNING(f"{others} file(s) of other organisations cannot be recreated; they must be uploaded again."))
