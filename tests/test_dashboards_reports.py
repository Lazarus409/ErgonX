import pytest

from apps.employees.models import Employee


@pytest.mark.django_db
def test_hr_dashboard_and_csv_export_are_tenant_scoped(
    api_client, institution_factory, user_factory, membership_factory, employee_factory
):
    institution = institution_factory(code="DASHBOARD-HOME")
    foreign = institution_factory(code="DASHBOARD-FOREIGN")
    user = user_factory()
    membership_factory(user=user, institution=institution, role_code="HR_ADMIN", is_primary=True)
    employee_factory(foreign)

    api_client.force_authenticate(user)
    api_client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))

    dashboard = api_client.get("/api/v1/dashboards/hr/")
    assert dashboard.status_code == 200
    assert dashboard.data["total_employees"] == 0
    assert dashboard.data["active_employees"] == 0

    report = api_client.get("/api/v1/reports/workforce-cost/?export=csv")
    assert report.status_code == 200
    assert report["Content-Type"].startswith("text/csv")
    assert "gross_pay" in report.content.decode()


@pytest.mark.django_db
def test_finance_manager_receives_finance_dashboard_and_report_access(
    api_client, institution_factory, user_factory, membership_factory
):
    institution = institution_factory(code="DASHBOARD-FINANCE")
    user = user_factory()
    membership_factory(user=user, institution=institution, role_code="FINANCE_MANAGER", is_primary=True)

    api_client.force_authenticate(user)
    response = api_client.get("/api/v1/dashboards/finance/")
    assert response.status_code == 200
    assert set(response.data) == {"pending_journals", "accounts_payable", "accounts_receivable", "expenses"}

    report = api_client.get("/api/v1/reports/accounting/")
    assert report.status_code == 200
    assert report.data == {"report": "accounting", "rows": []}


@pytest.mark.django_db
def test_employee_cannot_access_dashboard_or_reports(
    api_client, institution_factory, user_factory, membership_factory
):
    institution = institution_factory(code="DASHBOARD-DENIED")
    user = user_factory()
    membership_factory(user=user, institution=institution, role_code="EMPLOYEE", is_primary=True)
    api_client.force_authenticate(user)

    assert api_client.get("/api/v1/dashboards/hr/").status_code == 403
    assert api_client.get("/api/v1/reports/leave/").status_code == 403
