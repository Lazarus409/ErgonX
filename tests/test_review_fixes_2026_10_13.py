"""Fixes from the 2026-10-13 code review."""
from datetime import date, time, timedelta
from decimal import Decimal

import pytest
from django.core import mail
from django.core.cache import cache
from django.utils import timezone

from apps.accounting.models import AccountingPeriod, FiscalYear, JournalEntry, PayrollAccountMappingTemplate
from apps.accounting.services import approve_journal, create_account, create_journal, submit_journal, void_journal
from apps.accounts.models import User
from apps.employees.models import Employee
from apps.institutions.models import InstitutionInvitation, InstitutionMembership, InstitutionModule, Role
from apps.institutions.services import create_invitation, update_membership
from apps.leave.models import LeaveRequest, LeaveType
from apps.payroll.services import calculate_payroll_run, configure_employee_payroll_profile
from apps.scheduling.models import ScheduleAssignment, Shift, WorkSchedule
from tests.test_ghana_payroll import (
    _configure_ghana,
    _employee_with_compensation,
    _enable_payroll,
    _ghana_version,
    _period_and_run,
)

pytestmark = pytest.mark.django_db


def _ghana_run_with_unpaid_days(institution, hr, employee, unpaid_days):
    shift = Shift.objects.create(institution=institution, name="Day", code="DAY", start_time=time(8), end_time=time(16))
    schedule = WorkSchedule.objects.create(
        institution=institution, name="Daily", code="DAILY", schedule_type=WorkSchedule.ScheduleType.FIXED,
        effective_from=date(2026, 1, 1), fixed_shift=shift,
    )
    ScheduleAssignment.objects.create(institution=institution, employee=employee, work_schedule=schedule, effective_from=date(2026, 1, 1), assigned_by=hr)
    if unpaid_days:
        leave_type = LeaveType.objects.create(institution=institution, code="UNPAID-REVIEW", name="Unpaid leave (review)", is_paid=False)
        LeaveRequest.objects.create(
            institution=institution, employee=employee, leave_type=leave_type, start_date=date(2026, 9, 14),
            end_date=date(2026, 9, 14) + timedelta(days=unpaid_days - 1), requested_days=unpaid_days,
            status=LeaveRequest.Status.APPROVED,
        )
    _period, run = _period_and_run(institution, hr, key=f"unpaid-{unpaid_days}")
    return calculate_payroll_run(payroll_run=run, actor=hr).records.get(employee=employee)


def test_unpaid_leave_is_neither_taxed_nor_pensionable(
    institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory,
):
    institution = institution_factory(code="UNPAID-TAX")
    _enable_payroll(institution)
    hr = user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN")
    employee, _ = _employee_with_compensation(institution, employee_factory, organization_factory, assignment_dimensions_factory)
    _configure_ghana(institution, hr, _ghana_version())
    configure_employee_payroll_profile(institution=institution, employee=employee, actor=hr, tax_residency="RESIDENT")

    record = _ghana_run_with_unpaid_days(institution, hr, employee, unpaid_days=5)

    unpaid = record.items.get(component_code_snapshot="UNPAID_LEAVE").amount
    assert unpaid > 0
    earned = Decimal("3000.00") - unpaid
    assert record.gross_pay == Decimal("3000.00")  # the payslip still shows the deduction
    assert record.taxable_income == earned
    pension = record.items.get(component_code_snapshot="GH_MANDATORY_PENSION_EMPLOYEE")
    assert Decimal(pension.metadata["basis"]) == earned
    assert pension.amount == (earned * Decimal("0.055")).quantize(Decimal("0.01"))
    paye = record.items.get(component_code_snapshot="GH_PAYE_RESIDENT")
    assert Decimal(paye.metadata["basis"]) == earned - pension.amount
    assert record.net_pay == record.gross_pay - record.total_deductions - record.employee_contributions


