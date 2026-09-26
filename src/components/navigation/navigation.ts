import {
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Contact,
  FileText,
  GitPullRequest,
  FileBarChart,
  House,
  LayoutDashboard,
  Network,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

export type ModuleCode =
  | "HR"
  | "LEAVE"
  | "ATTENDANCE"
  | "PAYROLL"
  | "ACCOUNTING"
  | "RECRUITMENT"
  | "REPORTS";

/** Whose records the member works with; mirrors `common/scoping.py`. */
export type DataScope = "INSTITUTION" | "DEPARTMENT" | "SELF";

export type NavigationChild = { label: string; href: string; permission?: string; module?: ModuleCode };

export type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  module?: ModuleCode;
  permission?: string;
  /** Any one of these effective permissions exposes a module entry point. */
  anyPermissions?: readonly string[];
  /** Data scopes the entry is for; omitted means every scope. */
  scopes?: readonly DataScope[];
  /** A personal-workspace destination, shown only with a self-service capability. */
  selfService?: boolean;
  children?: NavigationChild[];
};

/**
 * Permissions that make someone a *user of a module workspace*. Self-service
 * permissions (`leave.view`, `attendance.clock`, `payslip.view`, ...) are
 * deliberately absent: they belong to "My workspace", not to the module.
 * One source of truth for sidebar entries and direct-route gates.
 */
export const moduleWorkspacePermissions = {
  HR: ["dashboard.hr.view", "organization.view", "organization.create", "organization.update", "organization.delete", "employee.view", "employee.create", "employee.update", "employee.delete", "employment.view", "employment.create", "employment.update", "employment.delete"],
  LEAVE: ["dashboard.leave.view", "leave.approve", "leave.reject", "leave.configure", "leave.balance.manage"],
  ATTENDANCE: ["dashboard.attendance.view", "attendance.manage", "attendance.approve", "schedule.manage"],
  PAYROLL: ["dashboard.payroll.view", "payroll.view", "payroll.configure", "payroll.prepare", "payroll.approve", "payroll.finalize", "compensation.configure", "compensation.manage", "tax_relief.approve"],
  ACCOUNTING: ["dashboard.finance.view", "accounting.configure", "account.view", "account.create", "account.update", "journal.view", "journal.create", "journal.approve", "journal.post", "journal.reverse", "financial_report.view", "accounting_period.close", "accounting_period.reopen", "vendor.view", "vendor.create", "vendor.update", "vendor_bill.view", "vendor_bill.create", "vendor_bill.approve", "vendor_bill.post", "vendor_bill.void", "customer.view", "customer.create", "customer.update", "invoice.view", "invoice.create", "invoice.issue", "invoice.void", "bank_account.view", "bank_account.create", "bank_account.update", "payment.view", "payment.create", "payment.void", "receipt.view", "receipt.create", "receipt.void", "expense.view", "expense.create", "expense.approve", "expense.post", "payroll_accounting.view", "payroll_accounting.configure", "bank_reconciliation.view", "bank_reconciliation.manage", "vat_withholding_certificate.view", "vat_withholding_certificate.issue"],
  RECRUITMENT: ["job_posting.view", "job_posting.create", "job_posting.update", "candidate.view", "candidate.create", "candidate.update", "recruitment_stage.view", "recruitment_stage.manage", "interview.view", "interview.manage", "candidate_evaluation.create", "offer.view", "offer.create", "offer.manage"],
  REPORTS: ["report.view"],
} as const;

/** Module workspaces work across the whole institution. */
export const INSTITUTION_WIDE: readonly DataScope[] = ["INSTITUTION"];

/**
 * Record pages inside a workspace that also open for people who reach the
 * record another way (their own leave request, a department head's team
 * member). The API still limits which records load.
 */
export const sharedRecordRoutes: Array<{ pattern: RegExp; anyPermissions: readonly string[]; scopes?: readonly DataScope[] }> = [
  { pattern: /^\/leave\/requests\/[^/]+$/, anyPermissions: ["leave.view"] },
  { pattern: /^\/payroll\/payslips\/[^/]+$/, anyPermissions: ["payslip.view"] },
  { pattern: /^\/leave\/calendar$/, anyPermissions: ["leave.view"], scopes: ["DEPARTMENT"] },
  { pattern: /^\/hr\/employees\/(?!new$)[^/]+$/, anyPermissions: ["employee.view"], scopes: ["DEPARTMENT"] },
];

