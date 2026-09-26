from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from django.utils.crypto import salted_hmac
import secrets

from apps.institutions.models import (
    InstitutionModule,
    InstitutionMembership,
    InstitutionOnboarding,
    InstitutionOnboardingStep,
    Permission,
    ReferenceSequence,
    Role,
    InstitutionInvitation,
    UserActivityEvent,
)
from apps.audit.services import record_audit_event
from common.exceptions import CodedValidationError


RESERVED_ROLE_CODES = frozenset(
    {
        "INSTITUTION_ADMIN",
        "HR_ADMIN",
        "DIRECTOR",
        "EMPLOYEE",
        "ACCOUNTANT",
        "FINANCE_MANAGER",
        "AUDITOR",
        "DEPARTMENT_HEAD",
    }
)


REFERENCE_DEFAULTS = {
    "EMPLOYEE": ("EMP", 6, ReferenceSequence.ResetPolicy.NEVER),
    "JOB_OPENING": ("JOB", 6, ReferenceSequence.ResetPolicy.YEARLY),
    "APPLICATION": ("APP", 6, ReferenceSequence.ResetPolicy.YEARLY),
    "OFFER": ("OFF", 6, ReferenceSequence.ResetPolicy.YEARLY),
    "PAYROLL_RUN": ("PR", 4, ReferenceSequence.ResetPolicy.MONTHLY),
    "JOURNAL": ("JE", 6, ReferenceSequence.ResetPolicy.YEARLY),
    "VENDOR_BILL": ("BILL", 6, ReferenceSequence.ResetPolicy.YEARLY),
    "INVOICE": ("INV", 6, ReferenceSequence.ResetPolicy.YEARLY),
    "PAYMENT": ("PAY", 6, ReferenceSequence.ResetPolicy.YEARLY),
    "RECEIPT": ("RCT", 6, ReferenceSequence.ResetPolicy.YEARLY),
    "EXPENSE": ("EXP", 6, ReferenceSequence.ResetPolicy.YEARLY),
}


ONBOARDING_STEP_DEFINITIONS = (
    ("INSTITUTION_PROFILE", 10, ""),
    ("MODULE_SELECTION", 20, ""),
    ("ORGANIZATION_SETUP", 30, "CORE_HR"),
    ("HR_CONFIGURATION", 40, "CORE_HR"),
    ("SCHEDULING_CONFIGURATION", 50, "ATTENDANCE"),
    ("PAYROLL_CONFIGURATION", 60, "PAYROLL"),
    ("ACCOUNTING_CONFIGURATION", 70, "ACCOUNTING"),
    ("PAYROLL_GL_MAPPING", 80, ""),
    ("RECRUITMENT_CONFIGURATION", 90, "RECRUITMENT"),
    ("USERS_AND_ROLES", 100, "CORE_HR"),
    ("VALIDATION", 110, ""),
)

