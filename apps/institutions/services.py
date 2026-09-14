from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.institutions.models import (
    InstitutionModule,
    InstitutionMembership,
    InstitutionOnboarding,
    Permission,
    Role,
)


ACCOUNTING_PERMISSIONS = {
    "accounting.configure": "Configure institution accounting",
    "account.view": "View the chart of accounts",
    "account.create": "Create chart-of-account records",
    "account.update": "Update chart-of-account records",
    "journal.view": "View journals and ledger entries",
    "journal.create": "Create and submit journals",
    "journal.approve": "Approve journals",
    "journal.post": "Post approved journals",
    "journal.reverse": "Create journal reversals",
    "financial_report.view": "View accounting reports",
    "accounting_period.close": "Close and lock accounting periods",
    "accounting_period.reopen": "Reopen closed accounting periods",
    "vendor.view": "View vendors",
    "vendor.create": "Create vendors",
    "vendor.update": "Update vendors",
    "vendor_bill.view": "View vendor bills",
    "vendor_bill.create": "Create, edit, and submit vendor bills",
    "vendor_bill.approve": "Approve vendor bills",
    "vendor_bill.post": "Post approved vendor bills",
    "vendor_bill.void": "Void unposted vendor bills",
    "customer.view": "View customers",
    "customer.create": "Create customers",
    "customer.update": "Update customers",
    "invoice.view": "View invoices",
    "invoice.create": "Create and edit invoices",
    "invoice.issue": "Issue invoices",
    "invoice.void": "Void draft invoices",
    "bank_account.view": "View bank accounts",
    "bank_account.create": "Create bank accounts",
    "bank_account.update": "Update bank accounts",
    "payment.view": "View payments",
    "payment.create": "Create and post payments",
    "payment.void": "Void posted payments",
    "receipt.view": "View receipts",
    "receipt.create": "Create and post receipts",
    "receipt.void": "Void posted receipts",
    "expense.view": "View expenses",
    "expense.create": "Create and submit expenses",
    "expense.approve": "Approve or reject expenses",
    "expense.post": "Post approved expenses",
    "payroll_accounting.view": "View payroll accounting mappings",
    "payroll_accounting.configure": "Configure payroll accounting mappings",
    "bank_reconciliation.view": "View bank statement lines and reconciliation state",
    "bank_reconciliation.manage": "Import, match, and unmatch bank statement lines",
    "vat_withholding_certificate.view": "View VAT withholding certificates",
    "vat_withholding_certificate.issue": "Issue and void VAT withholding certificates",
}


PERMISSIONS = {
    "job_posting.view": "View job postings",
    "job_posting.create": "Create and publish job postings",
    "job_posting.update": "Update and close job postings",
    "candidate.view": "View candidates and applications",
    "candidate.create": "Create candidates and applications",
    "candidate.update": "Update candidates and move applications",
    "recruitment_stage.view": "View recruitment pipeline stages",
    "recruitment_stage.manage": "Manage recruitment pipeline stages",
    "interview.view": "View interviews and evaluations",
    "interview.manage": "Schedule and complete interviews",
    "candidate_evaluation.create": "Record candidate evaluations",
    "offer.view": "View offers",
    "offer.create": "Create and extend offers",
    "offer.manage": "Accept, decline, withdraw, and hire offers",
    "import_job.view": "View import jobs and row results",
    "import_job.create": "Create import jobs",
    "export_job.view": "View export jobs",
    "export_job.create": "Create export jobs",
    "background_job.view": "View background jobs",
    "approval_workflow.view": "View approval workflows",
    "approval_workflow.create": "Create approval workflows",
    "approval_workflow.update": "Update approval workflows",
    "approval_workflow.delete": "Deactivate approval workflows",
    "approval_request.view": "View approval requests",
    "approval_request.create": "Submit approval requests",
    "document.view": "View shared documents",
    "document.create": "Create shared document references",
    "document.update": "Update shared document metadata",
    "document.delete": "Deactivate shared documents",
    "report.view": "View and export institution reports",
    "dashboard.executive.view": "View executive dashboard",
    "dashboard.hr.view": "View HR dashboard",
    "dashboard.leave.view": "View leave dashboard",
    "dashboard.attendance.view": "View attendance dashboard",
    "dashboard.payroll.view": "View payroll dashboard",
    "dashboard.finance.view": "View finance dashboard",
    "institution.view": "View current institution",
    "organization.view": "View organization records",
    "organization.create": "Create organization records",
    "organization.update": "Update organization records",
    "organization.delete": "Deactivate or delete organization records",
    "employee.view": "View employees",
    "employee.create": "Create employees",
    "employee.update": "Update employees",
    "employee.delete": "Deactivate or delete employees",
    "employment.view": "View employment history",
    "employment.create": "Create employment records",
    "employment.update": "Update employment records",
    "employment.delete": "Delete employment records",
    "leave.view": "View leave records",
    "leave.request": "Request and submit leave",
    "leave.approve": "Approve leave requests",
    "leave.reject": "Reject leave requests",
    "leave.configure": "Configure leave types and policies",
    "leave.balance.manage": "Manage employee leave balances",
    "schedule.view": "View work schedules",
    "schedule.manage": "Configure and assign work schedules",
    "attendance.view": "View attendance records",
    "attendance.clock": "Clock in and out",
    "attendance.adjust": "Request attendance adjustments",
    "attendance.manage": "Manage attendance records",
    "attendance.approve": "Approve attendance adjustments and overtime",
    "compensation.view": "View employee compensation",
    "compensation.configure": "Configure pay components and salary structures",
    "compensation.manage": "Manage employee compensation and overrides",
    "payroll.view": "View payroll configuration and transactions",
    "payroll.configure": "Configure payroll rules and periods",
    "payroll.prepare": "Prepare and calculate payroll runs",
    "payroll.approve": "Approve payroll runs and adjustments",
    "payroll.finalize": "Finalize payroll runs",
    "payslip.view": "View payslips",
    "tax_relief.view": "View tax relief claims",
    "tax_relief.claim": "Create and submit tax relief claims",
    "tax_relief.approve": "Approve tax relief claims",
    **ACCOUNTING_PERMISSIONS,
}

