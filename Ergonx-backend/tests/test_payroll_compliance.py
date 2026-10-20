from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.employees.models import Employment
from apps.payroll.models import PayrollRunException
from apps.payroll.services import calculate_payroll_run, configure_employee_payroll_profile
from tests.test_ghana_payroll import _configure_ghana, _employee_with_compensation, _enable_payroll, _ghana_version, _period_and_run

pytestmark = pytest.mark.django_db


@pytest.fixture
def ghana(institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory):
    institution = institution_factory()
    _enable_payroll(institution)
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN")
    _configure_ghana(institution, hr, _ghana_version())

    def employee(number, salary="3000.00", **profile):
        person, _ = _employee_with_compensation(
            institution, employee_factory, organization_factory, assignment_dimensions_factory, employee_number=number, base_salary=Decimal(salary),
        )
        configure_employee_payroll_profile(institution=institution, employee=person, actor=hr, tax_residency="RESIDENT", **profile)
        return person

    return {"institution": institution, "hr": hr, "employee": employee}


def _codes(run, person):
    return set(run.exceptions.filter(employee=person).values_list("code", flat=True))


def test_ghana_leaver_is_paid_to_their_last_day(ghana):
    leaver = ghana["employee"]("GH010")
    Employment.objects.filter(employee=leaver).update(end_date=date(2026, 9, 15), is_current=False, status=Employment.Status.ENDED)

    _period, run = _period_and_run(ghana["institution"], ghana["hr"])
    run = calculate_payroll_run(payroll_run=run, actor=ghana["hr"])

    record = run.records.get(employee=leaver)
    assert record.items.get(component_code_snapshot="BASE_SALARY").amount == Decimal("1500.00")
    assert record.employee_contributions > 0  # pension on the prorated basic


def test_pension_exemption_needs_a_reason_skips_pension_and_is_flagged(ghana):
    exempt = ghana["employee"]("GH012")
    profile = {"institution": ghana["institution"], "employee": exempt, "actor": ghana["hr"], "tax_residency": "RESIDENT"}
    with pytest.raises(ValidationError, match="Record why"):
        configure_employee_payroll_profile(**profile, pension_exempt=True)
    configure_employee_payroll_profile(**profile, pension_exempt=True, pension_exemption_reason="Retired; already drawing an SSNIT pension")
    covered = ghana["employee"]("GH013")

    _period, run = _period_and_run(ghana["institution"], ghana["hr"])
    run = calculate_payroll_run(payroll_run=run, actor=ghana["hr"])

    exempt_record = run.records.get(employee=exempt)
    assert exempt_record.employee_contributions == Decimal("0")
    assert exempt_record.employer_contributions == Decimal("0")
    assert not exempt_record.items.filter(component_code_snapshot__startswith="GH_MANDATORY_PENSION").exists()
    assert run.records.get(employee=covered).employee_contributions > 0
    flag = run.exceptions.get(employee=exempt, code=PayrollRunException.Code.PENSION_EXEMPT)
    assert "SSNIT pension" in flag.message


def test_pay_below_the_monthly_minimum_wage_is_flagged(ghana):
    low = ghana["employee"]("GH014", salary="500.00")
    fine = ghana["employee"]("GH015", salary="600.00")

    _period, run = _period_and_run(ghana["institution"], ghana["hr"])
    run = calculate_payroll_run(payroll_run=run, actor=ghana["hr"])

    assert PayrollRunException.Code.BELOW_MINIMUM_WAGE in _codes(run, low)
    flag = run.exceptions.get(employee=low, code=PayrollRunException.Code.BELOW_MINIMUM_WAGE)
    assert flag.details == {"rate": "500.00", "minimum": "587.79"}  # GHS 21.77 x 27
    assert PayrollRunException.Code.BELOW_MINIMUM_WAGE not in _codes(run, fine)
