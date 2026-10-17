"""Public careers site and candidate self-service.

Each institution can switch on a careers site at ``/careers/<slug>``. It lists
open job postings that HR has marked public. Anyone may apply without an
account; the application enters the pipeline at the first stage like any other.

Candidates never get an ErgonX account (staff sign-up stays invitation-only).
Instead every application gets its own private tracking link. The link shows
that one application: its progress, interviews to confirm or decline, and the
documents sent with it. It never shows the candidate profile or other
applications, so someone using another person's email address learns nothing
and can change nothing beyond the application they themselves submitted.
Only a hash of the link's token is stored.
"""

import hashlib
import mimetypes
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.recruitment.models import Application, ApplicationStageHistory, CandidateAccessToken, Candidate, CareersSite, Interview, JobPosting, RecruitmentStage

CV_TYPES = {
    "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text", "text/plain", "image/jpeg", "image/png",
}
CANDIDATE_UPLOAD_CATEGORIES = ("CV", "COVER_LETTER", "CERTIFICATE", "PORTFOLIO", "REFERENCE", "OTHER")
TOKEN_LIFETIME = timedelta(days=180)
MAX_CANDIDATE_DOCUMENTS = 10


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def public_jobs(site, *, today=None):
    today = today or timezone.localdate()
    return (
        JobPosting.objects.for_institution(site.institution)
        .filter(is_public=True, status=JobPosting.Status.OPEN)
        .filter(Q(opens_on__isnull=True) | Q(opens_on__lte=today))
        .filter(Q(closes_on__isnull=True) | Q(closes_on__gte=today))
        .select_related("department", "location", "position")
        .order_by("closes_on", "title")
    )


def _check_file(uploaded_file, *, field):
    max_bytes = min(settings.DOCUMENT_UPLOAD_MAX_BYTES, 10 * 1024 * 1024)
    if uploaded_file is None:
        raise ValidationError({field: "Attach your file."})
    if uploaded_file.size > max_bytes:
        raise ValidationError({field: f"Files must be {max_bytes // (1024 * 1024)} MB or smaller."})
    name = (uploaded_file.name or "document").replace("\\", "/").rsplit("/", 1)[-1][:255] or "document"
    content_type = (uploaded_file.content_type or "").lower().split(";")[0].strip()
    if not content_type or content_type == "application/octet-stream":
        content_type = mimetypes.guess_type(name)[0] or ""
    if content_type not in CV_TYPES:
        raise ValidationError({field: "Upload a PDF, Word document, text file or image."})
    return name, content_type


def _store_document(application, uploaded_file, category, *, field="file"):
    from apps.documents.models import Document

    name, content_type = _check_file(uploaded_file, field=field)
    return Document.objects.create(
        institution=application.institution, uploaded_by=None, stored_file=uploaded_file, original_filename=name,
        content_type=content_type[:150], size_bytes=uploaded_file.size, category=category,
        classification=Document.Classification.CONFIDENTIAL, entity_type="recruitment.Candidate", entity_id=application.candidate_id,
        file_reference=f"application:{application.id}",
    )


def issue_token(application):
    token = secrets.token_urlsafe(32)
    CandidateAccessToken.objects.create(
        institution=application.institution, application=application, token_hash=hash_token(token), expires_at=timezone.now() + TOKEN_LIFETIME,
    )
    return token


def application_for_token(token):
    """The application a tracking link opens, or None when the link is unknown or expired."""
    if not token or len(token) > 100:
        return None
    access = CandidateAccessToken.objects.select_related("application__job_posting", "application__candidate", "application__institution").filter(
        token_hash=hash_token(token), expires_at__gt=timezone.now(),
    ).first()
    if access is None:
        return None
    CandidateAccessToken.objects.filter(pk=access.pk).update(last_used_at=timezone.now())
    return access.application