PERMISSION_MODULES = {
    code: "LEAVE" for code in PERMISSIONS if code.startswith("leave.")
} | {
    code: "ATTENDANCE"
    for code in PERMISSIONS
    if code.startswith("schedule.") or code.startswith("attendance.")
} | {
    code: "PAYROLL"
    for code in PERMISSIONS
    if code.startswith(("compensation.", "payroll.", "payslip.", "tax_relief."))
} | {
    code: "ACCOUNTING" for code in ACCOUNTING_PERMISSIONS
} | {
    code: "RECRUITMENT"
    for code in PERMISSIONS
    if code.startswith(("job_posting.", "candidate.", "recruitment_stage.", "interview.", "candidate_evaluation.", "offer."))
}

ROLE_PERMISSION_CODES = {
    "INSTITUTION_ADMIN": tuple(PERMISSIONS),
    "HR_ADMIN": tuple(
        code
        for code in PERMISSIONS
        if code not in ACCOUNTING_PERMISSIONS
        and code not in {"dashboard.executive.view", "dashboard.finance.view"}
    ),
    "DIRECTOR": (
        "institution.view",
        "organization.view",
        "employee.view",
        "employment.view",
        "leave.view",
        "leave.approve",
        "leave.reject",
        "schedule.view",
        "attendance.view",
        "compensation.view",
        "dashboard.executive.view",
        "report.view",
    ),
    "EMPLOYEE": (
        "institution.view",
        "leave.view",
        "leave.request",
        "schedule.view",
        "attendance.view",
        "attendance.clock",
        "attendance.adjust",
        "compensation.view",
        "payslip.view",
        "tax_relief.view",
        "tax_relief.claim",
    ),
    "ACCOUNTANT": (
        "institution.view",
        "payroll.view",
        "payroll.prepare",
        "payslip.view",
        "tax_relief.view",
        "account.view",
        "account.create",
        "account.update",
        "journal.view",
        "journal.create",
        "financial_report.view",
        "vendor.view",
        "vendor.create",
        "vendor.update",
        "vendor_bill.view",
        "vendor_bill.create",
        "customer.view",
        "customer.create",
        "customer.update",
        "invoice.view",
        "invoice.create",
        "bank_account.view",
        "bank_account.create",
        "bank_account.update",
        "payment.view",
        "payment.create",
        "receipt.view",
        "receipt.create",
        "expense.view",
        "expense.create",
        "dashboard.finance.view",
    ),
    "FINANCE_MANAGER": (
        "institution.view",
        "payroll.view",
        "payroll.approve",
        "payroll.finalize",
        "payslip.view",
        "tax_relief.view",
        "tax_relief.approve",
        "dashboard.payroll.view",
        "dashboard.finance.view",
        "report.view",
        *ACCOUNTING_PERMISSIONS,
    ),
    "AUDITOR": (
        "institution.view",
        "payroll.view",
        "payslip.view",
        "tax_relief.view",
        "account.view",
        "journal.view",
        "financial_report.view",
        "dashboard.executive.view",
        "dashboard.finance.view",
        "report.view",
    ),
}


def ensure_system_permissions():
    permissions = {}
    for code, name in PERMISSIONS.items():
        permission, _ = Permission.objects.update_or_create(
            code=code,
            defaults={
                "name": name,
                "module_code": PERMISSION_MODULES.get(code, "CORE_HR"),
            },
        )
        permissions[code] = permission
    return permissions


@transaction.atomic
def bootstrap_institution(institution):
    permissions = ensure_system_permissions()
    for code, permission_codes in ROLE_PERMISSION_CODES.items():
        role, _ = Role.objects.update_or_create(
            institution=institution,
            code=code,
            defaults={"name": code.replace("_", " ").title(), "is_system_role": True},
        )
        role.permissions.set(permissions[item] for item in permission_codes)

    InstitutionModule.objects.get_or_create(
        institution=institution,
        module_code=InstitutionModule.ModuleCode.CORE_HR,
        defaults={
            "is_enabled": True,
            "enabled_at": timezone.now(),
            "configuration_status": InstitutionModule.ConfigurationStatus.IN_PROGRESS,
        },
    )
    for module_code in (
        InstitutionModule.ModuleCode.LEAVE,
        InstitutionModule.ModuleCode.ATTENDANCE,
        InstitutionModule.ModuleCode.PAYROLL,
        InstitutionModule.ModuleCode.ACCOUNTING,
        InstitutionModule.ModuleCode.RECRUITMENT,
    ):
        InstitutionModule.objects.get_or_create(
            institution=institution,
            module_code=module_code,
            defaults={
                "is_enabled": False,
                "configuration_status": InstitutionModule.ConfigurationStatus.NOT_CONFIGURED,
            },
        )
    InstitutionOnboarding.objects.get_or_create(institution=institution)


@transaction.atomic
def create_membership(*, user, institution, role, **values):
    if role.institution_id != institution.id:
        raise ValidationError(
            {"role": "Membership role must belong to the selected institution."}
        )
    membership = InstitutionMembership(
        user=user,
        institution=institution,
        role=role,
        **values,
    )
    membership.save()
    return membership
