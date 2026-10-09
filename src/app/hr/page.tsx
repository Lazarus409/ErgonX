"use client";

import { Banknote, Briefcase, Building2, CalendarDays, Clock3, FileCheck2, GraduationCap, LayoutDashboard, Target, Users } from "lucide-react";

import ModuleLanding from "@/components/home/ModuleLanding";

// Same order as the Human Resources menu: daily work first, setup last.
const areas = [
  { title: "HR Dashboard", description: "Workforce composition, active employment, recent hires and document compliance.", href: "/hr/dashboard", icon: LayoutDashboard, permission: "dashboard.hr.view" },
  { title: "Employees", description: "Employee records, employment history, documents and training.", href: "/hr/employees", icon: Users, permission: "employee.view" },
  { title: "Leave", description: "Leave requests, balances, policies and the team calendar.", href: "/leave", icon: CalendarDays, permission: "dashboard.leave.view" },
  { title: "Attendance", description: "Daily attendance, schedules, corrections and overtime.", href: "/attendance", icon: Clock3, permission: "dashboard.attendance.view" },
  { title: "Payroll", description: "Payroll runs, payslips, adjustments and statutory setup.", href: "/payroll", icon: Banknote, permission: "dashboard.payroll.view" },
  { title: "Performance", description: "Review cycles, self-assessments, manager reviews and sign-off.", href: "/performance", icon: Target, permission: "performance.view" },
  { title: "Training", description: "Courses, enrolments and certificates to renew.", href: "/training", icon: GraduationCap, permission: "training.view" },
  { title: "Recruitment", description: "Requisitions, candidates, interviews and offers.", href: "/recruitment", icon: Briefcase, permission: "job_posting.view" },
  { title: "Document Checklist", description: "Required documents and who is still missing them.", href: "/hr/documents", icon: FileCheck2, permission: "document_requirement.view" },
  { title: "Organization", description: "Departments, positions, grades and locations.", href: "/hr/organization", icon: Building2, permission: "organization.view" },
];

export default function HRHomePage() {
  return <ModuleLanding title="Human Resources" description="Everything for managing your people, in one place." module="HR" accent="hr" icon={Users} eyebrow="Human Resources" areas={areas} />;
}
