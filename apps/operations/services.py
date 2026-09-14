from datetime import date

from django.db import transaction
from django.utils import timezone

from apps.notifications.models import Notification
from apps.employees.models import Employee
from apps.operations.models import BackgroundJob, ImportJob, ImportRowResult


@transaction.atomic
def enqueue_background_job(*, job_type, institution=None, initiated_by=None, metadata=None):
    return BackgroundJob.objects.create(job_type=job_type, institution=institution, initiated_by=initiated_by, metadata=metadata or {})


@transaction.atomic
def claim_next_background_job(*, job_types=None):
    queryset = BackgroundJob.objects.select_for_update(skip_locked=True).filter(status=BackgroundJob.Status.QUEUED)
    if job_types:
        queryset = queryset.filter(job_type__in=job_types)
    job = queryset.order_by("created_at").first()
    if job is None:
        return None
    job.status = BackgroundJob.Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=("status", "started_at", "updated_at"))
    return job


def complete_background_job(job, *, result_reference=""):
    job.status = BackgroundJob.Status.SUCCEEDED
    job.progress = 100
    job.result_reference = result_reference
    job.completed_at = timezone.now()
    job.save(update_fields=("status", "progress", "result_reference", "completed_at", "updated_at"))
    return job


def fail_background_job(job, *, error_summary):
    job.status = BackgroundJob.Status.FAILED
    job.error_summary = str(error_summary)[:5000]
    job.completed_at = timezone.now()
    job.save(update_fields=("status", "error_summary", "completed_at", "updated_at"))
    return job


def process_pending_notifications(*, limit=100):
    """Mark in-app delivery complete; email transport can be registered by a worker later."""
    delivered = 0
    for notification in Notification.objects.filter(status=Notification.Status.PENDING, channel=Notification.Channel.IN_APP).order_by("created_at")[:limit]:
        notification.status = Notification.Status.SENT
        notification.sent_at = timezone.now()
        notification.save(update_fields=("status", "sent_at", "updated_at"))
        delivered += 1
    return delivered


@transaction.atomic
def commit_employee_import(*, import_job):
    """Commits pre-validated employee rows; file parsing stays in a domain validator."""
    import_job = ImportJob.objects.select_for_update().get(pk=import_job.pk)
    if import_job.import_type != "EMPLOYEE" or import_job.status != ImportJob.Status.COMMITTING:
        raise ValueError("Only committing EMPLOYEE imports can be processed.")
    imported = skipped = 0
    for row in import_job.row_results.select_for_update().filter(status=ImportRowResult.Status.VALID).order_by("row_number"):
        values = row.normalized_data
        number = str(values["employee_number"]).strip().upper()
        if Employee.objects.filter(institution=import_job.institution, employee_number=number).exists():
            row.status = ImportRowResult.Status.SKIPPED
            row.errors = ["Employee number already exists."]
            row.save(update_fields=("status", "errors", "updated_at"))
            skipped += 1
            continue
        Employee.objects.create(
            institution=import_job.institution, employee_number=number,
            first_name=values["first_name"], last_name=values["last_name"],
            middle_name=values.get("middle_name", ""), personal_email=values.get("personal_email", ""),
            work_email=values.get("work_email", ""), phone=values.get("phone", ""),
            hire_date=date.fromisoformat(values["hire_date"]) if isinstance(values["hire_date"], str) else values["hire_date"],
            gender=values.get("gender", Employee.Gender.PREFER_NOT_TO_SAY), status=values.get("status", Employee.Status.ACTIVE),
        )
        row.status = ImportRowResult.Status.IMPORTED
        row.save(update_fields=("status", "updated_at"))
        imported += 1
    import_job.status = ImportJob.Status.COMPLETED
    import_job.completed_at = timezone.now()
    import_job.valid_rows = imported
    import_job.invalid_rows = skipped + import_job.row_results.filter(status=ImportRowResult.Status.INVALID).count()
    import_job.save(update_fields=("status", "completed_at", "valid_rows", "invalid_rows", "updated_at"))
    return imported