export const navigation: NavigationItem[] = [
  { label: "Home", href: "/", icon: House, permission: "home.view" },
  { label: "Executive Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.executive.view" },
  {
    label: "My Department",
    href: "/department",
    icon: Network,
    permission: "dashboard.department.view",
    scopes: ["DEPARTMENT"],
    children: [
      { label: "Overview", href: "/department", permission: "dashboard.department.view" },
      { label: "Leave approvals", href: "/department/approvals", permission: "leave.approve", module: "LEAVE" },
      { label: "Team leave calendar", href: "/leave/calendar", permission: "leave.view", module: "LEAVE" },
    ],
  },
  {
    label: "HR",
    href: "/hr",
    icon: Users,
    module: "HR",
    anyPermissions: moduleWorkspacePermissions.HR,
    scopes: INSTITUTION_WIDE,
    children: [
      { label: "HR Dashboard", href: "/hr/dashboard", permission: "dashboard.hr.view" },
      { label: "Employees", href: "/hr/employees", permission: "employee.view" },
      { label: "Departments", href: "/hr/departments", permission: "organization.view" },
      { label: "Positions", href: "/hr/positions", permission: "organization.view" },
      { label: "Grades", href: "/hr/grades", permission: "organization.view" },
      { label: "Locations", href: "/hr/locations", permission: "organization.view" },
    ],
  },
  {
    label: "Recruitment",
    href: "/recruitment",
    icon: BriefcaseBusiness,
    module: "RECRUITMENT",
    anyPermissions: moduleWorkspacePermissions.RECRUITMENT,
    scopes: INSTITUTION_WIDE,
    children: [
      { label: "Dashboard", href: "/recruitment/dashboard", permission: "candidate.view" },
      { label: "Job postings", href: "/recruitment/job-postings", permission: "job_posting.view" },
      { label: "Candidates", href: "/recruitment/candidates", permission: "candidate.view" },
      { label: "Pipeline", href: "/recruitment/pipeline", permission: "candidate.view" },
      { label: "Applications", href: "/recruitment/applications", permission: "candidate.view" },
      { label: "Interviews", href: "/recruitment/interviews", permission: "interview.view" },
      { label: "Offers", href: "/recruitment/offers", permission: "offer.view" },
    ],
  },
  {
    label: "Leave",
    href: "/leave",
    icon: CalendarDays,
    module: "LEAVE",
    anyPermissions: moduleWorkspacePermissions.LEAVE,
    scopes: INSTITUTION_WIDE,
    children: [
      { label: "Dashboard", href: "/leave/dashboard", permission: "dashboard.leave.view" },
      { label: "Requests", href: "/leave/requests", permission: "leave.view" },
      { label: "Calendar", href: "/leave/calendar", permission: "leave.view" },
      { label: "Types & policies", href: "/leave/policies", permission: "leave.configure" },
    ],
  },
  {
    label: "Attendance",
    href: "/attendance",
    icon: Clock3,
    module: "ATTENDANCE",
    anyPermissions: moduleWorkspacePermissions.ATTENDANCE,
    scopes: INSTITUTION_WIDE,
    children: [
      { label: "Dashboard", href: "/attendance/dashboard", permission: "dashboard.attendance.view" },
      { label: "Live attendance", href: "/attendance/live", permission: "attendance.view" },
      { label: "Adjustments", href: "/attendance/adjustments", permission: "attendance.approve" },
      { label: "Overtime", href: "/attendance/overtime", permission: "attendance.approve" },
      { label: "Schedules", href: "/attendance/schedules", permission: "schedule.view" },
      { label: "Shifts", href: "/attendance/shifts", permission: "schedule.manage" },
    ],
  },
  {
    label: "Payroll",
    href: "/payroll",
    icon: CircleDollarSign,
    module: "PAYROLL",
    anyPermissions: moduleWorkspacePermissions.PAYROLL,
    scopes: INSTITUTION_WIDE,
    children: [
      { label: "Dashboard", href: "/payroll/dashboard", permission: "dashboard.payroll.view" },
      { label: "Payroll runs", href: "/payroll/runs", permission: "payroll.view" },
      { label: "Periods", href: "/payroll/periods", permission: "payroll.view" },
      { label: "Adjustments", href: "/payroll/adjustments", permission: "payroll.view" },
      { label: "Payslips", href: "/payroll/payslips", permission: "payroll.view" },
      { label: "Employee profiles", href: "/payroll/employee-profiles", permission: "payroll.view" },
      { label: "Configuration", href: "/payroll/configuration", permission: "payroll.configure" },
    ],
  },
  {
    label: "Accounting",
    href: "/accounting",
    icon: Wallet,
    module: "ACCOUNTING",
    anyPermissions: moduleWorkspacePermissions.ACCOUNTING,
    scopes: INSTITUTION_WIDE,
    children: [
      { label: "Dashboard", href: "/accounting/dashboard", permission: "dashboard.finance.view" },
      { label: "Journals", href: "/accounting/journals", permission: "journal.view" },
      { label: "Payables", href: "/accounting/payables", permission: "vendor_bill.view" },
      { label: "Receivables", href: "/accounting/receivables", permission: "invoice.view" },
      { label: "Banking", href: "/accounting/banking", permission: "bank_account.view" },
      { label: "Expenses", href: "/accounting/expenses", permission: "expense.view" },
      { label: "Reports", href: "/accounting/reports", permission: "financial_report.view" },
    ],
  },
  {
    label: "Reports & Analytics",
    href: "/reports/dashboard",
    icon: FileBarChart,
    module: "REPORTS",
    anyPermissions: moduleWorkspacePermissions.REPORTS,
    scopes: INSTITUTION_WIDE,
  },
  { label: "Approvals", href: "/approvals", icon: GitPullRequest, permission: "approval_request.view" },
  { label: "Audit Trail", href: "/audit", icon: ShieldCheck, permission: "audit.view" },
  { label: "Users & Access", href: "/settings/users", icon: Users, permission: "settings.users.manage" },
  // Everyone keeps Settings for their own security and notifications; the page filters its cards.
  { label: "Settings", href: "/settings", icon: Settings, permission: "home.view" },
];

