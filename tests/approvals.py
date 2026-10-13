"""Separation of duties in tests: whoever prepares a record does not approve it."""
from apps.accounts.models import User
from apps.institutions.models import InstitutionMembership


def second_approver(preparer, role_code="FINANCE_MANAGER"):
    """An active member of the preparer's institution, other than the preparer, holding ``role_code``."""
    membership = preparer.memberships.filter(status=InstitutionMembership.Status.ACTIVE).select_related("institution").first()
    institution = membership.institution
    existing = (
        InstitutionMembership.objects.filter(institution=institution, status=InstitutionMembership.Status.ACTIVE, role__code=role_code)
        .exclude(user=preparer).select_related("user").order_by("created_at").first()
    )
    if existing:
        return existing.user
    user = User.objects.create_user(email=f"second.{role_code.lower()}.{institution.code.lower()}@example.com", password="StrongPass123!")
    InstitutionMembership.objects.create(
        institution=institution, user=user, role=institution.roles.get(code=role_code), status=InstitutionMembership.Status.ACTIVE,
    )
    return user
