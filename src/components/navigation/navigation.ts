import {
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  FileBarChart,
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
};

export const navigation: NavigationItem[] = [
  {
    label: "Executive Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.executive.view",
  },
  {
    label: "HR",
    href: "/hr/dashboard",
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
    permission: "dashboard.accounting.view",
  },
  {
    label: "Reports & Analytics",
    href: "/reports/dashboard",
    icon: FileBarChart,
    module: "REPORTS",
    permission: "dashboard.analytics.view",
  },
  {
    label: "Recruitment",
    href: "/recruitment/dashboard",
    icon: BriefcaseBusiness,
    module: "RECRUITMENT",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "institution.settings.view",
  },
];

export const selfServiceNavigation: NavigationItem[] = [
  {
    label: "My Leave",
    href: "/me/leave",
    icon: CalendarDays,
    module: "LEAVE",
    permission: "leave.request",
  },
  {
    label: "My Attendance",
    href: "/me/attendance",
    icon: ClipboardCheck,
    module: "ATTENDANCE",
    permission: "attendance.view",
  },
  {
    label: "My Payslips",
    href: "/me/payslips",
    icon: CircleDollarSign,
    module: "PAYROLL",
    permission: "payroll.view",
  },
];