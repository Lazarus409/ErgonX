from django.core.management.base import BaseCommand

from apps.integrations.services import deliver_due


class Command(BaseCommand):
    help = "Retry webhook deliveries that are due. Schedule every few minutes (cron or a Render cron job)."

    def handle(self, *args, **options):
        results = [delivery for delivery in deliver_due() if delivery is not None]
        delivered = sum(1 for delivery in results if delivery.status == "SUCCEEDED")
        self.stdout.write(f"Attempted {len(results)} deliveries; {delivered} delivered.")
