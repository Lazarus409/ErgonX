from django.core.management.base import BaseCommand

from apps.operations.models import ImportJob
from apps.operations.services import claim_next_background_job, commit_employee_import, complete_background_job, fail_background_job, process_pending_notifications


class Command(BaseCommand):
    help = "Runs one batch of database-backed background jobs. Safe to invoke from a scheduler or worker."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        processed = 0
        while job := claim_next_background_job():
            try:
                if job.job_type == "NOTIFICATION_DELIVERY":
                    count = process_pending_notifications(limit=options["limit"])
                    complete_background_job(job, result_reference=f"notifications:{count}")
                elif job.job_type == "IMPORT_COMMIT":
                    item = ImportJob.objects.get(id=job.metadata["import_job_id"], institution=job.institution)
                    if item.import_type != "EMPLOYEE":
                        raise ValueError(f"No import handler registered for {item.import_type!r}.")
                    count = commit_employee_import(import_job=item)
                    complete_background_job(job, result_reference=f"imported:{count}")
                else:
                    raise ValueError(f"No handler registered for job type {job.job_type!r}.")
                processed += 1
            except Exception as exc:
                fail_background_job(job, error_summary=exc)
        self.stdout.write(self.style.SUCCESS(f"Processed {processed} background job(s)."))
