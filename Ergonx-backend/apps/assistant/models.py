"""Conversations with the ErgonX assistant.

``api_messages`` keeps the exact Messages API messages of each turn (including
thinking, tool calls and tool results), so the conversation is replayed to the
model unchanged and append-only.
``text`` is what people see.
"""

from django.conf import settings
from django.db import models

from apps.institutions.models import Institution
from common.models import TenantOwnedModel


class AssistantConversation(TenantOwnedModel):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="assistant_conversations")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assistant_conversations")
    title = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ("-updated_at",)
        indexes = [models.Index(fields=("institution", "user", "updated_at"))]


class AssistantMessage(TenantOwnedModel):
    class Role(models.TextChoices):
        USER = "user", "You"
        ASSISTANT = "assistant", "Assistant"

    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="assistant_messages")
    conversation = models.ForeignKey(AssistantConversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10, choices=Role.choices)
    # The API messages this turn added: one for a question, several for an answer that used tools.
    api_messages = models.JSONField(default=list)
    text = models.TextField(blank=True)
    # Displayed under an answer: which ErgonX records it read.
    tools_used = models.JSONField(default=list, blank=True)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("conversation", "created_at")
