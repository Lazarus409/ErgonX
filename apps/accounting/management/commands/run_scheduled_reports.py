from django.core.management.base import BaseCommand

from apps.accounting.reporting import run_due_reports


class Command(BaseCommand):
    help = "Run scheduled financial reports whose next run date has arrived (run daily from cron)."

    def handle(self, *args, **options):
        self.stdout.write(f"Ran {run_due_reports()} scheduled report(s).")
