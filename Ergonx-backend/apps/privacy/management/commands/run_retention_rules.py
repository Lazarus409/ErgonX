"""Apply every organisation's active anonymising retention rules. Runs daily with the scheduled-reports job."""

from django.core.management.base import BaseCommand

from apps.privacy.services import run_due_retention


class Command(BaseCommand):
    help = "Anonymise records that active retention rules say are due (legal holds are respected)."

    def handle(self, *args, **options):
        results = run_due_retention()
        total = sum(results.values())
        for code, count in sorted(results.items()):
            self.stdout.write(f"{code}: {count} record(s)")
        self.stdout.write(self.style.SUCCESS(f"Retention applied to {total} record(s) across {len(results)} organisation(s)."))
