"""Write one organisation's full data export (ZIP) to a file."""

import shutil

from django.core.management.base import BaseCommand, CommandError

from apps.institutions.data_export import build_organisation_export
from apps.institutions.models import Institution


class Command(BaseCommand):
    help = "Export everything one organisation holds (records, members, uploaded files) to a ZIP."

    def add_arguments(self, parser):
        parser.add_argument("code", help="The organisation's code, e.g. APEX-DEMO.")
        parser.add_argument("--output", help="Where to write the ZIP (default: the generated file name in the current folder).")
        parser.add_argument("--no-files", action="store_true", help="Leave out uploaded files.")

    def handle(self, *args, code, output=None, no_files=False, **options):
        institution = Institution.objects.filter(code__iexact=code).first()
        if institution is None:
            raise CommandError(f"No organisation with code {code!r}.")
        handle, filename = build_organisation_export(institution, actor=None, include_files=not no_files)
        with handle, open(output or filename, "wb") as target:
            shutil.copyfileobj(handle, target)
        self.stdout.write(self.style.SUCCESS(f"Wrote {output or filename}"))
