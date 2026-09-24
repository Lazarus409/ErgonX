from io import StringIO

import pytest
from django.core.management import call_command
from django.test import override_settings

from apps.institutions.models import Institution


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
