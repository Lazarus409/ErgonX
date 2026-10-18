"""360 feedback on performance reviews, and HR calibration of final ratings.

360 feedback: the employee or their reviewer (or HR) asks colleagues for
feedback while the review is open. Each colleague rates the cycle's
competencies 1-5 and writes strengths and suggestions. The employee and the
reviewer see averages and unattributed comments only once at least three have
responded, so no single answer can be traced back; HR sees who said what.

Calibration: while a review awaits HR sign-off, HR may set a calibrated rating
(with a reason when it differs from the manager's). The calibrated rating is
the review's final rating from then on.
"""

import hashlib

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.institutions.models import InstitutionMembership
from apps.notifications.models import Notification
from apps.performance.models import FeedbackRating, FeedbackRequest, PerformanceReview, ReviewCycle

Status = PerformanceReview.Status


def _notify(user, review, notification_type, title, message, route):
    if user is None:
        return
    Notification.objects.create(
        institution=review.institution, user=user, notification_type=notification_type, title=title, message=message,
        channel=Notification.Channel.IN_APP, metadata={"performance_review_id": str(review.id), "route_hint": route},
    )


def _open(review):
    if review.status not in PerformanceReview.OPEN_STATUSES or review.cycle.status != ReviewCycle.Status.ACTIVE:
        raise ValidationError({"review": "Feedback can only be gathered while the review is open."})


def can_request(review, user, *, is_hr_manager):
    return is_hr_manager or user.id in (review.employee.user_id, review.reviewer_id)


@transaction.atomic
def request_feedback(*, review, actor, respondents, relationship, is_hr_manager):
    review = PerformanceReview.objects.select_related("cycle", "employee").get(pk=review.pk)
    if not can_request(review, actor, is_hr_manager=is_hr_manager):
        raise ValidationError({"review": "Only the employee, their reviewer or HR can ask for feedback."})
    _open(review)
    existing = set(review.feedback_requests.values_list("respondent_id", flat=True))
    new = [user for user in dict.fromkeys(respondents) if user.id not in existing]
    if len(existing) + len(new) > FeedbackRequest.MAX_PER_REVIEW:
        raise ValidationError({"respondents": f"Ask at most {FeedbackRequest.MAX_PER_REVIEW} people per review."})
    active = set(InstitutionMembership.objects.filter(institution=review.institution, status=InstitutionMembership.Status.ACTIVE, user__in=new).values_list("user_id", flat=True))
    created = []
    for user in new:
        if user.id == review.employee.user_id:
            raise ValidationError({"respondents": "Employees don't give 360 feedback on themselves."})
        if user.id not in active:
            raise ValidationError({"respondents": f"{user.get_full_name() or user.email} isn't an active member."})
        request = FeedbackRequest(institution=review.institution, review=review, respondent=user, relationship=relationship, requested_by=actor)
        request.save()
        created.append(request)
        _notify(user, review, "PERFORMANCE_FEEDBACK_REQUESTED", "Feedback requested", f"Share feedback on {review.employee.full_name} for {review.cycle.name}.", "/feedback")
    if created:
        record_audit_event(actor=actor, institution=review.institution, entity=review, action="performance.feedback.requested", metadata={"count": len(created), "employee_id": str(review.employee_id)})
    return created


def _lock(request):
    return FeedbackRequest.objects.select_for_update(of=("self",)).select_related("review__cycle", "review__employee").get(pk=request.pk)


@transaction.atomic
def submit_feedback(*, request, actor, ratings, strengths, improvements):
    request = _lock(request)
    if request.respondent_id != actor.id:
        raise ValidationError({"request": "This feedback request is for someone else."})
    if request.status != FeedbackRequest.Status.PENDING:
        raise ValidationError({"request": "This feedback has already been answered."})
    _open(request.review)
    allowed = {str(pk): pk for pk in request.review.cycle.competencies.values_list("id", flat=True)}
    if not (strengths or "").strip() and not (improvements or "").strip() and not ratings:
        raise ValidationError({"strengths": "Rate at least one competency or write a comment."})
    for competency_id, rating in (ratings or {}).items():
        if str(competency_id) not in allowed:
            raise ValidationError({"ratings": "Rate only this cycle's competencies."})
        FeedbackRating(institution=request.institution, request=request, competency_id=allowed[str(competency_id)], rating=rating).save()
    request.strengths = (strengths or "").strip()
    request.improvements = (improvements or "").strip()
    request.status = FeedbackRequest.Status.SUBMITTED
    request.submitted_at = timezone.now()
    request.save()
    # The audit trail records that feedback was given, never its content.
    record_audit_event(actor=actor, institution=request.institution, entity=request, action="performance.feedback.submitted", metadata={"review_id": str(request.review_id)})
    return request


