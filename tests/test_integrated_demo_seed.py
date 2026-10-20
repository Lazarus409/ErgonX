from io import StringIO

import pytest
from django.core.management import call_command
from django.test import override_settings

from django.db.models import Count
from django.utils import timezone

from apps.institutions.models import Institution
from apps.organization.models import PublicHoliday
from apps.payroll.models import EmployeePayrollProfile


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_integrated_demo_seed_is_idempotent_and_preserves_progressed_leave_workflow():
    output = StringIO()
    call_command("seed_ergonx_demo", password="ErgonxDemo!2026", stdout=output)
    institution = Institution.objects.get(code="APEX-DEMO")
    baseline = {
        "institutions": Institution.objects.count(),
        "employees": institution.employees.count(),
        "leave_requests": institution.leave_requests.count(),
        "audit_events": institution.audit_logs.count(),
        "notifications": institution.notifications.count(),
    }
    output = StringIO()
    call_command("seed_ergonx_demo", password="ErgonxDemo!2026", stdout=output)

    assert "integrated demo dataset is ready" in output.getvalue()
    assert baseline == {
        "institutions": Institution.objects.count(),
        "employees": institution.employees.count(),
        "leave_requests": institution.leave_requests.count(),
        "audit_events": institution.audit_logs.count(),
        "notifications": institution.notifications.count(),
    }


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_integrated_seed_remains_valid_after_rolling_activity_is_seeded():
    call_command("seed_ergonx_demo", password="ErgonxDemo!2026", stdout=StringIO())
    call_command("seed_ergonx_activity", stdout=StringIO())

    # The fixed fixture remains rerunnable after date-relative activity adds
    # history such as extra candidates, overtime records, and payroll runs.
    call_command("seed_ergonx_demo", password="ErgonxDemo!2026", stdout=StringIO())
    call_command("seed_ergonx_demo", validate_only=True, stdout=StringIO())


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_people_seed_fills_hr_modules_and_is_idempotent():
    call_command("seed_ergonx_demo", password="ErgonxDemo!2026", stdout=StringIO())
    call_command("seed_ergonx_activity", stdout=StringIO())
    call_command("seed_ergonx_people", stdout=StringIO())
    institution = Institution.objects.get(code="APEX-DEMO")
    assert institution.name == "Apex Energy Ghana Ltd"

    def counts():
        return {
            "employees": institution.employees.count(),
            "contacts": institution.emergency_contacts.count(),
            "reviews": institution.performance_reviews.count(),
            "enrolments": institution.training_enrollments.count(),
            "requirements": institution.document_requirements.count(),
            "complaints": institution.complaints.count(),
            "claims": institution.employee_tax_relief_claims.count(),
            "paid_by": dict(
                EmployeePayrollProfile.objects.filter(institution=institution).values_list("payment_method").annotate(total=Count("pk")).order_by()
            ),
            "holidays": PublicHoliday.objects.filter(institution=institution, is_active=True, date__year=timezone.localdate().year).count(),
        }

    first = counts()
    assert first["employees"] == 42 and first["complaints"] == 7 and first["requirements"] == 6
    assert first["reviews"] > 40 and first["enrolments"] > 40 and first["claims"] == 4
    assert not institution.employees.filter(work_email__endswith=".test").exists()
    # Everyone can be paid: mostly by bank, some by mobile money, a few in cash; this year's holidays exist.
    assert sum(first["paid_by"].values()) == first["employees"] and "" not in first["paid_by"]
    assert first["paid_by"]["BANK"] > first["paid_by"]["MOBILE_MONEY"] > first["paid_by"]["CASH"] > 0
    assert first["holidays"] >= 11
    # A change made in the demo survives a re-seed.
    edited = EmployeePayrollProfile.objects.filter(institution=institution, payment_method="BANK").first()
    EmployeePayrollProfile.objects.filter(pk=edited.pk).update(bank_name="Edited Bank")
    call_command("seed_ergonx_people", stdout=StringIO())
    assert EmployeePayrollProfile.objects.get(pk=edited.pk).bank_name == "Edited Bank"
    call_command("seed_ergonx_demo", password="ErgonxDemo!2026", stdout=StringIO())
    assert counts() == first


@pytest.mark.django_db
@override_settings(DEBUG=False)
@pytest.mark.parametrize("command", ["seed_ergonx_demo", "seed_ergonx_activity", "seed_ergonx_people"])
def test_demo_seeds_need_an_explicit_opt_in_on_a_server(command, monkeypatch):
    from django.core.management.base import CommandError

    monkeypatch.delenv("ERGONX_ALLOW_DEMO_SEED", raising=False)
    with pytest.raises(CommandError, match="development-only"):
        call_command(command, stdout=StringIO())
    monkeypatch.setenv("ERGONX_ALLOW_DEMO_SEED", "true")
    if command != "seed_ergonx_demo":
        # Past the guard: the follow-up seeds then insist on the foundation.
        with pytest.raises(CommandError, match="does not exist"):
            call_command(command, stdout=StringIO())
