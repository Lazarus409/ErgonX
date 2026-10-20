"""Files that turn a finalized payroll run into payments and statutory schedules.

- Bank transfers and mobile-money bulk payments: one row per employee paid that way.
- SSNIT/pension schedule: the contribution basis, both shares, and the Tier 1 / Tier 2 split.
- PAYE schedule: taxable income and tax withheld per employee, for the GRA monthly return.

They are generic CSVs with the columns banks, MoMo bulk-pay portals, SSNIT and GRA ask for;
reformat them if a provider's upload template needs a different column order. Every figure
comes from the finalized payroll records, never from current compensation.
"""

import csv
import io
from decimal import Decimal

from apps.payroll.models import EmployeePayrollProfile, PayrollItem, PayrollRun

FILES = {
    "bank": "Bank transfers",
    "mobile-money": "Mobile money payments",
    "pension": "Pension (SSNIT) schedule",
    "paye": "PAYE schedule",
}


def _records(run):
    return list(
        run.records.select_related("employee").prefetch_related("items").order_by("employee__employee_number")
    )


def _profiles(run):
    return {
        profile.employee_id: profile
        for profile in EmployeePayrollProfile.objects.filter(institution=run.institution, employee__payroll_records__payroll_run=run)
    }


def _reference(run):
    return f"Salary {run.payroll_period.name}"[:35]


def _missing_details(profile):
    """Why this employee can't be paid electronically, or None."""
    if profile is None or not profile.payment_method:
        return "No payment method recorded"
    if profile.payment_method == EmployeePayrollProfile.PaymentMethod.BANK and not (profile.bank_name and profile.account_number):
        return "Bank details incomplete"
    if profile.payment_method == EmployeePayrollProfile.PaymentMethod.MOBILE_MONEY and not profile.mobile_money_number:
        return "Mobile money number missing"
    return None


def payment_summary(run):
    """How the run's net pay splits across payment methods, and who can't be paid yet."""
    profiles = _profiles(run)
    methods = {}
    attention = []
    for record in _records(run):
        profile = profiles.get(record.employee_id)
        problem = _missing_details(profile)
        method = profile.payment_method if profile and profile.payment_method and not problem else "UNASSIGNED"
        bucket = methods.setdefault(method, {"method": method, "employees": 0, "net_pay": Decimal("0")})
        bucket["employees"] += 1
        bucket["net_pay"] += record.net_pay
        if problem:
            attention.append({
                "employee_id": str(record.employee_id),
                "employee_number": record.employee.employee_number,
                "employee_name": record.employee.full_name,
                "net_pay": str(record.net_pay),
                "problem": problem,
            })
    return {
        "payroll_run_id": str(run.id),
        "status": run.status,
        "ready": run.status == PayrollRun.Status.FINALIZED,
        "currency": run.records.values_list("currency", flat=True).first() or "",
        "methods": [{**bucket, "net_pay": str(bucket["net_pay"])} for bucket in methods.values()],
        "needs_attention": attention,
        "files": [{"key": key, "label": label} for key, label in FILES.items()],
    }


def _bank_rows(run):
    profiles = _profiles(run)
    yield ("employee_number", "employee_name", "bank_name", "bank_branch", "sort_code", "account_name", "account_number", "amount", "currency", "reference")
    for record in _records(run):
        profile = profiles.get(record.employee_id)
        if profile and profile.payment_method == EmployeePayrollProfile.PaymentMethod.BANK and not _missing_details(profile) and record.net_pay > 0:
            yield (record.employee.employee_number, record.employee.full_name, profile.bank_name, profile.bank_branch, profile.bank_sort_code,
                   profile.account_name, profile.account_number, f"{record.net_pay:.2f}", record.currency, _reference(run))


def _mobile_money_rows(run):
    profiles = _profiles(run)
    yield ("employee_number", "employee_name", "network", "wallet_number", "amount", "currency", "reference")
    for record in _records(run):
        profile = profiles.get(record.employee_id)
        if profile and profile.payment_method == EmployeePayrollProfile.PaymentMethod.MOBILE_MONEY and not _missing_details(profile) and record.net_pay > 0:
            yield (record.employee.employee_number, record.employee.full_name, profile.get_mobile_money_network_display(),
                   profile.mobile_money_number, f"{record.net_pay:.2f}", record.currency, _reference(run))


def _pension_rows(run):
    profiles = _profiles(run)
    yield ("employee_number", "employee_name", "ssnit_number", "contribution_basis", "employee_contribution", "employer_contribution",
           "total_contribution", "tier_1_ssnit", "tier_2_occupational", "currency")
    for record in _records(run):
        employee_items = [item for item in record.items.all() if item.metadata.get("effect") == "EMPLOYEE_CONTRIBUTION"]
        employer_items = [item for item in record.items.all() if item.metadata.get("effect") == "EMPLOYER_CONTRIBUTION"]
        if not employee_items and not employer_items:
            continue
        employee_share = sum((item.amount for item in employee_items), Decimal("0"))
        employer_share = sum((item.amount for item in employer_items), Decimal("0"))
        source = (employee_items or employer_items)[0].metadata
        tiers = {allocation["code"]: Decimal(allocation["amount"]) for allocation in source.get("allocations", [])}
        profile = profiles.get(record.employee_id)
        yield (record.employee.employee_number, record.employee.full_name, profile.social_security_number if profile else "",
               source.get("basis", ""), f"{employee_share:.2f}", f"{employer_share:.2f}", f"{employee_share + employer_share:.2f}",
               f"{tiers.get('TIER_1_SSNIT', Decimal('0')):.2f}" if tiers else "", f"{tiers.get('TIER_2_OCCUPATIONAL', Decimal('0')):.2f}" if tiers else "",
               record.currency)


def _paye_rows(run):
    profiles = _profiles(run)
    yield ("employee_number", "employee_name", "tin", "tax_residency", "gross_pay", "employee_pension", "taxable_income", "tax_withheld", "currency")
    for record in _records(run):
        tax = sum(
            (item.amount for item in record.items.all() if item.source == PayrollItem.Source.STATUTORY and item.metadata.get("effect") == "DEDUCTION"),
            Decimal("0"),
        )
        profile = profiles.get(record.employee_id)
        yield (record.employee.employee_number, record.employee.full_name, profile.tax_identification_number if profile else "",
               profile.get_tax_residency_display() if profile else "", f"{record.gross_pay:.2f}", f"{record.employee_contributions:.2f}",
               f"{record.taxable_income:.2f}", f"{tax:.2f}", record.currency)


BUILDERS = {"bank": _bank_rows, "mobile-money": _mobile_money_rows, "pension": _pension_rows, "paye": _paye_rows}


def build_payment_file(run, key):
    """(filename, csv text, data row count) for a finalized run."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    rows = 0
    for index, row in enumerate(BUILDERS[key](run)):
        writer.writerow(row)
        rows = index
    slug = "".join(ch if ch.isalnum() else "-" for ch in run.payroll_period.name.lower()).strip("-")
    return f"{key}-{slug}.csv", "﻿" + buffer.getvalue(), rows
