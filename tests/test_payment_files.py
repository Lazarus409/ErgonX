import csv
import io
from datetime import date

import pytest
from django.core.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.payroll.models import EmployeePayrollProfile
from apps.payroll.services import (
    approve_payroll_run,
    calculate_payroll_run,
    configure_employee_payroll_profile,
    configure_payroll,
    create_payroll_period,
    create_payroll_run,
    finalize_payroll_run,
    submit_payroll_run_for_review,
)
from tests.test_payroll import _employee_with_pay, _enable_payroll, _preset_with_generic_rules

pytestmark = pytest.mark.django_db


@pytest.fixture
def run_setup(institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory):
    institution = institution_factory()
    _enable_payroll(institution)
    hr, approver, viewer = user_factory(), user_factory(), user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN")
    membership_factory(user=approver, institution=institution, role_code="FINANCE_MANAGER")
    membership_factory(user=viewer, institution=institution, role_code="AUDITOR")
    banked = _employee_with_pay(institution, employee_factory, organization_factory, assignment_dimensions_factory, employee_number="EMP001")
    wallet = _employee_with_pay(institution, employee_factory, organization_factory, assignment_dimensions_factory, employee_number="EMP002")
    unpaid = _employee_with_pay(institution, employee_factory, organization_factory, assignment_dimensions_factory, employee_number="EMP003")
    configure_employee_payroll_profile(
        institution=institution, employee=banked, actor=hr, tax_residency="RESIDENT", tax_identification_number="P0000000001",
        social_security_number="C012345678901", payment_method="BANK", bank_name="GCB Bank", bank_branch="Ring Road",
        bank_sort_code="040101", account_name="Test Employee", account_number="1021 3456 7890",
    )
    configure_employee_payroll_profile(
        institution=institution, employee=wallet, actor=hr, tax_residency="RESIDENT",
        payment_method="MOBILE_MONEY", mobile_money_network="MTN", mobile_money_number="0241234567",
    )
    version, _ = _preset_with_generic_rules()
    configure_payroll(
        institution=institution, actor=hr, country_code="GH", currency="GHS", payroll_frequency="MONTHLY",
        payroll_setup_mode="PRESET", selected_payroll_preset_version=version,
    )
    period = create_payroll_period(
        institution=institution, actor=hr, name="September 2026", start_date=date(2026, 9, 1), end_date=date(2026, 9, 30), pay_date=date(2026, 9, 30),
    )
    run = calculate_payroll_run(payroll_run=create_payroll_run(institution=institution, payroll_period=period, actor=hr, idempotency_key="files"), actor=hr)
    return {"institution": institution, "run": run, "hr": hr, "approver": approver, "viewer": viewer, "unpaid": unpaid}


def _finalize(setup):
    run = submit_payroll_run_for_review(payroll_run=setup["run"], actor=setup["hr"])
    run = approve_payroll_run(payroll_run=run, actor=setup["approver"])
    return finalize_payroll_run(payroll_run=run, actor=setup["hr"])


def _rows(response):
    return list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))


def test_files_wait_for_finalization_but_the_summary_shows_who_cannot_be_paid(api_client, run_setup):
    api_client.force_authenticate(run_setup["hr"])
    run = run_setup["run"]

    summary = api_client.get(f"/api/v1/payroll-runs/{run.id}/payment-summary/")
    early = api_client.get(f"/api/v1/payroll-runs/{run.id}/payment-file/", {"file": "bank"})

    assert summary.status_code == 200
    assert summary.data["ready"] is False
    assert {row["method"]: row["employees"] for row in summary.data["methods"]} == {"BANK": 1, "MOBILE_MONEY": 1, "UNASSIGNED": 1}
    assert [(row["employee_number"], row["problem"]) for row in summary.data["needs_attention"]] == [("EMP003", "No payment method recorded")]
    assert early.status_code == 400


def test_bank_mobile_money_pension_and_paye_files(api_client, run_setup):
    _finalize(run_setup)
    api_client.force_authenticate(run_setup["hr"])
    url = f"/api/v1/payroll-runs/{run_setup['run'].id}/payment-file/"

    bank = api_client.get(url, {"file": "bank"})
    momo = api_client.get(url, {"file": "mobile-money"})
    pension = api_client.get(url, {"file": "pension"})
    paye = api_client.get(url, {"file": "paye"})

    assert bank.status_code == 200
    assert bank["Content-Disposition"] == 'attachment; filename="bank-september-2026.csv"'
    [bank_row] = _rows(bank)
    assert (bank_row["employee_number"], bank_row["account_number"], bank_row["sort_code"], bank_row["amount"], bank_row["reference"]) == (
        "EMP001", "102134567890", "040101", "2550.00", "Salary September 2026",
    )
    [momo_row] = _rows(momo)
    assert (momo_row["employee_number"], momo_row["network"], momo_row["wallet_number"], momo_row["amount"]) == ("EMP002", "MTN MoMo", "0241234567", "2550.00")
    pension_rows = {row["employee_number"]: row for row in _rows(pension)}
    assert set(pension_rows) == {"EMP001", "EMP002", "EMP003"}
    assert (pension_rows["EMP001"]["ssnit_number"], pension_rows["EMP001"]["employee_contribution"], pension_rows["EMP001"]["employer_contribution"], pension_rows["EMP001"]["total_contribution"]) == (
        "C012345678901", "150.00", "300.00", "450.00",
    )
    paye_rows = {row["employee_number"]: row for row in _rows(paye)}
    assert (paye_rows["EMP001"]["tin"], paye_rows["EMP001"]["taxable_income"], paye_rows["EMP001"]["tax_withheld"]) == ("P0000000001", "3000.00", "300.00")
    assert AuditLog.objects.filter(action="payroll.payment_file.downloaded").count() == 4


def test_only_payroll_finalizers_download_payment_files(api_client, run_setup):
    _finalize(run_setup)
    api_client.force_authenticate(run_setup["viewer"])

    response = api_client.get(f"/api/v1/payroll-runs/{run_setup['run'].id}/payment-file/", {"file": "bank"})

    assert response.status_code == 403


def test_payment_details_are_validated_per_method(run_setup):
    common = {"institution": run_setup["institution"], "employee": run_setup["unpaid"], "actor": run_setup["hr"], "tax_residency": "RESIDENT"}

    with pytest.raises(ValidationError, match="account number"):
        configure_employee_payroll_profile(**common, payment_method="BANK", bank_name="GCB Bank", account_name="X")
    with pytest.raises(ValidationError, match="wallet number"):
        configure_employee_payroll_profile(**common, payment_method="MOBILE_MONEY", mobile_money_network="MTN", mobile_money_number="12345")

    profile = configure_employee_payroll_profile(**common, payment_method="CASH")
    assert profile.payment_method == EmployeePayrollProfile.PaymentMethod.CASH
    log = AuditLog.objects.filter(action="payroll.employee_profile.changed", entity_id=profile.id).latest("created_at")
    assert "payment_method" in log.metadata["changed_fields"]
    assert "1021" not in str(log.metadata)  # account numbers never reach the audit log
