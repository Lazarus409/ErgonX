"""Go-live readiness: what an institution still needs after setup before it runs on ErgonX.

The onboarding checklist (apps.institutions.services) validates configuration; this looks at
the people data a real organisation needs: staff with employment records, leave policies,
this year's holidays, pay and payment details, self-service invitations and a first payroll.
Each item is counted, so the card can say "12 of 40 employees have payment details".
"""

from django.db.models import Q
from django.utils import timezone

from apps.compensation.models import EmployeeCompensation
from apps.employees.models import Employee, Employment
from apps.institutions.models import InstitutionInvitation
from apps.leave.models import LeavePolicy
from apps.organization.models import PublicHoliday
from apps.payroll.models import EmployeePayrollProfile, PayrollRun

VIEWER_PERMISSIONS = {"employee.create", "settings.institution.manage"}


def _item(code, title, done, total, href, action, detail):
    complete = total > 0 and done >= total
    return {"code": code, "title": title, "done": done, "total": total, "complete": complete, "href": href, "action": action, "detail": detail}


def go_live_checklist(*, institution, permission_codes):
    if not (VIEWER_PERMISSIONS & set(permission_codes)) and "*" not in permission_codes:
        return {"applicable": False, "items": [], "complete": True}
    enabled = set(institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
    today = timezone.localdate()
    active = Employee.objects.for_institution(institution).filter(status=Employee.Status.ACTIVE)
    active_count = active.count()
    items = [
        _item("EMPLOYEES", "Add your employees", min(active_count, 1), 1, "/hr/employees/import", "Import employees",
              f"{active_count} active employee{'s' if active_count != 1 else ''}." if active_count else "Import them from a spreadsheet or add them one by one."),
    ]
    if active_count:
        employed = active.filter(employments__is_current=True).distinct().count()
        items.append(_item("EMPLOYMENT", "Give everyone a current employment record", employed, active_count, "/hr/employees", "Review employees",
                           f"{employed} of {active_count} have a department, position and start date."))
    if "LEAVE" in enabled:
        policies = LeavePolicy.objects.for_institution(institution).filter(is_active=True, effective_from__lte=today).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=today)).count()
        items.append(_item("LEAVE_POLICIES", "Set up leave policies", min(policies, 1), 1, "/leave/policies", "Open leave policies",
                           f"{policies} policy in force." if policies == 1 else f"{policies} policies in force."))
    holidays = PublicHoliday.objects.filter(institution=institution, is_active=True, date__year=today.year).count()
    items.append(_item("HOLIDAYS", f"Add {today.year} public holidays", min(holidays, 1), 1, "/settings/holidays", "Add holidays",
                       f"{holidays} holiday{'s' if holidays != 1 else ''} for {today.year}." if holidays else "Leave and payroll use them to count working days."))
    if "PAYROLL" in enabled and active_count:
        paid = EmployeeCompensation.objects.filter(institution=institution, employee__in=active, is_current=True).values("employee").distinct().count()
        items.append(_item("PAY", "Set everyone's pay", paid, active_count, "/hr/employees", "Review employees", f"{paid} of {active_count} have a current salary."))
        with_details = EmployeePayrollProfile.objects.filter(institution=institution, employee__in=active).exclude(payment_method="").count()
        items.append(_item("PAYMENT_DETAILS", "Record how each person is paid", with_details, active_count, "/payroll/employee-profiles", "Add payment details",
                           f"{with_details} of {active_count} have a bank account, wallet or other method."))
        finalized = PayrollRun.objects.filter(institution=institution, status=PayrollRun.Status.FINALIZED).exists()
        items.append(_item("FIRST_PAYROLL", "Run your first payroll", int(finalized), 1, "/payroll/runs", "Open payroll runs",
                           "Done." if finalized else "Calculate, review, approve and finalize a run."))
    if active_count:
        invited_ids = set(
            InstitutionInvitation.objects.filter(institution=institution, employee__in=active, status=InstitutionInvitation.Status.PENDING).values_list("employee_id", flat=True)
        ) | set(active.filter(user__isnull=False).values_list("id", flat=True))
        items.append(_item("SELF_SERVICE", "Invite staff to self-service", len(invited_ids), active_count, "/hr/employees", "Invite employees",
                           f"{len(invited_ids)} of {active_count} can sign in or have an invitation."))
    return {"applicable": True, "items": items, "complete": all(item["complete"] for item in items)}