def test_ghana_payroll_journal_maps_unpaid_leave_and_special_taxes():
    for code, debit, credit in (
        ("UNPAID_LEAVE", "NET_PAY_PAYABLE", "SALARIES_EXPENSE"),
        ("GH_BONUS_TAX", "NET_PAY_PAYABLE", "PAYE_PAYABLE"),
        ("GH_OVERTIME_TAX", "NET_PAY_PAYABLE", "PAYE_PAYABLE"),
        ("GH_NON_RESIDENT_BONUS_TAX", "NET_PAY_PAYABLE", "PAYE_PAYABLE"),
        ("GH_NON_RESIDENT_OVERTIME_TAX", "NET_PAY_PAYABLE", "PAYE_PAYABLE"),
    ):
        templates = PayrollAccountMappingTemplate.objects.filter(payroll_component_code=code)
        assert templates.count() == 4, code
        assert set(templates.values_list("debit_account_mapping_code", "credit_account_mapping_code")) == {(debit, credit)}


def _accounting(institution, user_factory, membership_factory):
    InstitutionModule.objects.filter(institution=institution, module_code="ACCOUNTING").update(is_enabled=True)
    accountant = user_factory(email="leaver.accountant@example.com")
    finance = user_factory(email="stays.finance@example.com")
    accountant_membership = membership_factory(user=accountant, institution=institution, role_code="ACCOUNTANT", is_primary=True)
    membership_factory(user=finance, institution=institution, role_code="FINANCE_MANAGER", is_primary=True)
    fiscal_year = FiscalYear.objects.create(institution=institution, name="FY2026", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
    period = AccountingPeriod.objects.create(
        institution=institution, fiscal_year=fiscal_year, name="September 2026", start_date=date(2026, 9, 1), end_date=date(2026, 9, 30),
    )
    return accountant, accountant_membership, finance, period


def _journal(institution, accountant, period, number):
    cash = create_account(institution=institution, actor=accountant, code=f"10{number}", name=f"Cash {number}", account_type="ASSET", normal_balance="DEBIT")
    income = create_account(institution=institution, actor=accountant, code=f"40{number}", name=f"Income {number}", account_type="INCOME", normal_balance="CREDIT")
    journal = create_journal(
        institution=institution, actor=accountant, accounting_period=period, entry_date=date(2026, 9, 10), description="Before leaving",
        lines=[
            {"account": cash, "debit": Decimal("10.00"), "credit": Decimal("0.00")},
            {"account": income, "debit": Decimal("0.00"), "credit": Decimal("10.00")},
        ],
    )
    return submit_journal(journal=journal, actor=accountant)


def test_a_journal_outlives_its_creators_membership(institution_factory, user_factory, membership_factory):
    institution = institution_factory(code="LEAVER-JE")
    accountant, accountant_membership, finance, period = _accounting(institution, user_factory, membership_factory)
    pending = _journal(institution, accountant, period, 1)
    to_void = _journal(institution, accountant, period, 2)

    update_membership(membership=accountant_membership, institution=institution, actor=finance, status=InstitutionMembership.Status.INACTIVE)

    assert approve_journal(journal=pending, actor=finance).status == JournalEntry.Status.APPROVED
    assert void_journal(journal=to_void, actor=finance).status == JournalEntry.Status.VOID
    # A new stamp is still checked: a former member cannot be recorded as approver.
    to_void.refresh_from_db()
    pending.refresh_from_db()
    pending.approved_by = accountant
    with pytest.raises(Exception, match="active institution member"):
        pending.save()


def _invite(institution, admin, email, role_code="EMPLOYEE", employee=None):
    role = Role.objects.get(institution=institution, code=role_code)
    _invitation, token = create_invitation(
        email=email, institution=institution, role=role, actor=admin, expires_at=timezone.now() + timedelta(days=3), employee=employee,
    )
    return token


def test_refused_invitation_acceptance_writes_nothing(api_client, institution_factory, user_factory, membership_factory, employee_factory):
    institution = institution_factory(code="INVITE-409")
    admin = user_factory(email="invite.admin@example.com")
    membership_factory(user=admin, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    employee = employee_factory(institution, work_email="new.hire@example.com")
    token = _invite(institution, admin, "new.hire@example.com", employee=employee)
    # The record gets linked to someone else after the invitation went out.
    other = user_factory(email="someone.else@example.com")
    membership_factory(user=other, institution=institution, role_code="EMPLOYEE")
    Employee.objects.filter(pk=employee.pk).update(user=other)

    response = api_client.post(f"/api/v1/auth/invitations/{token}/", {"password": "a-Strong-passphrase-42"}, format="json")

    assert response.status_code == 409
    assert not User.objects.filter(email="new.hire@example.com").exists()
    assert InstitutionInvitation.objects.get(email="new.hire@example.com").status == InstitutionInvitation.Status.PENDING


def test_invitation_password_follows_the_password_rules(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory(code="INVITE-PW")
    admin = user_factory(email="pw.admin@example.com")
    membership_factory(user=admin, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    token = _invite(institution, admin, "weak.password@example.com")

    response = api_client.post(f"/api/v1/auth/invitations/{token}/", {"password": "12345678"}, format="json")

    assert response.status_code == 400
    assert not User.objects.filter(email="weak.password@example.com").exists()


def test_suspension_revokes_pending_invitations_and_old_ones_cannot_reactivate(
    api_client, institution_factory, user_factory, membership_factory,
):
    institution = institution_factory(code="INVITE-SUSPEND")
    admin = user_factory(email="suspend.admin@example.com")
    membership_factory(user=admin, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    member = user_factory(email="suspended.member@example.com", password="a-Strong-passphrase-42")
    membership = membership_factory(user=member, institution=institution, role_code="EMPLOYEE")
    token = _invite(institution, admin, member.email)

    update_membership(membership=membership, institution=institution, actor=admin, status=InstitutionMembership.Status.SUSPENDED)
    assert InstitutionInvitation.objects.get(email=member.email).status == InstitutionInvitation.Status.REVOKED

    # Even a still-pending invitation (e.g. issued after suspension) cannot lift it.
    InstitutionInvitation.objects.filter(email=member.email).update(status=InstitutionInvitation.Status.PENDING)
    response = api_client.post(f"/api/v1/auth/invitations/{token}/", {"password": "a-Strong-passphrase-42"}, format="json")
    assert response.status_code == 403
    membership.refresh_from_db()
    assert membership.status == InstitutionMembership.Status.SUSPENDED


def test_accepting_an_employee_invitation_keeps_an_active_admins_role(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory(code="INVITE-KEEP-ROLE")
    admin = user_factory(email="keep.admin@example.com", password="a-Strong-passphrase-42")
    membership = membership_factory(user=admin, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    token = _invite(institution, admin, admin.email)

    response = api_client.post(f"/api/v1/auth/invitations/{token}/", {"password": "a-Strong-passphrase-42"}, format="json")

    assert response.status_code == 200, response.content
    membership.refresh_from_db()
    assert membership.role.code == "INSTITUTION_ADMIN"
    assert membership.status == InstitutionMembership.Status.ACTIVE
    assert response.json()["data"]["access_preview"]["role_code"] == "INSTITUTION_ADMIN"


def test_read_only_role_can_request_access(api_client, institution_factory, user_factory, membership_factory):
    institution = institution_factory(code="ACCESS-RO")
    admin = user_factory(email="ro.admin@example.com")
    membership_factory(user=admin, institution=institution, role_code="INSTITUTION_ADMIN", is_primary=True)
    auditor = user_factory(email="ro.auditor@example.com")
    membership_factory(user=auditor, institution=institution, role_code="AUDITOR", is_primary=True)
    assert Role.objects.get(institution=institution, code="AUDITOR").is_read_only
    api_client.force_authenticate(auditor)
    api_client.credentials(HTTP_X_INSTITUTION_ID=str(institution.id))

    response = api_client.post("/api/v1/access-requests/", {"area": "Payroll"}, format="json")

    assert response.status_code == 201, response.content


def test_password_reset_emails_are_limited_per_address(api_client, user_factory, settings):
    settings.EMAIL_DELIVERY_ENABLED = True
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    cache.clear()
    user_factory(email="flooded@example.com")

    statuses = [api_client.post("/api/v1/auth/password-reset/", {"email": "Flooded@example.com"}, format="json").status_code for _ in range(4)]

    assert statuses == [202, 202, 202, 429]
    assert len(mail.outbox) == 3
    # Another address is unaffected.
    assert api_client.post("/api/v1/auth/password-reset/", {"email": "other@example.com"}, format="json").status_code == 202
    cache.clear()


def test_tax_relief_lines_do_not_block_the_payroll_journal(institution_factory, user_factory, membership_factory, employee_factory):
    from apps.accounting.models import Account, PayComponentAccountMapping
    from apps.accounting.services import generate_payroll_journal
    from apps.compensation.models import PayComponent
    from apps.payroll.models import PayrollItem, PayrollPeriod, PayrollRecord, PayrollRun

    institution = institution_factory(code="RELIEF-GL")
    InstitutionModule.objects.filter(institution=institution, module_code__in=("PAYROLL", "ACCOUNTING")).update(is_enabled=True)
    actor = user_factory()
    membership_factory(user=actor, institution=institution, role_code="FINANCE_MANAGER", is_primary=True)
    employee = employee_factory(institution)
    period = PayrollPeriod.objects.create(institution=institution, name="September 2026", start_date=date(2026, 9, 1), end_date=date(2026, 9, 30), pay_date=date(2026, 9, 30))
    run = PayrollRun.objects.create(institution=institution, payroll_period=period, run_number=1, started_by=actor, started_at=timezone.now())
    PayrollRun.objects.filter(pk=run.pk).update(status=PayrollRun.Status.FINALIZED)
    record = PayrollRecord.objects.create(
        institution=institution, payroll_run=run, employee=employee, gross_pay=Decimal("1200.00"), taxable_income=Decimal("1100.00"),
        total_deductions=Decimal("0.00"), employee_contributions=Decimal("0.00"), employer_contributions=Decimal("0.00"), net_pay=Decimal("1200.00"), currency="GHS",
    )
    component = PayComponent.objects.create(
        institution=institution, name="Basic pay", code="BASIC", component_type=PayComponent.ComponentType.EARNING, calculation_type=PayComponent.CalculationType.FIXED,
    )
    PayrollItem.objects.create(payroll_record=record, pay_component=component, component_code_snapshot="BASIC", component_name_snapshot="Basic pay", source=PayrollItem.Source.COMPENSATION, amount=Decimal("1200.00"), metadata={"effect": "EARNING"})
    PayrollItem.objects.create(payroll_record=record, component_code_snapshot="GH_RELIEF_MARRIAGE", component_name_snapshot="Marriage relief", source=PayrollItem.Source.STATUTORY, amount=Decimal("100.00"), metadata={"effect": "TAX_RELIEF"})
    fiscal_year = FiscalYear.objects.create(institution=institution, name="FY2026", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
    AccountingPeriod.objects.create(institution=institution, fiscal_year=fiscal_year, name="September 2026", start_date=date(2026, 9, 1), end_date=date(2026, 9, 30))
    salaries = Account.objects.create(institution=institution, code="5100", name="Salaries", account_type=Account.AccountType.EXPENSE, normal_balance=Account.NormalBalance.DEBIT)
    payable = Account.objects.create(institution=institution, code="2340", name="Payroll payable", account_type=Account.AccountType.LIABILITY, normal_balance=Account.NormalBalance.CREDIT)
    PayComponentAccountMapping.objects.create(institution=institution, pay_component=component, debit_account=salaries, credit_account=payable, effective_from=date(2026, 1, 1))

    journal = generate_payroll_journal(payroll_run=run, actor=actor)

    assert sorted(journal.lines.values_list("debit", "credit")) == [(Decimal("0.00"), Decimal("1200.00")), (Decimal("1200.00"), Decimal("0.00"))]
