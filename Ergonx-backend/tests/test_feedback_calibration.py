from datetime import date

import pytest

from apps.employees.models import Employment
from apps.performance.models import Competency, PerformanceReview, ReviewCycle
from apps.performance.services import launch_cycle


pytestmark = pytest.mark.django_db


def _as(client, user, institution):
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


@pytest.fixture
def setup(api_client, institution_factory, user_factory, membership_factory, organization_factory, assignment_dimensions_factory, employee_factory):
    institution = institution_factory(code="FEEDBACK")
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    department, position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)

    def person(first, reports_to=None):
        user = user_factory()
        membership_factory(user=user, institution=institution, role_code="EMPLOYEE", is_primary=True)
        employee = employee_factory(institution, user=user, first_name=first, last_name="Test")
        employment = Employment.objects.create(
            institution=institution, employee=employee, department=department, position=position, grade=grade, location=location,
            employment_type=Employment.EmploymentType.PERMANENT, start_date=date(2026, 1, 5), is_current=True, reports_to=reports_to,
        )
        return user, employee, employment

    manager_user, manager, manager_employment = person("Manager")
    staff_user, staff, _ = person("Staff", reports_to=manager_employment)
    peers = [person(f"Peer{index}")[0] for index in range(4)]
    teamwork = Competency.objects.create(institution=institution, name="Teamwork", sort_order=1)
    delivery = Competency.objects.create(institution=institution, name="Delivery", sort_order=2)
    cycle = ReviewCycle.objects.create(institution=institution, name="H2 2026", period_start=date(2026, 7, 1), period_end=date(2026, 12, 31))
    cycle.competencies.set([teamwork, delivery])
    launch_cycle(cycle=cycle, actor=hr, employees=[staff])
    review = PerformanceReview.objects.get(cycle=cycle, employee=staff)
    assert review.reviewer == manager_user
    return {"client": api_client, "institution": institution, "hr": hr, "manager": manager_user, "staff": staff_user, "peers": peers, "review": review, "cycle": cycle, "competencies": (teamwork, delivery)}


def _ask(setup, actor, people):
    client = setup["client"]
    _as(client, actor, setup["institution"])
    return client.post(f"/api/v1/performance-reviews/{setup['review'].id}/feedback/", {"respondents": [str(user.id) for user in people], "relationship": "PEER"}, format="json")


def _give(setup, user, teamwork, delivery, strengths):
    client = setup["client"]
    _as(client, user, setup["institution"])
    item = client.get("/api/v1/feedback-requests/").data["results"][0]
    assert item["open"] is True and [row["name"] for row in item["competencies"]] == ["Teamwork", "Delivery"]
    ids = {row["name"]: row["id"] for row in item["competencies"]}
    return client.post(f"/api/v1/feedback-requests/{item['id']}/submit/", {"ratings": {ids["Teamwork"]: teamwork, ids["Delivery"]: delivery}, "strengths": strengths, "improvements": "Write more docs"}, format="json")


def test_feedback_is_anonymous_until_three_responses(setup):
    asked = _ask(setup, setup["staff"], setup["peers"][:3])
    assert asked.status_code == 200, asked.data
    assert asked.data["requested"] == 3 and asked.data["visible"] is False
    # Self-nomination is refused.
    assert _ask(setup, setup["staff"], [setup["staff"]]).status_code == 400

    for user, rating in zip(setup["peers"][:2], (4, 2)):
        assert _give(setup, user, rating, 3, f"Strength from {user.email}").status_code == 200
    client = setup["client"]
    _as(client, setup["staff"], setup["institution"])
    hidden = client.get(f"/api/v1/performance-reviews/{setup['review'].id}/feedback/").data
    assert hidden["submitted"] == 2 and hidden["visible"] is False and hidden["comments"] == []

    _give(setup, setup["peers"][2], 3, 5, "Calm under pressure")
    _as(client, setup["manager"], setup["institution"])
    shown = client.get(f"/api/v1/performance-reviews/{setup['review'].id}/feedback/").data
    assert shown["visible"] is True
    assert {row["competency"]: row["average"] for row in shown["competencies"]} == {"Teamwork": 3.0, "Delivery": 3.67}
    assert all("name" not in comment for comment in shown["comments"]) and shown["respondents"] == []

    _as(client, setup["hr"], setup["institution"])
    named = client.get(f"/api/v1/performance-reviews/{setup['review'].id}/feedback/").data
    assert len(named["respondents"]) == 3 and all("name" in comment for comment in named["comments"])


def test_respondents_answer_once_and_can_decline(setup):
    _ask(setup, setup["manager"], setup["peers"][:2])
    assert _give(setup, setup["peers"][0], 4, 4, "Great").status_code == 200
    client = setup["client"]
    item = client.get("/api/v1/feedback-requests/").data["results"][0]
    assert client.post(f"/api/v1/feedback-requests/{item['id']}/submit/", {"strengths": "Again"}, format="json").status_code == 400
    _as(client, setup["peers"][1], setup["institution"])
    pending = client.get("/api/v1/feedback-requests/").data["results"][0]
    assert client.post(f"/api/v1/feedback-requests/{pending['id']}/decline/", format="json").data["status"] == "DECLINED"
    # Others can't see or answer someone else's request.
    _as(client, setup["peers"][2], setup["institution"])
    assert client.get("/api/v1/feedback-requests/").data["count"] == 0
    assert client.post(f"/api/v1/feedback-requests/{pending['id']}/submit/", {"strengths": "x"}, format="json").status_code == 404
    # A colleague who isn't the employee, reviewer or HR can't ask for feedback.
    assert _ask(setup, setup["peers"][2], [setup["peers"][3]]).status_code == 404  # They cannot even see the review.


def test_calibration_changes_the_final_rating(setup):
    review = setup["review"]
    PerformanceReview.objects.filter(pk=review.pk).update(status=PerformanceReview.Status.HR_REVIEW, overall_rating=5)
    client = setup["client"]
    _as(client, setup["hr"], setup["institution"])
    url = f"/api/v1/performance-reviews/{review.id}/calibrate/"
    assert client.post(url, {"rating": 4}, format="json").status_code == 400  # A reason is required.
    calibrated = client.post(url, {"rating": 4, "note": "Aligned with department distribution"}, format="json")
    assert calibrated.status_code == 200, calibrated.data
    assert calibrated.data["final_rating"] == 4 and calibrated.data["calibrated_rating"] == 4
    board = client.get(f"/api/v1/review-cycles/{setup['cycle'].id}/calibration/").data
    assert board["reviews"][0]["manager_rating"] == 5 and board["reviews"][0]["final_rating"] == 4
    assert {row["rating"]: (row["manager"], row["final"]) for row in board["distribution"]}[4] == (0, 1)

    # The employee doesn't see HR's reasons, nor the rating before sign-off.
    _as(client, setup["staff"], setup["institution"])
    mine = client.get(f"/api/v1/performance-reviews/{review.id}/").data
    assert mine["final_rating"] is None and mine["calibration_note"] == ""

    _as(client, setup["hr"], setup["institution"])
    signed = client.post(f"/api/v1/performance-reviews/{review.id}/sign-off/", {}, format="json")
    assert signed.status_code == 200
    _as(client, setup["staff"], setup["institution"])
    mine = client.get(f"/api/v1/performance-reviews/{review.id}/").data
    assert mine["final_rating"] == 4 and mine["overall_rating"] == 5 and mine["calibration_note"] == ""

    # Calibrating needs the review to be waiting for HR.
    _as(client, setup["hr"], setup["institution"])
    assert client.post(url, {"rating": 3, "note": "x"}, format="json").status_code == 400