/** Shared visibility rule for sidebar entries, landing cards and route gates. */
export function canAccess(
  item: { module?: string; permission?: string; anyPermissions?: readonly string[]; scopes?: readonly DataScope[] },
  context: { can: (permission: string) => boolean; moduleEnabled: (module: string) => boolean; scope: DataScope },
): boolean {
  if (item.scopes && !item.scopes.includes(context.scope)) return false;
  if (item.module && !context.moduleEnabled(item.module)) return false;
  if (item.permission && !context.can(item.permission)) return false;
  if (item.anyPermissions?.length && !item.anyPermissions.some(context.can)) return false;
  return true;
}

export const selfServiceNavigation: NavigationItem[] = [
  {
    label: "Employee Home",
    href: "/me",
    icon: House,
    permission: "home.view",
    selfService: true,
  },
  {
    label: "My Profile",
    href: "/me/profile",
    icon: Users,
    permission: "home.view",
    selfService: true,
  },
  {
    label: "My Leave",
    href: "/me/leave",
    icon: CalendarDays,
    module: "LEAVE",
    permission: "leave.request",
    selfService: true,
  },
  {
    label: "My Attendance",
    href: "/me/attendance",
    icon: ClipboardCheck,
    module: "ATTENDANCE",
    permission: "attendance.view",
    selfService: true,
  },
  {
    label: "My Payslips",
    href: "/me/payslips",
    icon: CircleDollarSign,
    module: "PAYROLL",
    permission: "payslip.view",
    selfService: true,
  },
  {
    label: "Emergency Contacts",
    href: "/me/emergency-contacts",
    icon: Contact,
    permission: "home.view",
    selfService: true,
  },
  {
    label: "My Documents",
    href: "/me/documents",
    icon: FileText,
    permission: "home.view",
    selfService: true,
  },
];
