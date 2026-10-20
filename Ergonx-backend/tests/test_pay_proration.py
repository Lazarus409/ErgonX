from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError

from apps.compensation.models import (
    EmployeeCompensation,
    PayComponent,
    SalaryStructure,
    SalaryStructureComponent,
)
from apps.employees.models import Employment
from apps.payroll.models import InstitutionPayrollConfiguration
from apps.payroll.services import (
    calculate_payroll_run,
    configure_payroll,
    create_payroll_period,
    create_payroll_run,
    reconcile_payroll_run,
)
from tests.test_payroll import _enable_payroll, _preset_with_generic_rules

pytestmark = pytest.mark.django_db

SEPTEMBER = (date(2026, 9, 1), date(2026, 9, 30))  # 30 calendar days, 22 weekdays


@pytest.fixture
def payroll(institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory):
    institution = institution_factory()
    _enable_payroll(institution)
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN")
    department, position = organization_factory(institution)
    grade, location = assignment_dimensions_factory(institution)
    structure = SalaryStructure.objects.create(institution=institution, name="Standard", code="STD")
    version, _ = _preset_with_generic_rules()

    def configure(method=InstitutionPayrollConfiguration.ProrationMethod.CALENDAR_DAYS):
        configure_payroll(
            institution=institution,
            actor=hr,
            country_code="GH",
            currency="GHS",
            payroll_frequency="MONTHLY",
            payroll_setup_mode="PRESET",
            selected_payroll_preset_version=version,
            proration_method=method,
        )

    def employee(number, *, employed_from, pay, employed_to=None):
        """``pay`` is a list of (effective_from, effective_to, base_salary)."""
        person = employee_factory(institution, employee_number=number)
        Employment.objects.create(
            institution=institution,
            employee=person,
            department=department,
            position=position,
            grade=grade,
            location=location,
            employment_type=Employment.EmploymentType.PERMANENT,
            start_date=employed_from,
            end_date=employed_to,
            is_current=employed_to is None,
            status=Employment.Status.ACTIVE if employed_to is None else Employment.Status.ENDED,
        )
        for effective_from, effective_to, base_salary in pay:
            EmployeeCompensation.objects.create(
                institution=institution,
                employee=person,
                salary_structure=structure,
                base_salary=Decimal(base_salary),
                currency="GHS",
                effective_from=effective_from,
                effective_to=effective_to,
                is_current=effective_to is None,
            )
        return person

    def run(name="September 2026", dates=SEPTEMBER):
        period = create_payroll_period(
            institution=institution, actor=hr, name=name,
            start_date=dates[0], end_date=dates[1], pay_date=dates[1],
        )
        payroll_run = create_payroll_run(institution=institution, payroll_period=period, actor=hr, idempotency_key=name)
        return calculate_payroll_run(payroll_run=payroll_run, actor=hr)

    return {"institution": institution, "structure": structure, "configure": configure, "employee": employee, "run": run}


def _base_items(record):
    return list(record.items.filter(component_code_snapshot="BASE_SALARY").order_by("created_at"))


def test_full_period_is_not_prorated(payroll):
    payroll["configure"]()
    person = payroll["employee"]("EMP100", employed_from=date(2026, 1, 1), pay=[(date(2026, 1, 1), None, "3000.00")])

    record = payroll["run"]().records.get(employee=person)

    [item] = _base_items(record)
    assert item.amount == Decimal("3000.00")
    assert item.component_name_snapshot == "Base salary"
    assert "proration" not in item.metadata
    assert item.quantity is None


def test_mid_period_hire_is_paid_for_calendar_days_employed(payroll):
    payroll["configure"]()
    person = payroll["employee"]("EMP101", employed_from=date(2026, 9, 16), pay=[(date(2026, 9, 16), None, "3000.00")])

    run = payroll["run"]()
    record = run.records.get(employee=person)

    [item] = _base_items(record)
    assert item.amount == Decimal("1500.00")  # 15 of 30 days
    assert item.quantity == Decimal("15")
    assert item.metadata["proration"] == {
        "method": "CALENDAR_DAYS", "paid_days": 15, "period_days": 30, "from": "2026-09-16", "to": "2026-09-30",
    }
    assert record.gross_pay == Decimal("1500.00")
    # Statutory pension is on the prorated basic: 5% of 1500.
    assert record.employee_contributions == Decimal("75.00")
    assert reconcile_payroll_run(run)["discrepancy_count"] == 0