@transaction.atomic
def apply(*, site, job, values, cv, client_ip=""):
    """Creates the application from the public form; returns ``(application, token)``."""
    if not job.is_public or job.status != JobPosting.Status.OPEN or job.institution_id != site.institution_id:
        raise ValidationError({"job": "This job is no longer taking applications."})
    today = timezone.localdate()
    if (job.opens_on and job.opens_on > today) or (job.closes_on and job.closes_on < today):
        raise ValidationError({"job": "This job is no longer taking applications."})
    _check_file(cv, field="cv")
    stage = RecruitmentStage.objects.for_institution(site.institution).filter(is_active=True).order_by("sequence").first()
    if stage is None:
        raise ValidationError({"job": "This job is not taking applications right now."})
    email = values["email"].strip().lower()
    candidate = Candidate.objects.for_institution(site.institution).filter(email__iexact=email).first()
    profile_fields = ("first_name", "last_name", "phone", "location", "linkedin_url", "current_title", "current_employer", "years_experience", "highest_qualification")
    if candidate is None:
        candidate = Candidate(institution=site.institution, email=email, source="Careers site", **{field: values.get(field) for field in profile_fields if values.get(field) not in (None, "")})
        candidate.save()
    else:
        # Never overwrite what HR or an earlier application recorded; only fill gaps.
        changed = [field for field in profile_fields if values.get(field) not in (None, "") and not getattr(candidate, field)]
        for field in changed:
            setattr(candidate, field, values[field])
        if changed:
            candidate.save()
    if Application.objects.filter(job_posting=job, candidate=candidate).exists():
        raise ValidationError({"email": "An application with this email address has already been made for this job. Use the tracking link you were sent."})
    snapshot = {field: values.get(field) for field in (*profile_fields, "email")}
    application = Application(
        institution=site.institution, job_posting=job, candidate=candidate, current_stage=stage, status=Application.Status.ACTIVE,
        applied_at=timezone.now(), source=Application.Source.CAREERS_SITE, cover_letter=(values.get("cover_letter") or "").strip(),
        applicant_details={key: value for key, value in snapshot.items() if value not in (None, "")}, consent_at=timezone.now(),
    )
    application.save()
    ApplicationStageHistory.objects.create(institution=site.institution, application=application, to_stage=stage, changed_by=None, comment="Applied on the careers site")
    _store_document(application, cv, "CV", field="cv")
    token = issue_token(application)
    record_audit_event(actor=None, institution=site.institution, entity=application, action="recruitment.application.public_submitted", metadata={"job_posting_id": str(job.id), "ip": client_ip})
    _notify_hiring_team(application)
    return application, token


def _notify_hiring_team(application):
    from apps.notifications.models import Notification

    job = application.job_posting
    if job.hiring_manager_id:
        Notification.objects.create(
            institution=application.institution, user=job.hiring_manager, notification_type="RECRUITMENT_APPLICATION_SUBMITTED",
            title="New application from the careers site", message=f"{application.candidate.full_name} applied for {job.title}.",
            channel=Notification.Channel.IN_APP, metadata={"application_id": str(application.id), "route_hint": f"/recruitment/applications/{application.id}"},
        )


CANDIDATE_STATUS = {
    Application.Status.ACTIVE: ("IN_REVIEW", "In review"),
    Application.Status.OFFERED: ("OFFER", "Offer made"),
    Application.Status.HIRED: ("HIRED", "Hired"),
    Application.Status.REJECTED: ("CLOSED", "Not progressing"),
    Application.Status.WITHDRAWN: ("WITHDRAWN", "Withdrawn"),
    Application.Status.DRAFT: ("RECEIVED", "Received"),
}


