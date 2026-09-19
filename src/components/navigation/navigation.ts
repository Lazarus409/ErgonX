import {
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  Contact,
  FileText,
  FileBarChart,
  House,
  LayoutDashboard,
  Settings,
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
  excludedRoles?: string[];
  allowedRoles?: string[];
};

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
    permission: "dashboard.hr.view",
  },
  {
    label: "Leave",
    href: "/leave/dashboard",
    icon: CalendarDays,
    module: "LEAVE",
    permission: "dashboard.leave.view",
  },
  {
    label: "Attendance",
    href: "/attendance/dashboard",
    icon: ClipboardCheck,
    module: "ATTENDANCE",
    permission: "dashboard.attendance.view",
  },
  {
    label: "Payroll",
    href: "/payroll",
    icon: CircleDollarSign,
    module: "PAYROLL",
    permission: "dashboard.payroll.view",
  },
  {
    label: "Accounting",
    href: "/accounting",
    icon: Wallet,
    module: "ACCOUNTING",
    permission: "dashboard.finance.view",
  },
  {
    label: "Reports & Analytics",
    href: "/reports/dashboard",
    icon: FileBarChart,
    module: "REPORTS",
    permission: "report.view",
  },
  {
    label: "Recruitment",
    href: "/recruitment",
    icon: BriefcaseBusiness,
    module: "RECRUITMENT",
    permission: "candidate.view",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "institution.view",
    allowedRoles: ["INSTITUTION_ADMIN"],
  },
];

export const selfServiceNavigation: NavigationItem[] = [
  {
    label: "Employee Home",
    href: "/me",
    icon: House,
    permission: "home.view",
  },
  {
    label: "My Profile",
    href: "/me/profile",
    icon: Users,
    permission: "home.view",
  },
  {
    label: "My Leave",
    href: "/me/leave",
    icon: CalendarDays,
    module: "LEAVE",
    permission: "leave.request",
    excludedRoles: ["INSTITUTION_ADMIN", "DIRECTOR"],
  },
  {
    label: "My Attendance",
    href: "/me/attendance",
    icon: ClipboardCheck,
    module: "ATTENDANCE",
    permission: "attendance.view",
    excludedRoles: ["INSTITUTION_ADMIN", "DIRECTOR"],
  },
  {
    label: "My Payslips",
    href: "/me/payslips",
    icon: CircleDollarSign,
    module: "PAYROLL",
    permission: "payslip.view",
    excludedRoles: ["INSTITUTION_ADMIN", "DIRECTOR"],
  },
  {
    label: "Emergency Contacts",
    href: "/me/emergency-contacts",
    icon: Contact,
    permission: "home.view",
  },
  {
    label: "My Documents",
    href: "/me/documents",
    icon: FileText,
    permission: "home.view",
  },
];
