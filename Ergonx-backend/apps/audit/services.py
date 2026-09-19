from apps.audit.models import AuditLog
from apps.audit.context import get_audit_request_context


def record_audit_event(
    *,
    actor,
    action,
    institution=None,
    entity=None,
    metadata=None,
    ip=None,
    user_agent=None,
):
    request_context = get_audit_request_context()
    if ip is None:
        ip = request_context["ip"]
    if user_agent is None:
        user_agent = request_context["user_agent"]
    return AuditLog.objects.create(
        institution=institution,
        actor=actor,
        action=action,
        entity_type=entity._meta.label if entity else "",
        entity_id=getattr(entity, "pk", None),
        metadata=metadata or {},
        ip_address=ip,
        user_agent=user_agent,
    )
