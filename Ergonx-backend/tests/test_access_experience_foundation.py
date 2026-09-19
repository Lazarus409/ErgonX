from datetime import date

import pytest

from apps.employees.models import Employment
from apps.institutions.models import InstitutionMembership, Role
from apps.institutions.services import next_reference


pytestmark = pytest.mark.django_db


def _authenticate(api_client, user, institution):
    api_client.force_authenticate(user)
    api_client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))


def test_home_bootstrap_and_search_are_tenant_and_permission_scoped(
    api_client, institution_factory, user_factory, membership_factory, employee_factory
):
    institution = institution_factory(code="EXPERIENCE")
    foreign = institution_factory(code="EXPERIENCE-FOREIGN")
    user = user_factory(first_name="Ada")
    membership_factory(user=user, institution=institution, role_code="HR_ADMIN", is_primary=True)
    employee_factory(institution, employee_number="EMP-ADA", last_name="Adams")
    employee_factory(foreign, employee_number="EMP-FOREIGN", last_name="Adams")
    _authenticate(api_client, user, institution)

    home = api_client.get("/api/v1/home/")
    assert home.status_code == 200
    assert set(home.data) == {
        "greeting_context", "quick_actions", "recent_work", "attention_items",
        "notifications_summary", "optional_personal_snapshot",
    }
    assert home.data["greeting_context"]["user_display_name"] == "Ada"

    bootstrap = api_client.get("/api/v1/auth/bootstrap/")
    assert bootstrap.status_code == 200
    assert bootstrap.data["active_institution"]["id"] == str(institution.id)
    assert "search.use" in bootstrap.data["effective_permissions"]

    search = api_client.get("/api/v1/search/?q=EMP-ADA")
    assert search.status_code == 200
    assert [item["reference"] for item in search.data["results"]] == ["EMP-ADA"]


def test_custom_roles_cannot_change_reserved_roles_and_keep_tenant_scope(
    api_client, institution_factory, user_factory, membership_factory
):
    institution = institution_factory(code="ROLE-TEST")
    user = user_factory()
    membership_factory(user=user, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    _authenticate(api_client, user, institution)

    created = api_client.post(
        "/api/v1/institutions/roles/",
        {"code": "BENEFITS_EDITOR", "name": "Benefits editor", "permission_codes": ["employee.view"]},
        format="json",
    )
    assert created.status_code == 201
    assert created.data["is_custom"] is True

    reserved = institution.roles.get(code="HR_ADMIN")
    response = api_client.patch(
        f"/api/v1/institutions/roles/{reserved.id}/",
        {"name": "Changed"},
        format="json",
    )
    assert response.status_code == 400
    assert response.data["code"] == "role_protected"


def test_reference_sequences_are_tenant_local_and_reset_by_policy(institution_factory):
    institution = institution_factory(code="REFERENCE-TEST")
    first = next_reference(institution=institution, namespace="PAYROLL_RUN", at=date(2026, 1, 31))
    second = next_reference(institution=institution, namespace="PAYROLL_RUN", at=date(2026, 2, 1))
    assert first == "PR-2026-01-0001"
    assert second == "PR-2026-02-0001"


def test_offboarding_ends_only_the_institution_membership(
    api_client, institution_factory, user_factory, membership_factory, organization_factory,
    assignment_dimensions_factory, employee_factory,
):
    institution = institution_factory(code="LIFECYCLE")
    user = user_factory()
    membership_factory(user=user, institution=institution, role_code="HR_ADMIN", is_primary=True)
    employee = employee_factory(institution, user=user)
    department, position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)
    Employment.objects.create(
        institution=institution, employee=employee, department=department, position=position,
        grade=grade, location=location, employment_type=Employment.EmploymentType.PERMANENT,
        start_date=date(2026, 1, 1), is_current=True,
    )
    _authenticate(api_client, user, institution)
    started = api_client.post(f"/api/v1/employees/{employee.id}/offboarding/start/", {"last_working_day": "2026-02-01"}, format="json")
    assert started.status_code == 200
    completed = api_client.post(f"/api/v1/employees/{employee.id}/offboarding/complete/", format="json")
    assert completed.status_code == 200
    assert completed.data["status"] == "COMPLETED"
    assert InstitutionMembership.objects.get(user=user, institution=institution).status == InstitutionMembership.Status.INACTIVE
    user.refresh_from_db()
    assert user.is_active is True
