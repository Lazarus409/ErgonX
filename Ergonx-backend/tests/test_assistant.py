"""The ErgonX assistant (Future additions item 3), with Claude replaced by a scripted fake."""
import json
from datetime import timedelta
from decimal import Decimal

import pytest
from anthropic.types.beta import BetaMessage
from django.utils import timezone
from rest_framework.test import APIClient

from apps.assistant import services
from apps.assistant.models import AssistantConversation
from apps.audit.models import AuditLog
from apps.institutions.models import InstitutionModule, InstitutionSetting

pytestmark = pytest.mark.django_db
BASE = "/api/v1/assistant/"


def _message(content, stop_reason, number=1):
    return BetaMessage.model_validate({
        "id": f"msg_{number}", "type": "message", "role": "assistant", "model": "claude-opus-5-5", "content": content,
        "stop_reason": stop_reason, "stop_sequence": None, "usage": {"input_tokens": 100, "output_tokens": 20},
    })


class FakeClaude:
    """Returns scripted responses and records every request it was sent."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []
        self.beta = self
        self.messages = self

    def create(self, **kwargs):
        self.requests.append(json.loads(json.dumps(kwargs, default=str)))
        return self.responses.pop(0)


@pytest.fixture
def org(institution_factory, user_factory, membership_factory, employee_factory, settings):
    settings.ANTHROPIC_API_KEY = "test-key"
    institution = institution_factory(code="ASK")
    institution.modules.filter(module_code=InstitutionModule.ModuleCode.LEAVE).update(is_enabled=True)
    admin = user_factory(email="admin@ask.example")
    membership_factory(user=admin, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    staff = user_factory(email="staff@ask.example", first_name="Ama", last_name="Owusu")
    membership_factory(user=staff, institution=institution, role_code="EMPLOYEE", is_primary=True)
    employee = employee_factory(institution, user=staff, first_name="Ama", last_name="Owusu")
    other = user_factory(email="other@ask.example")
    membership_factory(user=other, institution=institution, role_code="EMPLOYEE", is_primary=True)
    return {"institution": institution, "admin": admin, "staff": staff, "employee": employee, "other": other}


def _client(user, institution):
    client = APIClient()
    client.force_authenticate(user)
    client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))
    return client


def _enable(org):
    response = _client(org["admin"], org["institution"]).put("/api/v1/institutions/settings/", {"key": "assistant.enabled", "value": True}, format="json")
    assert response.status_code == 200, response.data


def test_assistant_is_off_until_configured_and_enabled(org, settings):
    staff = _client(org["staff"], org["institution"])
    status = staff.get(BASE + "status/").data
    assert status["configured"] is True and status["enabled"] is False
    refused = staff.post(BASE + "conversations/", {"text": "How much leave do I have?"}, format="json")
    assert refused.status_code == 400 and refused.data["code"] == "assistant_unavailable"
    assert staff.put("/api/v1/institutions/settings/", {"key": "assistant.enabled", "value": True}, format="json").status_code == 403
    _enable(org)
    assert staff.get(BASE + "status/").data["enabled"] is True
    settings.ANTHROPIC_API_KEY = ""
    assert staff.get(BASE + "status/").data == {**staff.get(BASE + "status/").data, "configured": False, "enabled": False}


def test_answer_uses_tools_as_the_asker_and_is_stored_privately(org, monkeypatch):
    from apps.leave.models import LeaveBalance, LeaveType

    _enable(org)
    leave_type = LeaveType.objects.filter(institution=org["institution"]).first() or LeaveType.objects.create(institution=org["institution"], name="Annual leave")
    LeaveBalance.objects.create(institution=org["institution"], employee=org["employee"], leave_type=leave_type, year=timezone.localdate().year, opening_balance=Decimal("20"), used=Decimal("5"))
    fake = FakeClaude([
        _message([
            {"type": "tool_use", "id": "tu_1", "name": "get_my_leave", "input": {}},
            {"type": "tool_use", "id": "tu_2", "name": "find_colleague", "input": {"name": "Kofi"}},
        ], "tool_use", 1),
        _message([{"type": "text", "text": f"You have 15 days of {leave_type.name} left."}], "end_turn", 2),
    ])
    monkeypatch.setattr(services, "_client", lambda: fake)

    staff = _client(org["staff"], org["institution"])
    created = staff.post(BASE + "conversations/", {"text": "How much leave do I have, and who is Kofi?"}, format="json")
    assert created.status_code == 201, created.data
    assert created.data["messages"][1]["text"] == f"You have 15 days of {leave_type.name} left."
    assert created.data["messages"][1]["tools_used"] == ["the staff directory", "your leave"]

    first, second = fake.requests
    assert first["model"] == "claude-opus-5-5" and first["fallbacks"] == "default" and first["thinking"] == {"type": "adaptive"}
    assert all(tool["strict"] for tool in first["tools"])
    assert "Ama Owusu" in first["messages"][0]["content"][0]["text"]  # who is asking, as context
    results = {item["tool_use_id"]: item for item in second["messages"][-1]["content"]}
    leave = json.loads(results["tu_1"]["content"])
    assert leave["balances"][0]["available_days"] == 15 and "is_error" not in results["tu_1"]
    assert results["tu_2"]["is_error"] is True and "does not have access" in results["tu_2"]["content"]  # employees have no directory access

    conversation_id = created.data["id"]
    fake.responses.append(_message([{"type": "text", "text": "Noted."}], "end_turn", 3))
    follow_up = staff.post(f"{BASE}conversations/{conversation_id}/ask/", {"text": "Thanks"}, format="json")
    assert follow_up.status_code == 201 and follow_up.data["text"] == "Noted."
    replayed = fake.requests[-1]["messages"]
    assert [message["role"] for message in replayed] == ["user", "assistant", "user", "assistant", "user"]  # history replayed unchanged

    assert _client(org["other"], org["institution"]).get(f"{BASE}conversations/{conversation_id}/").status_code == 404
    assert _client(org["admin"], org["institution"]).get(f"{BASE}conversations/{conversation_id}/").status_code == 404
    audit = AuditLog.objects.filter(action="assistant.question_answered").order_by("created_at").first()
    assert audit.metadata["tools"] == ["find_colleague", "get_my_leave"] and "Kofi" not in json.dumps(audit.metadata)


def test_daily_limit_refusal_and_retention(org, monkeypatch, settings):
    _enable(org)
    settings.ASSISTANT_DAILY_LIMIT = 1
    fake = FakeClaude([_message([], "refusal", 1)])
    monkeypatch.setattr(services, "_client", lambda: fake)
    staff = _client(org["staff"], org["institution"])
    first = staff.post(BASE + "conversations/", {"text": "Something it declines"}, format="json")
    assert first.status_code == 201 and first.data["messages"][1]["text"] == "I can't help with that request."
    limited = staff.post(BASE + "conversations/", {"text": "Another"}, format="json")
    assert limited.status_code == 400 and limited.data["code"] == "assistant_limit_reached"
    assert AssistantConversation.objects.count() == 1

    AssistantConversation.objects.update(updated_at=timezone.now() - timedelta(days=settings.ASSISTANT_RETENTION_DAYS + 1))
    assert services.purge_old_conversations() == 1 and AssistantConversation.objects.count() == 0


def test_tools_respect_scope(org, rf):
    from apps.assistant.tools import run_tool
    from apps.documents.models import Policy
    from apps.institutions.models import InstitutionMembership

    Policy.objects.create(institution=org["institution"], title="Travel policy", summary="Per diem rules", body="Per diem is 200 a day.", status=Policy.Status.PUBLISHED)
    Policy.objects.create(institution=org["institution"], title="Draft travel changes", body="Per diem rises.", status=Policy.Status.DRAFT)
    request = rf.get("/")
    request.user = org["staff"]
    request.institution = org["institution"]
    request.membership = InstitutionMembership.objects.get(user=org["staff"], institution=org["institution"])
    policies, error = run_tool(request, "search_policies", {"query": "per diem"})
    assert not error and [item["title"] for item in policies["policies"]] == ["Travel policy"]
    headcount, error = run_tool(request, "headcount_by_department", {})
    assert error is True
    profile, error = run_tool(request, "get_my_profile", {})
    assert not error and profile["name"] == "Ama Owusu"
    bad, error = run_tool(request, "who_is_on_leave", {"start_date": "2026-13-01", "end_date": None})
    assert error is True and "YYYY-MM-DD" in bad["error"]
    unknown, error = run_tool(request, "delete_everything", {})
    assert error is True
    assert not InstitutionSetting.objects.filter(institution=org["institution"], key="assistant.enabled").exists()