@transaction.atomic
def decline_feedback(*, request, actor):
    request = _lock(request)
    if request.respondent_id != actor.id or request.status != FeedbackRequest.Status.PENDING:
        raise ValidationError({"request": "You can only decline a request waiting for you."})
    request.status = FeedbackRequest.Status.DECLINED
    request.save(update_fields=("status", "updated_at"))
    record_audit_event(actor=actor, institution=request.institution, entity=request, action="performance.feedback.declined", metadata={"review_id": str(request.review_id)})
    return request


def feedback_summary(review, *, show_names):
    """What a viewer may see of a review's 360 feedback."""
    requests = list(review.feedback_requests.select_related("respondent").prefetch_related("ratings__competency"))
    submitted = [request for request in requests if request.status == FeedbackRequest.Status.SUBMITTED]
    summary = {
        "requested": len(requests),
        "submitted": len(submitted),
        "declined": sum(1 for request in requests if request.status == FeedbackRequest.Status.DECLINED),
        "min_responses": FeedbackRequest.MIN_ANONYMOUS_RESPONSES,
        "visible": show_names or len(submitted) >= FeedbackRequest.MIN_ANONYMOUS_RESPONSES,
        "competencies": [],
        "comments": [],
        "respondents": [],
    }
    if show_names:
        summary["respondents"] = [
            {"id": str(request.id), "name": request.respondent.get_full_name() or request.respondent.email, "relationship": request.get_relationship_display(), "status": request.status}
            for request in requests
        ]
    if not summary["visible"]:
        return summary
    by_competency = {}
    for request in submitted:
        for rating in request.ratings.all():
            by_competency.setdefault((rating.competency.sort_order, rating.competency.name), []).append(rating.rating)
    summary["competencies"] = [
        {"competency": name, "average": round(sum(values) / len(values), 2), "responses": len(values)}
        for (_, name), values in sorted(by_competency.items())
    ]
    # A stable order that doesn't follow submission order, so comments can't be matched to people by timing.
    ordered = sorted(submitted, key=lambda request: hashlib.sha256(str(request.id).encode()).hexdigest())
    summary["comments"] = [
        {
            "strengths": request.strengths, "improvements": request.improvements,
            **({"name": request.respondent.get_full_name() or request.respondent.email, "relationship": request.get_relationship_display()} if show_names else {}),
        }
        for request in ordered if request.strengths or request.improvements
    ]
    return summary


@transaction.atomic
def calibrate(*, review, actor, rating, note):
    review = PerformanceReview.objects.select_for_update(of=("self",)).select_related("cycle", "employee").get(pk=review.pk)
    if review.status != Status.HR_REVIEW:
        raise ValidationError({"status": "Ratings are calibrated while the review awaits HR sign-off."})
    if review.employee.user_id == actor.id:
        raise ValidationError({"review": "You can't calibrate your own rating."})
    note = (note or "").strip()
    if rating is not None and rating != review.overall_rating and not note:
        raise ValidationError({"note": "Explain why the rating differs from the manager's."})
    previous = review.calibrated_rating
    review.calibrated_rating = rating if rating != review.overall_rating else None
    review.calibration_note = note if review.calibrated_rating else ""
    review.calibrated_by = actor if review.calibrated_rating else None
    review.calibrated_at = timezone.now() if review.calibrated_rating else None
    review.save()
    record_audit_event(
        actor=actor, institution=review.institution, entity=review, action="performance.review.calibrated",
        metadata={"cycle": review.cycle.name, "employee_id": str(review.employee_id), "manager_rating": review.overall_rating, "changes": {"calibrated_rating": [previous, review.calibrated_rating]}, "note": review.calibration_note},
    )
    return review


def calibration_board(reviews):
    """Reviews ready for or past calibration with manager and final ratings, plus both distributions."""
    from apps.employees.models import Employment

    rows = list(reviews.filter(status__in=(Status.HR_REVIEW, Status.COMPLETED)).select_related("employee", "reviewer"))
    departments = dict(Employment.objects.filter(employee__in=[row.employee_id for row in rows], is_current=True).values_list("employee_id", "department__name"))
    distribution = {"manager": [0] * 5, "final": [0] * 5}
    for row in rows:
        if row.overall_rating:
            distribution["manager"][row.overall_rating - 1] += 1
        if row.final_rating:
            distribution["final"][row.final_rating - 1] += 1
    return {
        "reviews": [
            {
                "id": str(row.id), "employee": row.employee.full_name, "department": departments.get(row.employee_id) or "Unassigned",
                "reviewer": (row.reviewer.get_full_name() or row.reviewer.email) if row.reviewer else "", "status": row.status,
                "manager_rating": row.overall_rating, "calibrated_rating": row.calibrated_rating, "final_rating": row.final_rating,
                "calibration_note": row.calibration_note,
            }
            for row in sorted(rows, key=lambda row: (departments.get(row.employee_id) or "", row.employee.full_name))
        ],
        "distribution": [{"rating": value, "manager": distribution["manager"][value - 1], "final": distribution["final"][value - 1]} for value in range(1, 6)],
    }

