import {
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Contact,
  FileText,
  GitPullRequest,
  FileBarChart,
  House,
  LayoutDashboard,
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

export type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  module?: ModuleCode;
  permission?: string;
  /** Any one of these effective permissions exposes a module entry point. */
  anyPermissions?: string[];
  /** A personal-workspace destination, shown only with a self-service capability. */
  selfService?: boolean;
  children?: Array<{ label: string; href: string; permission?: string; module?: ModuleCode }>;
};

/** One source of truth for module-entry visibility and direct-route gates. */
export const moduleAccessPermissions = {
  HR: ["dashboard.hr.view", "organization.view", "organization.create", "organization.update", "organization.delete", "employee.view", "employee.create", "employee.update", "employee.delete", "employment.view", "employment.create", "employment.update", "employment.delete", "department.view", "position.view", "grade.view", "location.view"],
  LEAVE: ["dashboard.leave.view", "leave.view", "leave.request", "leave.approve", "leave.reject", "leave.configure", "leave.balance.manage"],
  ATTENDANCE: ["dashboard.attendance.view", "attendance.view", "attendance.clock", "attendance.adjust", "attendance.manage", "attendance.approve", "schedule.view", "schedule.manage"],
  PAYROLL: ["dashboard.payroll.view", "payroll.view", "payroll.configure", "payroll.prepare", "payroll.approve", "payroll.finalize", "compensation.view", "compensation.configure", "compensation.manage", "payslip.view", "tax_relief.view", "tax_relief.claim", "tax_relief.approve"],
  ACCOUNTING: ["dashboard.finance.view", "accounting.configure", "account.view", "account.create", "account.update", "journal.view", "journal.create", "journal.approve", "journal.post", "journal.reverse", "financial_report.view", "accounting_period.close", "accounting_period.reopen", "vendor.view", "vendor.create", "vendor.update", "vendor_bill.view", "vendor_bill.create", "vendor_bill.approve", "vendor_bill.post", "vendor_bill.void", "customer.view", "customer.create", "customer.update", "invoice.view", "invoice.create", "invoice.issue", "invoice.void", "bank_account.view", "bank_account.create", "bank_account.update", "payment.view", "payment.create", "payment.void", "receipt.view", "receipt.create", "receipt.void", "expense.view", "expense.create", "expense.approve", "expense.post", "payroll_accounting.view", "payroll_accounting.configure", "bank_reconciliation.view", "bank_reconciliation.manage", "vat_withholding_certificate.view", "vat_withholding_certificate.issue"],
  RECRUITMENT: ["dashboard.recruitment.view", "job_posting.view", "job_posting.create", "job_posting.update", "candidate.view", "candidate.create", "candidate.update", "recruitment_stage.view", "recruitment_stage.manage", "interview.view", "interview.manage", "candidate_evaluation.create", "offer.view", "offer.create", "offer.manage"],
  REPORTS: ["report.view"],
} as const;

export const navigation: NavigationItem[] = [
  {
    label: "Home",
    href: "/",
    icon: House,
    permission: "home.view",
  },
  {
    label: "Executive Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.executive.view",
  },
  {
    label: "HR",
    href: "/hr",
    icon: Users,
    module: "HR",
    anyPermissions: [...moduleAccessPermissions.HR],
    children: [
      { label: "HR Dashboard", href: "/hr/dashboard", permission: "dashboard.hr.view", module: "HR" },
      { label: "Employees / Core HR", href: "/hr/employees", permission: "employee.view", module: "HR" },
      { label: "Recruitment", href: "/recruitment", permission: "candidate.view", module: "RECRUITMENT" },
      { label: "Leave", href: "/leave/dashboard", permission: "leave.view", module: "LEAVE" },
      { label: "Attendance", href: "/attendance/dashboard", permission: "attendance.view", module: "ATTENDANCE" },
      { label: "Payroll", href: "/payroll", permission: "payroll.view", module: "PAYROLL" },
    ],
  },
  {
    label: "Accounting",
    href: "/accounting",
    icon: Wallet,
    module: "ACCOUNTING",
    anyPermissions: [...moduleAccessPermissions.ACCOUNTING],
    children: [{ label: "Journals", href: "/accounting/journals", permission: "journal.view" }, { label: "Reports", href: "/accounting/reports", permission: "financial_report.view" }],
  },
  {
    label: "Reports & Analytics",
    href: "/reports/dashboard",
    icon: FileBarChart,
    module: "REPORTS",
    anyPermissions: [...moduleAccessPermissions.REPORTS],
    children: [{ label: "Analytics dashboard", href: "/reports/dashboard", permission: "report.view" }],
  },
  {
    label: "Approvals",
    href: "/approvals",
    icon: GitPullRequest,
    permission: "approval_request.view",
  },
  { label: "Audit Trail", href: "/audit", icon: ShieldCheck, permission: "audit.view" },
  { label: "Users & Access", href: "/settings/users", icon: Users, permission: "settings.users.manage" },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    anyPermissions: ["institution.view", "home.view", "audit.view", "approval_workflow.view", "department.view", "recruitment_stage.view", "leave.view", "schedule.view", "payroll.configure", "accounting.configure", "settings.profile.manage_self", "settings.modules.manage", "settings.roles.manage", "settings.users.manage"],
  },
];

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
