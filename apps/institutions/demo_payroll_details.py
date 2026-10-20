"""Demo-only payment details and public holidays for APEX-DEMO (used by the demo seeds).

Fills blanks only, so a re-run never overwrites what someone changed in the demo. Bank names
are real Ghanaian banks so the demo looks familiar; every account, wallet and SSNIT number is
made up from the employee number and does not belong to anyone.
"""

from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.institutions.models import InstitutionMembership
from apps.organization.holidays import suggested_holidays
from apps.organization.models import PublicHoliday
from apps.payroll.models import EmployeePayrollProfile
from apps.payroll.services import configure_employee_payroll_profile

BANKS = (
    ("GCB Bank", "Accra Main"),
    ("Ecobank Ghana", "Ridge"),
    ("Stanbic Bank Ghana", "Airport City"),
    ("Absa Bank Ghana", "High Street"),
    ("Fidelity Bank Ghana", "Tema Community 1"),
    ("CalBank", "Independence Avenue"),
)


def _digits(employee_number):
    return int("".join(ch for ch in employee_number if ch.isdigit()) or "0")


def demo_payment_details(index, employee):
    """Deterministic, fictional pay routing for the index-th demo employee."""
    number = _digits(employee.employee_number)
    details = {"social_security_number": f"C{number:012d}"}
    if index % 20 == 19:
        return {**details, "payment_method": EmployeePayrollProfile.PaymentMethod.CASH}
    if index % 4 == 3:
        return {**details, "payment_method": EmployeePayrollProfile.PaymentMethod.MOBILE_MONEY,
                "mobile_money_network": EmployeePayrollProfile.MobileMoneyNetwork.MTN, "mobile_money_number": f"0244{number % 1_000_000:06d}"}
    bank, branch = BANKS[index % len(BANKS)]
    return {**details, "payment_method": EmployeePayrollProfile.PaymentMethod.BANK, "bank_name": bank, "bank_branch": branch,
            "account_name": employee.full_name, "account_number": f"{9_100_000_000_000 + number}"}


def _configurer_for(institution, employee, preferred):
    """Someone who may set payroll profiles and is not the employee (nobody sets their own)."""
    if preferred and preferred.id != employee.user_id:
        return preferred
    membership = (
        InstitutionMembership.objects.filter(institution=institution, status=InstitutionMembership.Status.ACTIVE, role__permissions__code="payroll.configure")
        .exclude(user_id=employee.user_id).select_related("user").order_by("created_at").first()
    )
    return membership.user if membership else None


def ensure_demo_payment_details(institution, actor):
    """Give every demo employee without a payment method an SSNIT number and pay routing. Returns how many changed."""
    changed = 0
    profiles = {profile.employee_id: profile for profile in EmployeePayrollProfile.objects.filter(institution=institution)}
    for index, employee in enumerate(institution.employees.order_by("employee_number")):
        profile = profiles.get(employee.id)
        if profile is not None and profile.payment_method:
            continue
        configurer = _configurer_for(institution, employee, actor)
        if configurer is None:
            continue
        configure_employee_payroll_profile(
            institution=institution,
            employee=employee,
            actor=configurer,
            tax_residency=profile.tax_residency if profile else EmployeePayrollProfile.TaxResidency.RESIDENT,
            tax_identification_number=profile.tax_identification_number if profile else "",
            **demo_payment_details(index, employee),
        )
        changed += 1
    return changed


def ensure_demo_holidays(institution, actor, year=None):
    """Add the year's suggested statutory holidays that aren't there yet. Returns how many were added."""
    year = year or timezone.localdate().year
    added = 0
    for item in suggested_holidays(institution, year)["holidays"]:
        if item["already_added"]:
            continue
        holiday = PublicHoliday.objects.create(institution=institution, date=item["date"], name=item["name"], statutory_date=item["statutory_date"])
        record_audit_event(actor=actor, institution=institution, entity=holiday, action="holiday.created",
                           metadata={"date": holiday.date.isoformat(), "name": holiday.name, "source": "demo_seed"})
        added += 1
    return added