def tracking_view(application):
    """What the candidate sees: friendly status, upcoming interviews and their own documents. No internal notes."""
    from apps.documents.models import Document

    code, label = CANDIDATE_STATUS.get(application.status, ("IN_REVIEW", "In review"))
    interviews = application.interviews.filter(status=Interview.Status.SCHEDULED, scheduled_at__gte=timezone.now() - timedelta(hours=2)).order_by("scheduled_at")
    if any(interview for interview in interviews) and code == "IN_REVIEW":
        code, label = "INTERVIEW", "Interview"
    documents = Document.objects.filter(institution=application.institution, entity_type="recruitment.Candidate", entity_id=application.candidate_id, file_reference=f"application:{application.id}", is_active=True)
    return {
        "organisation": application.institution.name,
        "job": {"title": application.job_posting.title, "code": application.job_posting.code},
        "applied_at": application.applied_at,
        "status": code,
        "status_label": label,
        "can_withdraw": application.status in (Application.Status.ACTIVE, Application.Status.DRAFT),
        "can_upload": application.status in (Application.Status.ACTIVE, Application.Status.OFFERED) and documents.count() < MAX_CANDIDATE_DOCUMENTS,
        "interviews": [
            {
                "id": str(interview.id), "scheduled_at": interview.scheduled_at, "duration_minutes": interview.duration_minutes,
                "mode": interview.get_mode_display() if interview.mode else "", "where": interview.location_or_link, "time_zone": interview.time_zone,
                "message": interview.candidate_message, "response": interview.invitation_status,
            }
            for interview in interviews
        ],
        "documents": [{"id": str(document.id), "name": document.original_filename, "category": document.category, "uploaded_at": document.created_at} for document in documents],
    }


@transaction.atomic
def candidate_upload(*, application, uploaded_file, category):
    from apps.documents.models import Document

    if category not in CANDIDATE_UPLOAD_CATEGORIES:
        raise ValidationError({"category": "Choose a document type."})
    if application.status not in (Application.Status.ACTIVE, Application.Status.OFFERED):
        raise ValidationError({"file": "This application is closed."})
    count = Document.objects.filter(entity_type="recruitment.Candidate", entity_id=application.candidate_id, file_reference=f"application:{application.id}", is_active=True).count()
    if count >= MAX_CANDIDATE_DOCUMENTS:
        raise ValidationError({"file": f"You can send up to {MAX_CANDIDATE_DOCUMENTS} documents."})
    document = _store_document(application, uploaded_file, category)
    record_audit_event(actor=None, institution=application.institution, entity=application, action="recruitment.application.candidate_document_added", metadata={"document_id": str(document.id), "category": category})
    return document


@transaction.atomic
def candidate_withdraw(*, application):
    application = Application.objects.select_for_update().get(pk=application.pk)
    if application.status not in (Application.Status.ACTIVE, Application.Status.DRAFT):
        raise ValidationError({"application": "This application can no longer be withdrawn."})
    application.status = Application.Status.WITHDRAWN
    application.withdrawn_at = timezone.now()
    application.save(update_fields=("status", "withdrawn_at", "updated_at"))
    record_audit_event(actor=None, institution=application.institution, entity=application, action="recruitment.application.candidate_withdrew", metadata={})
    return application


@transaction.atomic
def candidate_respond_to_interview(*, application, interview_id, accept, note=""):
    interview = application.interviews.select_for_update().filter(pk=interview_id, status=Interview.Status.SCHEDULED).first()
    if interview is None:
        raise ValidationError({"interview": "This interview is no longer scheduled."})
    interview.invitation_status = "ACCEPTED" if accept else "DECLINED"
    if note:
        interview.notes = (interview.notes + f"\nCandidate: {note.strip()[:500]}").strip()
    interview.save(update_fields=("invitation_status", "notes", "updated_at"))
    record_audit_event(actor=None, institution=application.institution, entity=interview, action="recruitment.interview.candidate_responded", metadata={"response": interview.invitation_status})
    if interview.interviewer_id:
        from apps.notifications.models import Notification

        Notification.objects.create(
            institution=application.institution, user=interview.interviewer, notification_type="RECRUITMENT_INTERVIEW_RESPONSE",
            title=f"Interview {'confirmed' if accept else 'declined'}", message=f"{application.candidate.full_name} {'confirmed' if accept else 'declined'} the interview on {interview.scheduled_at:%d %b %H:%M}." + (f" Note: {note.strip()[:200]}" if note else ""),
            channel=Notification.Channel.IN_APP, metadata={"application_id": str(application.id), "route_hint": f"/recruitment/applications/{application.id}"},
        )
    return interview


def site_for_slug(slug):
    # The site is live only while the institution is active and uses the recruitment module.
    return CareersSite.objects.select_related("institution").filter(
        slug=(slug or "").lower(), is_enabled=True, institution__is_active=True,
        institution__modules__module_code="RECRUITMENT", institution__modules__is_enabled=True,
    ).first()
