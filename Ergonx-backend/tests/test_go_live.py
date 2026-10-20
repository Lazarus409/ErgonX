from datetime import date

import pytest
from django.utils import timezone

from apps.institutions.models import InstitutionModule
from apps.organization.models import PublicHoliday
from apps.payroll.models import EmployeePayrollProfile
from tests.test_payroll import _employee_with_pay

pytestmark = pytest.mark.django_db
URL = "/api/v1/home/go-live/"


def test_go_live_counts_what_is_missing_and_hides_from_staff(
    api_client, institution_factory, user_factory, membership_factory, employee_factory, organization_factory, assignment_dimensions_factory,
):
    institution = institution_factory()
    InstitutionModule.objects.filter(institution=institution, module_code="PAYROLL").update(is_enabled=True)
    hr, staff = user_factory(), user_factory()
    membership_factory(user=hr, institution=institution, role_code="HR_ADMIN", is_primary=True)
    membership_factory(user=staff, institution=institution, role_code="EMPLOYEE", is_primary=True)
    api_client.force_authenticate(hr)

    empty = api_client.get(URL).data
    assert empty["applicable"] is True and empty["complete"] is False
    assert {item["code"]: item["complete"] for item in empty["items"]}["EMPLOYEES"] is False

    paid = _employee_with_pay(institution, employee_factory, organization_factory, assignment_dimensions_factory, employee_number="EMP001")
    _employee_with_pay(institution, employee_factory, organization_factory, assignment_dimensions_factory, employee_number="EMP002")
    EmployeePayrollProfile.objects.create(institution=institution, employee=paid, tax_residency="RESIDENT", payment_method="CASH")
    PublicHoliday.objects.create(institution=institution, date=date(timezone.localdate().year, 12, 25), name="Christmas Day")

    items = {item["code"]: item for item in api_client.get(URL).data["items"]}
    assert items["EMPLOYEES"]["complete"] is True
    assert (items["EMPLOYMENT"]["done"], items["EMPLOYMENT"]["total"]) == (2, 2)
    assert (items["PAY"]["done"], items["PAY"]["total"]) == (2, 2)
    assert (items["PAYMENT_DETAILS"]["done"], items["PAYMENT_DETAILS"]["total"], items["PAYMENT_DETAILS"]["href"]) == (1, 2, "/payroll/employee-profiles")
    assert items["HOLIDAYS"]["complete"] is True
    assert items["FIRST_PAYROLL"]["complete"] is False
    assert (items["SELF_SERVICE"]["done"], items["SELF_SERVICE"]["total"]) == (0, 2)

    api_client.force_authenticate(staff)
    assert api_client.get(URL).data == {"applicable": False, "items": [], "complete": True}