def test_mid_period_hire_with_working_days_counts_weekdays(payroll):
    payroll["configure"](InstitutionPayrollConfiguration.ProrationMethod.WORKING_DAYS)
    person = payroll["employee"]("EMP102", employed_from=date(2026, 9, 21), pay=[(date(2026, 9, 21), None, "3000.00")])

    record = payroll["run"]().records.get(employee=person)

    [item] = _base_items(record)
    assert item.amount == Decimal("1090.91")  # 8 of 22 weekdays
    assert item.metadata["proration"]["paid_days"] == 8
    assert item.metadata["proration"]["period_days"] == 22


def test_salary_change_inside_the_period_pays_each_rate_for_its_days(payroll):
    payroll["configure"]()
    person = payroll["employee"](
        "EMP103",
        employed_from=date(2026, 1, 1),
        pay=[(date(2026, 1, 1), date(2026, 9, 15), "3000.00"), (date(2026, 9, 16), None, "3600.00")],
    )

    run = payroll["run"]()
    record = run.records.get(employee=person)

    old, new = _base_items(record)
    assert (old.component_name_snapshot, old.amount) == ("Base salary (01 Sep - 15 Sep)", Decimal("1500.00"))
    assert (new.component_name_snapshot, new.amount) == ("Base salary (16 Sep - 30 Sep)", Decimal("1800.00"))
    assert record.gross_pay == Decimal("3300.00")
    assert reconcile_payroll_run(run)["discrepancy_count"] == 0


def test_fixed_earnings_are_prorated_but_fixed_deductions_are_not(payroll):
    payroll["configure"]()
    institution = payroll["institution"]
    allowance = PayComponent.objects.create(
        institution=institution, name="Transport allowance", code="TRANSPORT",
        component_type=PayComponent.ComponentType.EARNING, calculation_type=PayComponent.CalculationType.FIXED, taxable=True,
    )
    welfare = PayComponent.objects.create(
        institution=institution, name="Welfare dues", code="WELFARE",
        component_type=PayComponent.ComponentType.DEDUCTION, calculation_type=PayComponent.CalculationType.FIXED,
    )
    for component, amount in ((allowance, "600.00"), (welfare, "50.00")):
        SalaryStructureComponent.objects.create(
            institution=institution, salary_structure=payroll["structure"], pay_component=component, default_amount=Decimal(amount),
        )
    person = payroll["employee"]("EMP104", employed_from=date(2026, 9, 16), pay=[(date(2026, 9, 16), None, "3000.00")])

    run = payroll["run"]()
    record = run.records.get(employee=person)

    assert record.items.get(component_code_snapshot="TRANSPORT").amount == Decimal("300.00")
    assert record.items.get(component_code_snapshot="WELFARE").amount == Decimal("50.00")
    assert record.gross_pay == Decimal("1800.00")
    assert reconcile_payroll_run(run)["discrepancy_count"] == 0


def test_employed_days_without_compensation_fail_closed(payroll):
    payroll["configure"]()
    payroll["employee"]("EMP105", employed_from=date(2026, 1, 1), pay=[(date(2026, 9, 10), None, "3000.00")])

    with pytest.raises(ValidationError, match="EMP105 is employed on 2026-09-01 but has no compensation"):
        payroll["run"]()


def test_leaver_is_paid_to_their_last_day_and_left_out_of_later_runs(payroll):
    payroll["configure"]()
    stayer = payroll["employee"]("EMP106", employed_from=date(2026, 1, 1), pay=[(date(2026, 1, 1), None, "3000.00")])
    # Offboarding ends the employment but leaves the compensation open.
    leaver = payroll["employee"](
        "EMP107", employed_from=date(2026, 1, 1), employed_to=date(2026, 9, 15), pay=[(date(2026, 1, 1), None, "3000.00")]
    )

    september = payroll["run"]()
    [item] = _base_items(september.records.get(employee=leaver))
    assert item.amount == Decimal("1500.00")
    assert item.metadata["proration"]["to"] == "2026-09-15"

    october = payroll["run"]("October 2026", (date(2026, 10, 1), date(2026, 10, 31)))
    assert list(october.records.values_list("employee_id", flat=True)) == [stayer.id]