ONBOARDING_SETUP_OWNER_ROLES = (
    "HR_ADMIN",
    "FINANCE_MANAGER",
    "ACCOUNTANT",
    "AUDITOR",
    "DIRECTOR",
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
    "home.view": "View personalized home",
    "search.use": "Use universal search",
    "settings.profile.manage_self": "Manage personal preferences",
    "settings.institution.view": "View institution settings",
    "settings.institution.manage": "Manage institution settings",
    "settings.modules.manage": "Manage institution modules",
    "settings.users.manage": "Manage institution memberships",
    "settings.roles.manage": "Manage custom roles and permissions",
    "settings.notifications.manage": "Manage notification settings",
    "settings.security.manage": "Manage institution security settings",
    "audit.view": "View institution audit history",
    "onboarding.view": "View institution onboarding state",
    "onboarding.manage": "Manage institution onboarding",
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
    "dashboard.department.view": "View the dashboard for departments the member heads",
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

# What every staff member needs for their own leave, attendance and payslips.
# Institution-wide roles holding these see only their own rows unless they
# also hold the module's management permissions (see common.scoping).
SELF_SERVICE_PERMISSIONS = (
    "leave.view",
    "leave.request",
    "schedule.view",
    "attendance.view",
    "attendance.clock",
    "attendance.adjust",
    "payslip.view",
)

ROLE_PERMISSION_CODES = {
    "INSTITUTION_ADMIN": tuple(PERMISSIONS),
    "HR_ADMIN": tuple(
        code
        for code in PERMISSIONS
        if code not in ACCOUNTING_PERMISSIONS
        and code not in {"dashboard.executive.view", "dashboard.finance.view"}
        and code not in {
            "settings.institution.manage",
            "settings.modules.manage",
            "settings.users.manage",
            "settings.roles.manage",
            "settings.notifications.manage",
            "settings.security.manage",
            "onboarding.manage",
        }
    ),
    "DIRECTOR": (
        *SELF_SERVICE_PERMISSIONS,
        "home.view",
        "search.use",
        "settings.profile.manage_self",
        "institution.view",
        "organization.view",
        "employee.view",
        "employment.view",
        "leave.view",
        "leave.approve",
        "leave.reject",
        "dashboard.leave.view",
        "schedule.view",
        "attendance.view",
        "dashboard.attendance.view",
        "compensation.view",
        "payroll.view",
        "payslip.view",
        "tax_relief.view",
        "dashboard.payroll.view",
        "job_posting.view",
        "candidate.view",
        "recruitment_stage.view",
        "interview.view",
        "offer.view",
        "dashboard.executive.view",
        "report.view",
    ),
    "EMPLOYEE": (
        "home.view",
        "search.use",
        "settings.profile.manage_self",
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
    # Data is limited to the member and the departments they head; pay records
    # stay self-only (see common.scoping).
    "DEPARTMENT_HEAD": (
        "home.view",
        "search.use",
        "settings.profile.manage_self",
        "institution.view",
        "organization.view",
        "employee.view",
        "employment.view",
        "leave.view",
        "leave.request",
        "leave.approve",
        "leave.reject",
        "schedule.view",
        "attendance.view",
        "attendance.clock",
        "attendance.adjust",
        "compensation.view",
        "payslip.view",
        "tax_relief.view",
        "tax_relief.claim",
        "dashboard.department.view",
    ),
    "ACCOUNTANT": (
        *SELF_SERVICE_PERMISSIONS,
        "home.view",
        "search.use",
        "settings.profile.manage_self",
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
        *SELF_SERVICE_PERMISSIONS,
        "home.view",
        "search.use",
        "settings.profile.manage_self",
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
        *SELF_SERVICE_PERMISSIONS,
        "home.view",
        "search.use",
        "settings.profile.manage_self",
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
        "audit.view",
        "approval_request.view",
    ),
}

ROLE_PERMISSION_CODES = {code: tuple(dict.fromkeys(codes)) for code, codes in ROLE_PERMISSION_CODES.items()}


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


def effective_permission_codes(membership):
    if membership is None or membership.status != InstitutionMembership.Status.ACTIVE:
        return ()
    return tuple(membership.role.permissions.order_by("code").values_list("code", flat=True))


def _assert_active_actor(actor, institution):
    if actor is None or not actor.memberships.filter(
        institution=institution, status=InstitutionMembership.Status.ACTIVE
    ).exists():
        raise CodedValidationError(
            "Actor must have an active membership.", api_code="membership_inactive"
        )


def record_user_activity(*, actor, institution, activity_code, entity=None):
    """Record a tenant-scoped, resumable user action for the Home workspace.

    This is intentionally an append-only experience event, not an audit-log
    substitute. Call it inside the domain transaction after the authoritative
    write succeeds so a rolled-back workflow never appears as recent work.
    """
    _assert_active_actor(actor, institution)
    if entity is not None and getattr(entity, "institution_id", None) != institution.id:
        raise ValidationError({"entity": "Activity entity must belong to the current institution."})
    return UserActivityEvent.objects.create(
        user=actor,
        institution=institution,
        activity_code=activity_code,
        entity_type=entity._meta.label if entity is not None else "",
        entity_id=entity.pk if entity is not None else None,
        occurred_at=timezone.now(),
    )


def _validate_delegable_permissions(permission_codes):
    permissions = list(Permission.objects.filter(code__in=set(permission_codes)))
    found = {item.code for item in permissions}
    missing = set(permission_codes) - found
    if missing:
        raise ValidationError({"permissions": f"Unknown permission code(s): {', '.join(sorted(missing))}."})
    platform_only = [item.code for item in permissions if item.classification == Permission.Classification.PLATFORM_ONLY]
    if platform_only:
        raise CodedValidationError(
            f"Platform-only permission(s) cannot be delegated: {', '.join(platform_only)}.",
            api_code="permission_not_delegable",
        )
    return permissions


def _ensure_admin_continuity(*, membership, next_role=None, next_status=None):
    role = next_role or membership.role
    status = next_status or membership.status
    leaves_active_admin = (
        membership.status == InstitutionMembership.Status.ACTIVE
        and membership.role.code == "INSTITUTION_ADMIN"
        and (status != InstitutionMembership.Status.ACTIVE or role.code != "INSTITUTION_ADMIN")
    )
    if not leaves_active_admin:
        return
    other_admin_exists = InstitutionMembership.objects.filter(
        institution=membership.institution,
        status=InstitutionMembership.Status.ACTIVE,
        role__code="INSTITUTION_ADMIN",
    ).exclude(pk=membership.pk).exists()
    if not other_admin_exists:
        raise CodedValidationError(
            "An institution must retain at least one active Institution Admin.",
            api_code="last_required_admin",
        )


@transaction.atomic
def create_custom_role(*, institution, actor, code, name, description="", permission_codes=()):
    _assert_active_actor(actor, institution)
    normalized_code = code.strip().upper()
    if normalized_code in RESERVED_ROLE_CODES:
        raise CodedValidationError("Reserved role codes cannot be created as custom roles.", api_code="role_protected")
    permissions = _validate_delegable_permissions(permission_codes)
    role = Role(
        institution=institution,
        code=normalized_code,
        name=name.strip(),
        description=description,
        is_system_role=False,
        is_custom=True,
        created_by=actor,
    )
    role.full_clean()
    role.save()
    role.permissions.set(permissions)
    record_audit_event(actor=actor, institution=institution, entity=role, action="access.role.created", metadata={"permission_codes": sorted(item.code for item in permissions)})
    return role


@transaction.atomic
def clone_role(*, source_role, institution, actor, code, name, description=""):
    if source_role.institution_id != institution.id:
        raise ValidationError({"source_role": "Role belongs to another institution."})
    return create_custom_role(
        institution=institution,
        actor=actor,
        code=code,
        name=name,
        description=description or source_role.description,
        permission_codes=list(source_role.permissions.values_list("code", flat=True)),
    )


@transaction.atomic
def update_custom_role(*, role, institution, actor, name=None, description=None, permission_codes=None, is_active=None):
    _assert_active_actor(actor, institution)
    locked = Role.objects.select_for_update().get(pk=role.pk)
    if locked.institution_id != institution.id:
        raise ValidationError({"role": "Role belongs to another institution."})
    if locked.is_system_role or locked.code in RESERVED_ROLE_CODES:
        raise CodedValidationError("Reserved system roles cannot be changed.", api_code="role_protected")
    old_permissions = sorted(locked.permissions.values_list("code", flat=True))
    if name is not None:
        locked.name = name.strip()
    if description is not None:
        locked.description = description
    if is_active is not None:
        locked.is_active = is_active
    locked.full_clean()
    locked.save()
    if permission_codes is not None:
        permissions = _validate_delegable_permissions(permission_codes)
        locked.permissions.set(permissions)
    record_audit_event(actor=actor, institution=institution, entity=locked, action="access.role.updated", metadata={"old_permission_codes": old_permissions, "new_permission_codes": sorted(locked.permissions.values_list("code", flat=True))})
    return locked


@transaction.atomic
def update_membership(*, membership, institution, actor, role=None, status=None, is_primary=None):
    _assert_active_actor(actor, institution)
    locked = InstitutionMembership.objects.select_for_update().select_related("role").get(pk=membership.pk)
    if locked.institution_id != institution.id:
        raise ValidationError({"membership": "Membership belongs to another institution."})
    if role is not None and role.institution_id != institution.id:
        raise ValidationError({"role": "Role belongs to another institution."})
    next_status = status if status is not None else locked.status
    _ensure_admin_continuity(membership=locked, next_role=role, next_status=next_status)
    old_values = {"role": locked.role.code, "status": locked.status, "is_primary": locked.is_primary}
    if role is not None:
        if not role.is_active:
            raise ValidationError({"role": "An inactive role cannot be assigned."})
        locked.role = role
    if status is not None:
        locked.status = status
        if status == InstitutionMembership.Status.ACTIVE and locked.joined_at is None:
            locked.joined_at = timezone.now()
        if status in (InstitutionMembership.Status.SUSPENDED, InstitutionMembership.Status.INACTIVE):
            locked.ended_at = timezone.now()
    if is_primary is not None:
        locked.is_primary = is_primary
    locked.full_clean()
    locked.save()
    record_audit_event(
        actor=actor,
        institution=institution,
        entity=locked,
        action="access.membership.updated",
        metadata={
            "old": old_values,
            "new": {"role": locked.role.code, "status": locked.status, "is_primary": locked.is_primary},
        },
    )
    return locked


def _reset_key(policy, at):
    if policy == ReferenceSequence.ResetPolicy.YEARLY:
        return str(at.year)
    if policy == ReferenceSequence.ResetPolicy.MONTHLY:
        return at.strftime("%Y-%m")
    return ""


@transaction.atomic
def next_reference(*, institution, namespace, at=None):
    """Issue a locked, tenant-local reference. Failed outer transactions roll back increments."""
    at = at or timezone.localdate()
    namespace = namespace.strip().upper()
    default = REFERENCE_DEFAULTS.get(namespace)
    if default is None:
        raise ValidationError({"namespace": "Unsupported reference namespace."})
    prefix, padding, policy = default
    try:
        sequence, _ = ReferenceSequence.objects.get_or_create(
            institution=institution,
            namespace=namespace,
            defaults={"prefix": prefix, "padding": padding, "reset_policy": policy},
        )
    except IntegrityError:
        sequence = ReferenceSequence.objects.get(institution=institution, namespace=namespace)
    sequence = ReferenceSequence.objects.select_for_update().get(pk=sequence.pk)
    reset_key = _reset_key(sequence.reset_policy, at)
    if reset_key and sequence.last_reset_key != reset_key:
        sequence.current_value = 0
        sequence.last_reset_key = reset_key
    sequence.current_value += 1
    sequence.save(update_fields=("current_value", "last_reset_key", "updated_at"))
    prefix_parts = [sequence.prefix]
    if sequence.reset_policy == ReferenceSequence.ResetPolicy.YEARLY:
        prefix_parts.append(str(at.year))
    elif sequence.reset_policy == ReferenceSequence.ResetPolicy.MONTHLY:
        prefix_parts.extend((str(at.year), f"{at.month:02d}"))
    prefix_parts.append(f"{sequence.current_value:0{sequence.padding}d}")
    return "-".join(prefix_parts)


def _onboarding_step_blocker(institution, step):
    from apps.organization.models import Department, Grade, Location, Position

    if step.code == "INSTITUTION_PROFILE":
        if not institution.email or not institution.timezone or not institution.country_code:
            return ("INSTITUTION_PROFILE_INCOMPLETE", "Add the institution email, country, and timezone.")
    elif step.code == "MODULE_SELECTION":
        if not institution.modules.filter(is_enabled=True).exists():
            return ("NO_MODULE_ENABLED", "Enable at least the Core HR module.")
    elif step.code == "ORGANIZATION_SETUP":
        checks = ((Department, "department"), (Position, "position"), (Grade, "grade"), (Location, "location"))
        missing = [name for model, name in checks if not model.objects.for_institution(institution).exists()]
        if missing:
            return ("ORGANIZATION_SETUP_INCOMPLETE", f"Create at least one {', '.join(missing)}.")
    elif step.code == "HR_CONFIGURATION":
        if not institution.modules.filter(module_code="CORE_HR", configuration_status=InstitutionModule.ConfigurationStatus.READY).exists():
            return ("CORE_HR_NOT_READY", "Core HR configuration must be marked ready by server validation.")
    elif step.code == "SCHEDULING_CONFIGURATION":
        if not institution.work_schedules.filter(is_active=True).exists():
            return ("SCHEDULE_REQUIRED", "Create at least one active work schedule.")
    elif step.code == "PAYROLL_GL_MAPPING":
        if not institution.pay_component_account_mappings.filter(is_active=True).exists():
            return ("PAYROLL_GL_MAPPING_REQUIRED", "Create at least one active payroll-to-account mapping.")
    elif step.code == "USERS_AND_ROLES":
        if not InstitutionMembership.objects.filter(
            institution=institution,
            status=InstitutionMembership.Status.ACTIVE,
            role__code="INSTITUTION_ADMIN",
        ).exists():
            return ("ACTIVE_ADMIN_REQUIRED", "At least one active Institution Admin is required.")
        assigned_owner_roles = set(
            InstitutionMembership.objects.filter(
                institution=institution,
                status__in=(InstitutionMembership.Status.INVITED, InstitutionMembership.Status.ACTIVE),
                role__code__in=ONBOARDING_SETUP_OWNER_ROLES,
            ).values_list("role__code", flat=True)
        )
        pending_owner_roles = set(
            InstitutionInvitation.objects.filter(
                institution=institution,
                status=InstitutionInvitation.Status.PENDING,
                role__code__in=ONBOARDING_SETUP_OWNER_ROLES,
            ).values_list("role__code", flat=True)
        )
        missing = [
            code.replace("_", " ").title()
            for code in ONBOARDING_SETUP_OWNER_ROLES
            if code not in assigned_owner_roles | pending_owner_roles
        ]
        if missing:
            return (
                "SETUP_OWNERS_REQUIRED",
                f"Invite a setup owner for: {', '.join(missing)}.",
            )
    return None


def _onboarding_step_required(code, required_module, enabled_modules):
    """Return whether an onboarding item applies to the selected modules."""
    if code == "PAYROLL_GL_MAPPING":
        return {"PAYROLL", "ACCOUNTING"}.issubset(enabled_modules)
    return not required_module or required_module in enabled_modules


@transaction.atomic
def reconcile_institution_onboarding(institution):
    enabled_modules = set(institution.modules.filter(is_enabled=True).values_list("module_code", flat=True))
    definitions_by_code = {code: (sequence, required_module) for code, sequence, required_module in ONBOARDING_STEP_DEFINITIONS}
    existing_steps = {step.code: step for step in institution.onboarding_steps.all()}
    # The onboarding flow can gain a step over time. Move existing sequence
    # values out of the way first so a new step never collides with an old one.
    needs_resequence = (
        set(existing_steps) != set(definitions_by_code)
        or any(
            step.sequence != definitions_by_code[code][0]
            or step.required_module != definitions_by_code[code][1]
            for code, step in existing_steps.items()
            if code in definitions_by_code
        )
    )
    if needs_resequence and existing_steps:
        InstitutionOnboardingStep.objects.filter(institution=institution).update(sequence=F("sequence") + 1000)

    for code, sequence, required_module in ONBOARDING_STEP_DEFINITIONS:
        step, created = InstitutionOnboardingStep.objects.get_or_create(
            institution=institution,
            code=code,
            defaults={"sequence": sequence, "required_module": required_module},
        )
        if not created and (step.sequence != sequence or step.required_module != required_module):
            step.sequence = sequence
            step.required_module = required_module
            step.save(update_fields=("sequence", "required_module", "updated_at"))
        applies = _onboarding_step_required(code, required_module, enabled_modules)
        if not applies and step.status != InstitutionOnboardingStep.Status.COMPLETED:
            step.status = InstitutionOnboardingStep.Status.SKIPPED
            step.is_admin_skipped = False
            step.blocker_code = ""
            step.blocker_message = ""
            step.save(update_fields=("status", "is_admin_skipped", "blocker_code", "blocker_message", "updated_at"))
        elif applies and step.status == InstitutionOnboardingStep.Status.SKIPPED and not step.is_admin_skipped:
            step.status = InstitutionOnboardingStep.Status.PENDING
            step.blocker_code = ""
            step.blocker_message = ""
            step.completed_at = None
            step.save(update_fields=("status", "blocker_code", "blocker_message", "completed_at", "updated_at"))
    return list(institution.onboarding_steps.order_by("sequence", "created_at"))


@transaction.atomic
def skip_institution_onboarding_step(*, institution, actor, step_code):
    """Allow an Institution Admin to defer any onboarding item deliberately."""
    _assert_active_actor(actor, institution)
    step = institution.onboarding_steps.get(code=step_code)
    step.status = InstitutionOnboardingStep.Status.SKIPPED
    step.is_admin_skipped = True
    step.blocker_code = ""
    step.blocker_message = ""
    step.save(update_fields=("status", "is_admin_skipped", "blocker_code", "blocker_message", "updated_at"))
    return step


@transaction.atomic
def resume_institution_onboarding_step(*, institution, actor, step_code):
    """Return a deferred onboarding item to the administrator's checklist."""
    _assert_active_actor(actor, institution)
    step = institution.onboarding_steps.get(code=step_code)
    step.status = InstitutionOnboardingStep.Status.PENDING
    step.is_admin_skipped = False
    step.blocker_code = ""
    step.blocker_message = ""
    step.completed_at = None
    step.save(update_fields=("status", "is_admin_skipped", "blocker_code", "blocker_message", "completed_at", "updated_at"))
    return step


def _reconcile_core_hr_configuration(institution):
    """Derive Core HR readiness from its real minimum organisation structure.

    Core HR has no separate client-controlled "mark ready" action.  Its
    readiness is therefore server-derived: once a tenant has each required
    organisation record, the module is ready for the onboarding validator.
    """
    from apps.organization.models import Department, Grade, Location, Position

    module = institution.modules.filter(
        module_code=InstitutionModule.ModuleCode.CORE_HR,
    ).first()
    if not module or not module.is_enabled:
        return

    structure_is_ready = all(
        model.objects.for_institution(institution).exists()
        for model in (Department, Position, Grade, Location)
    )
    status = (
        InstitutionModule.ConfigurationStatus.READY
        if structure_is_ready
        else InstitutionModule.ConfigurationStatus.IN_PROGRESS
    )
    if module.configuration_status != status:
        module.configuration_status = status
        module.save(update_fields=("configuration_status", "updated_at"))


def _reconcile_module_configuration(institution, module_code, is_ready):
    module = institution.modules.filter(module_code=module_code).first()
    if not module or not module.is_enabled:
        return
    status = (
        InstitutionModule.ConfigurationStatus.READY
        if is_ready
        else InstitutionModule.ConfigurationStatus.IN_PROGRESS
    )
    if module.configuration_status != status:
        module.configuration_status = status
        module.save(update_fields=("configuration_status", "updated_at"))


def _reconcile_enabled_module_configurations(institution):
    from apps.accounting.models import InstitutionAccountingConfiguration
    from apps.payroll.models import InstitutionPayrollConfiguration
    from apps.recruitment.models import RecruitmentStage
    from apps.scheduling.models import WorkSchedule

    _reconcile_module_configuration(
        institution,
        InstitutionModule.ModuleCode.ATTENDANCE,
        WorkSchedule.objects.filter(institution=institution, is_active=True).exists(),
    )
    _reconcile_module_configuration(
        institution,
        InstitutionModule.ModuleCode.PAYROLL,
        InstitutionPayrollConfiguration.objects.filter(institution=institution, is_configured=True).exists(),
    )
    _reconcile_module_configuration(
        institution,
        InstitutionModule.ModuleCode.ACCOUNTING,
        InstitutionAccountingConfiguration.objects.filter(institution=institution, is_configured=True).exists(),
    )
    _reconcile_module_configuration(
        institution,
        InstitutionModule.ModuleCode.RECRUITMENT,
        RecruitmentStage.objects.filter(institution=institution, is_active=True).exists(),
    )


@transaction.atomic
def validate_institution_onboarding(*, institution, actor):
    _assert_active_actor(actor, institution)
    _reconcile_core_hr_configuration(institution)
    _reconcile_enabled_module_configurations(institution)
    steps = reconcile_institution_onboarding(institution)
    completed = 0
    blockers = []
    for step in steps:
        if step.status == InstitutionOnboardingStep.Status.SKIPPED:
            completed += 1
            continue
        if step.code == "VALIDATION":
            prior_steps_ready = all(
                prior_step.status in (
                    InstitutionOnboardingStep.Status.COMPLETED,
                    InstitutionOnboardingStep.Status.SKIPPED,
                )
                for prior_step in steps
                if prior_step.sequence < step.sequence
            )
            if prior_steps_ready:
                step.status = InstitutionOnboardingStep.Status.COMPLETED
                step.completed_at = step.completed_at or timezone.now()
                completed += 1
            else:
                step.status = InstitutionOnboardingStep.Status.PENDING
                step.completed_at = None
            step.blocker_code = ""
            step.blocker_message = ""
            step.save(update_fields=("status", "blocker_code", "blocker_message", "completed_at", "updated_at"))
            continue
        if step.code in {"SCHEDULING_CONFIGURATION", "PAYROLL_CONFIGURATION", "ACCOUNTING_CONFIGURATION", "RECRUITMENT_CONFIGURATION"}:
            module_code = step.required_module
            module_ready = institution.modules.filter(
                module_code=module_code,
                is_enabled=True,
                configuration_status=InstitutionModule.ConfigurationStatus.READY,
            ).exists()
            if not module_ready:
                step.status = InstitutionOnboardingStep.Status.PENDING
                step.blocker_code = ""
                step.blocker_message = ""
                step.completed_at = None
                step.save(update_fields=("status", "blocker_code", "blocker_message", "completed_at", "updated_at"))
                continue
        if step.code == "PAYROLL_GL_MAPPING":
            prerequisites_ready = institution.modules.filter(
                module_code__in=("PAYROLL", "ACCOUNTING"),
                is_enabled=True,
                configuration_status=InstitutionModule.ConfigurationStatus.READY,
            ).count() == 2
            if not prerequisites_ready:
                step.status = InstitutionOnboardingStep.Status.PENDING
                step.blocker_code = ""
                step.blocker_message = ""
                step.completed_at = None
                step.save(update_fields=("status", "blocker_code", "blocker_message", "completed_at", "updated_at"))
                continue
        blocker = _onboarding_step_blocker(institution, step)
        if blocker:
            step.status = InstitutionOnboardingStep.Status.BLOCKED
            step.blocker_code, step.blocker_message = blocker
            blockers.append({"step": step.code, "code": blocker[0], "message": blocker[1]})
        else:
            step.status = InstitutionOnboardingStep.Status.COMPLETED
            step.completed_at = step.completed_at or timezone.now()
            step.blocker_code = ""
            step.blocker_message = ""
            completed += 1
        step.save(update_fields=("status", "blocker_code", "blocker_message", "completed_at", "updated_at"))
    onboarding, _ = InstitutionOnboarding.objects.get_or_create(institution=institution)
    onboarding.completion_percentage = round((completed / len(steps)) * 100) if steps else 0
    onboarding.started_at = onboarding.started_at or timezone.now()
    onboarding.validation_summary = {"blockers": blockers}
    onboarding.current_step = next((step.code for step in steps if step.status not in ("COMPLETED", "SKIPPED")), "VALIDATION")
    if blockers:
        onboarding.status = InstitutionOnboarding.Status.BLOCKED
        onboarding.completed_at = None
        onboarding.completed_by = None
    elif completed == len(steps):
        onboarding.status = InstitutionOnboarding.Status.READY
        onboarding.completed_at = timezone.now()
        onboarding.completed_by = actor
    else:
        onboarding.status = InstitutionOnboarding.Status.IN_PROGRESS
    onboarding.save()
    record_audit_event(actor=actor, institution=institution, entity=onboarding, action="institution.onboarding.validated", metadata=onboarding.validation_summary)
    return onboarding, steps


@transaction.atomic
def bootstrap_institution(institution):
    permissions = ensure_system_permissions()
    for code, permission_codes in ROLE_PERMISSION_CODES.items():
        role, _ = Role.objects.update_or_create(
            institution=institution,
            code=code,
            defaults={"name": code.replace("_", " ").title(), "is_system_role": True, "is_custom": False},
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
        InstitutionModule.ModuleCode.REPORTS,
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
    reconcile_institution_onboarding(institution)


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


@transaction.atomic
def invite_existing_user(*, email, institution, role, actor, is_primary=False):
    """Create or reactivate an invitation for an existing ErgonX account.

    Delivery is deliberately outside this service: no email-provider contract
    exists yet. The invited account will see the membership after sign-in.
    """
    from apps.accounts.models import User

    _assert_active_actor(actor, institution)
    user = User.objects.filter(email__iexact=email.strip()).first()
    if user is None:
        raise CodedValidationError(
            "No ErgonX account exists for that email address.",
            api_code="invitee_not_found",
        )
    if role.institution_id != institution.id or not role.is_active:
        raise ValidationError({"role": "Select an active role from this institution."})
    membership, created = InstitutionMembership.objects.select_for_update().get_or_create(
        institution=institution,
        user=user,
        defaults={"role": role, "status": InstitutionMembership.Status.INVITED, "is_primary": is_primary},
    )
    if not created:
        if membership.status == InstitutionMembership.Status.ACTIVE:
            raise CodedValidationError("This account already has an active membership.", api_code="membership_exists")
        membership.role = role
        membership.status = InstitutionMembership.Status.INVITED
        membership.is_primary = is_primary
        membership.ended_at = None
        membership.full_clean()
        membership.save()
    record_audit_event(actor=actor, institution=institution, entity=membership, action="access.membership.invited", metadata={"email": user.email, "role": role.code})
    return membership


@transaction.atomic
def create_invitation(*, email, institution, role, actor, expires_at, employee=None):
    _assert_active_actor(actor, institution)
    if role.institution_id != institution.id or not role.is_active:
        raise ValidationError({"role": "Select an active role from this institution."})
    normalized_email = email.strip().lower()
    if employee is not None:
        if employee.institution_id != institution.id:
            raise ValidationError({"employee": "Employee must belong to the current institution."})
        if role.code != "EMPLOYEE":
            raise ValidationError({"role": "Employee self-service invitations must use the Employee role."})
        employee_emails = {value.strip().lower() for value in (employee.work_email, employee.personal_email) if value}
        if normalized_email not in employee_emails:
            raise ValidationError({"email": "Invitation email must match the employee's work or personal email."})
        InstitutionInvitation.objects.filter(
            institution=institution, employee=employee, status=InstitutionInvitation.Status.PENDING
        ).update(status=InstitutionInvitation.Status.REVOKED)
    token = secrets.token_urlsafe(32)
    invitation = InstitutionInvitation.objects.create(institution=institution, email=normalized_email, role=role, employee=employee, token_hash=salted_hmac("institution-invitation", token).hexdigest(), invited_by=actor, expires_at=expires_at)
    record_audit_event(actor=actor, institution=institution, entity=invitation, action="access.invitation.created", metadata={"email": invitation.email, "role": role.code})
    return invitation, token


@transaction.atomic
def revoke_invitation(*, invitation, institution, actor):
    """Revoke a pending invitation without changing any established membership."""
    _assert_active_actor(actor, institution)
    if invitation.institution_id != institution.id:
        raise ValidationError({"invitation": "Invitation must belong to the current institution."})
    if invitation.status != InstitutionInvitation.Status.PENDING:
        raise CodedValidationError("Only pending invitations can be revoked.", api_code="invitation_not_pending")
    invitation.status = InstitutionInvitation.Status.REVOKED
    invitation.save(update_fields=("status", "updated_at"))
    record_audit_event(actor=actor, institution=institution, entity=invitation, action="access.invitation.revoked", metadata={"email": invitation.email, "role": invitation.role.code})
    return invitation
