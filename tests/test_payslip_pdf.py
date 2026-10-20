from datetime import date

import pytest
from django.urls import reverse

from apps.audit.models import AuditLog
from apps.payroll.models import EmployeePayrollProfile
from apps.payroll.services import (
    approve_payroll_run,
    calculate_payroll_run,
    configure_payroll,
    create_payroll_period,
    create_payroll_run,
    finalize_payroll_run,
    submit_payroll_run_for_review,
)
from tests.test_payroll import _employee_with_pay, _enable_payroll, _preset_with_generic_rules

pytestmark = pytest.mark.django_db


@pytest.fixture
def finalized_payslip(
    institution_factory,
    user_factory,
    membership_factory,
    employee_factory,
    organization_factory,
    assignment_dimensions_factory,
):
    institution = institution_factory()
    _enable_payroll(institution)
    hr = user_factory()
    approver = user_factory()
    employee_user = user_factory()
    colleague_user = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN")
    membership_factory(user=approver, institution=institution, role_code="FINANCE_MANAGER")
    membership_factory(user=employee_user, institution=institution, role_code="EMPLOYEE", is_primary=True)
    membership_factory(user=colleague_user, institution=institution, role_code="EMPLOYEE", is_primary=True)
    employee = _employee_with_pay(
        institution, employee_factory, organization_factory, assignment_dimensions_factory, user=employee_user
    )
    # An odd number of detail fields (the TIN adds a seventh) must still render.
    EmployeePayrollProfile.objects.create(institution=institution, employee=employee, tax_residency="RESIDENT", tax_identification_number="P0012345678")
    version, _ = _preset_with_generic_rules()
    configure_payroll(
        institution=institution,
        actor=hr,
        country_code="GH",
        currency="GHS",
        payroll_frequency="MONTHLY",
        payroll_setup_mode="PRESET",
        selected_payroll_preset_version=version,
    )
    period = create_payroll_period(
        institution=institution,
        actor=hr,
        name="September 2026",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 30),
        pay_date=date(2026, 9, 30),
    )
    run = create_payroll_run(institution=institution, payroll_period=period, actor=hr, idempotency_key="pdf-test")
    run = calculate_payroll_run(payroll_run=run, actor=hr)
    run = submit_payroll_run_for_review(payroll_run=run, actor=hr)
    run = approve_payroll_run(payroll_run=run, actor=approver)
    run = finalize_payroll_run(payroll_run=run, actor=hr)
    payslip = run.records.get(employee=employee).payslip
    return {"payslip": payslip, "employee_user": employee_user, "colleague_user": colleague_user, "hr": hr}


def test_employee_downloads_own_payslip_pdf_and_download_is_audited(api_client, finalized_payslip):
    payslip = finalized_payslip["payslip"]
    api_client.force_authenticate(finalized_payslip["employee_user"])

    response = api_client.get(reverse("v1:payslip-pdf", args=(payslip.id,)))

    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response["Content-Disposition"].startswith('attachment; filename="payslip-')
    assert response["Content-Disposition"].endswith('-september-2026.pdf"')
    assert response["Cache-Control"] == "private, no-store"
    assert response.content.startswith(b"%PDF-")
    assert AuditLog.objects.filter(action="payroll.payslip.downloaded", entity_id=payslip.id).count() == 1


def test_hr_can_download_any_payslip_pdf(api_client, finalized_payslip):
    api_client.force_authenticate(finalized_payslip["hr"])

    response = api_client.get(reverse("v1:payslip-pdf", args=(finalized_payslip["payslip"].id,)))

    assert response.status_code == 200
    assert response.content.startswith(b"%PDF-")


def test_colleague_cannot_download_someone_elses_payslip_pdf(api_client, finalized_payslip):
    payslip = finalized_payslip["payslip"]
    api_client.force_authenticate(finalized_payslip["colleague_user"])

    response = api_client.get(reverse("v1:payslip-pdf", args=(payslip.id,)))

    assert response.status_code == 404
    assert not AuditLog.objects.filter(action="payroll.payslip.downloaded", entity_id=payslip.id).exists()
