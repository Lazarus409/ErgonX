"""Document signature requests (employees) and offer acceptance (candidates).

Signatures are typed names, recorded with the time, IP address and browser, and
for documents the SHA-256 of the exact file signed. This is an electronic
signature in the ordinary sense (intent shown by a signed-in or link-holding
person typing their name); it is not a certificate-based digital signature.
"""

import hashlib
import re

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.context import get_audit_request_context
from apps.audit.services import record_audit_event
from apps.documents.models import EMPLOYEE_ENTITY_TYPE, Document, SignatureRequest
from apps.documents.policies import accepted_signatures


def file_sha256(document):
    if not document.stored_file:
        raise ValidationError({"document": "This document has no stored file to sign."})
    digest = hashlib.sha256()
    with document.stored_file.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _clean_name(name):
    return re.sub(r"\s+", " ", name or "").strip()


def _evidence():
    context = get_audit_request_context()
    return context["ip"], (context["user_agent"] or "")[:500]


def _notify(user, request, title, message, route):
    from apps.notifications.models import Notification

    if user is None:
        return
    Notification.objects.create(
        institution=request.institution, user=user, notification_type="DOCUMENT_SIGNATURE", title=title, message=message,
        channel=Notification.Channel.IN_APP, metadata={"signature_request_id": str(request.id), "employee_id": str(request.employee_id), "route_hint": route},
    )


@transaction.atomic
def request_signature(*, institution, document, employee, actor, title, message="", due_date=None):
    if document.institution_id != institution.id or not document.is_active:
        raise ValidationError({"document": "Choose an active document."})
    if document.entity_type == EMPLOYEE_ENTITY_TYPE and document.entity_id and document.entity_id != employee.id:
        raise ValidationError({"document": "This document belongs to another employee's record."})
    if employee.user_id is None:
        raise ValidationError({"employee": "This employee has no ErgonX account to sign with yet."})
    if employee.user_id == actor.id:
        raise ValidationError({"employee": "You can't send a document to yourself for signature."})
    if SignatureRequest.objects.filter(document=document, employee=employee, status=SignatureRequest.Status.PENDING).exists():
        raise ValidationError({"document": "This document is already waiting for their signature."})
    request = SignatureRequest(
        institution=institution, document=document, employee=employee, title=(title or document.original_filename).strip()[:150],
        message=(message or "").strip(), due_date=due_date, requested_by=actor, document_sha256=file_sha256(document),
    )
    request.save()
    record_audit_event(actor=actor, institution=institution, entity=request, action="document.signature.requested", metadata={"document_id": str(document.id), "employee_id": str(employee.id), "sha256": request.document_sha256})
    _notify(employee.user, request, "Document to sign", f"{request.title} is waiting for your signature.", "/me/documents")
    return request


def _locked(request):
    return SignatureRequest.objects.select_for_update(of=("self",)).select_related("employee", "document").get(pk=request.pk)


@transaction.atomic
def sign(*, request, user, signed_name):
    request = _locked(request)
    if request.employee.user_id != user.id:
        raise ValidationError({"request": "This document was sent to someone else."})
    if request.status != SignatureRequest.Status.PENDING:
        raise ValidationError({"request": "This request is no longer waiting for a signature."})
    if _clean_name(signed_name).casefold() not in accepted_signatures(request.employee):
        raise ValidationError({"signed_name": f"Type your full name as it appears on your record ({request.employee.first_name} {request.employee.last_name})."})
    if file_sha256(request.document) != request.document_sha256:
        raise ValidationError({"document": "The document changed after it was sent. Ask HR to send it again."})
    request.status = SignatureRequest.Status.SIGNED
    request.signed_name = _clean_name(signed_name)
    request.signed_at = timezone.now()
    request.signed_by = user
    request.ip_address, request.user_agent = _evidence()
    request.save()
    record_audit_event(actor=user, institution=request.institution, entity=request, action="document.signature.signed", metadata={"document_id": str(request.document_id), "sha256": request.document_sha256})
    _notify(request.requested_by, request, "Document signed", f"{request.employee.full_name} signed {request.title}.", f"/hr/employees/{request.employee_id}?tab=documents")
    return request


@transaction.atomic
def decline(*, request, user, reason):
    request = _locked(request)
    if request.employee.user_id != user.id or request.status != SignatureRequest.Status.PENDING:
        raise ValidationError({"request": "You can only decline a document waiting for your signature."})
    if not (reason or "").strip():
        raise ValidationError({"reason": "Tell HR why you are not signing."})
    request.status = SignatureRequest.Status.DECLINED
    request.decline_reason = reason.strip()
    request.save(update_fields=("status", "decline_reason", "updated_at"))
    record_audit_event(actor=user, institution=request.institution, entity=request, action="document.signature.declined", metadata={"reason": request.decline_reason})
    _notify(request.requested_by, request, "Signature declined", f"{request.employee.full_name} declined to sign {request.title}: {request.decline_reason}", f"/hr/employees/{request.employee_id}?tab=documents")
    return request


@transaction.atomic
def cancel(*, request, actor):
    request = _locked(request)
    if request.status != SignatureRequest.Status.PENDING:
        raise ValidationError({"request": "Only a request waiting for a signature can be cancelled."})
    request.status = SignatureRequest.Status.CANCELLED
    request.save(update_fields=("status", "updated_at"))
    record_audit_event(actor=actor, institution=request.institution, entity=request, action="document.signature.cancelled", metadata={})
    return request


def certificate(request):
    """A plain-text record of the signature, for printing or attaching to the file."""
    lines = [
        f"Signature record: {request.title}",
        f"Organisation: {request.institution.name}",
        f"Document: {request.document.original_filename}",
        f"Document SHA-256: {request.document_sha256}",
        f"Employee: {request.employee.full_name} ({request.employee.employee_number})",
        f"Requested: {request.created_at:%Y-%m-%d %H:%M %Z}" + (f" by {request.requested_by.get_full_name() or request.requested_by.email}" if request.requested_by else ""),
        f"Status: {request.get_status_display()}",
    ]
    if request.status == SignatureRequest.Status.SIGNED:
        lines += [
            f"Signed as: {request.signed_name}",
            f"Signed at: {request.signed_at:%Y-%m-%d %H:%M:%S %Z}",
            f"IP address: {request.ip_address or 'not recorded'}",
            f"Browser: {request.user_agent or 'not recorded'}",
        ]
    if request.status == SignatureRequest.Status.DECLINED:
        lines.append(f"Declined: {request.decline_reason}")
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------- offers


@transaction.atomic
def candidate_answer_offer(*, application, accept, signed_name="", note=""):
    """A candidate accepts (signing with their name) or declines their offer from the tracking link."""
    from apps.recruitment.models import Offer

    offer = Offer.objects.select_for_update().select_related("application__candidate").filter(application=application).first()
    if offer is None or offer.status != Offer.Status.EXTENDED:
        raise ValidationError({"offer": "There is no offer waiting for your answer."})
    if offer.expires_on and offer.expires_on < timezone.localdate():
        raise ValidationError({"offer": "This offer has expired. Contact the employer."})
    candidate = offer.application.candidate
    now = timezone.now()
    if accept:
        expected = {_clean_name(f"{candidate.first_name} {candidate.last_name}").casefold()}
        if candidate.middle_name:
            expected.add(_clean_name(f"{candidate.first_name} {candidate.middle_name} {candidate.last_name}").casefold())
        if _clean_name(signed_name).casefold() not in expected:
            raise ValidationError({"signed_name": f"Type your full name as given in your application ({candidate.first_name} {candidate.last_name})."})
        offer.status = Offer.Status.ACCEPTED
        offer.accepted_at = now
        offer.candidate_signed_name = _clean_name(signed_name)
        offer.candidate_signed_at = now
        offer.candidate_signature_ip, offer.candidate_signature_user_agent = _evidence()
    else:
        offer.status = Offer.Status.DECLINED
        offer.declined_at = now
    offer.response_note = (note or "").strip()[:2000]
    offer.save()
    record_audit_event(actor=None, institution=offer.institution, entity=offer, action=f"recruitment.offer.candidate_{'accepted' if accept else 'declined'}", metadata={"via": "tracking_link"})
    job = offer.application.job_posting
    if job.hiring_manager_id:
        from apps.notifications.models import Notification

        Notification.objects.create(
            institution=offer.institution, user=job.hiring_manager, notification_type="RECRUITMENT_OFFER_ANSWERED",
            title=f"Offer {'accepted' if accept else 'declined'}", message=f"{candidate.full_name} {'accepted and signed' if accept else 'declined'} the offer for {job.title}.",
            channel=Notification.Channel.IN_APP, metadata={"application_id": str(application.id), "route_hint": f"/recruitment/candidates/{candidate.id}?application={application.id}"},
        )
    return offer
