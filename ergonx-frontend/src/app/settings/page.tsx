"use client";

import Link from "next/link";
import { Bell, Building2, BriefcaseBusiness, CalendarDays, Clock3, GitPullRequest, KeyRound, type LucideIcon, Puzzle, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";

import { useAuth } from "@/components/guards/AuthProvider";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { hasModule } from "@/types/institutions";

export const settingsAreas: Array<{ title: string; description: string; href: string; icon: LucideIcon; permission?: string; anyPermissions?: string[]; module?: string }> = [
  { title: "Profile", description: "Update supported personal contact details and review employment identity.", href: "/me/profile", icon: UserRound, anyPermissions: ["leave.request", "attendance.clock", "payslip.view", "tax_relief.claim"] },
  { title: "Personal Preferences", description: "Manage supported workspace preferences.", href: "/settings/profile", icon: SlidersHorizontal, permission: "settings.profile.manage_self" },
  { title: "Security", description: "Change your password using your current account credentials.", href: "/settings/security", icon: KeyRound, permission: "home.view" },
  { title: "Institution Settings", description: "Review institution identity and configuration exposed to your role.", href: "/settings/institution", icon: Building2, permission: "institution.view" },
  { title: "Modules", description: "Review enabled ERP modules and configuration status.", href: "/settings/modules", icon: Puzzle, permission: "settings.modules.manage" },
  { title: "Roles & Permissions", description: "Manage institution roles and assigned permissions.", href: "/settings/roles", icon: ShieldCheck, permission: "settings.roles.manage" },
  { title: "Approval Workflows", description: "Review approval definitions used by operational processes.", href: "/settings/approval-workflows", icon: GitPullRequest, permission: "approval_workflow.view" },
  { title: "Notifications", description: "Review in-app notification history for your active institution.", href: "/notifications", icon: Bell, permission: "home.view" },
  { title: "Organization", description: "Review the institution's department, position, grade, and location catalogues.", href: "/hr/departments", icon: BriefcaseBusiness, permission: "department.view", module: "HR" },
  { title: "Recruitment", description: "Manage the ordered recruitment stages used by the institution pipeline.", href: "/recruitment/stages", icon: BriefcaseBusiness, permission: "recruitment_stage.view", module: "RECRUITMENT" },
  { title: "Leave", description: "Manage the institution's leave types and effective leave policies.", href: "/leave/policies", icon: CalendarDays, permission: "leave.view", module: "LEAVE" },
  { title: "Attendance", description: "Manage authorized work schedules, shift patterns, rotations, and assignments.", href: "/attendance/schedules", icon: Clock3, permission: "schedule.view", module: "ATTENDANCE" },
];

export default function SettingsPage() {
  const { user, institution } = useAuth();
  const visibleAreas = settingsAreas.filter((area) => {
    const permissions = user?.permissions ?? [];
    const authorized = permissions.includes("*") || (area.permission ? permissions.includes(area.permission) : Boolean(area.anyPermissions?.some((permission) => permissions.includes(permission))));
    return authorized && (!area.module || hasModule(institution?.enabledModules, area.module));
  });
  return <div className="space-y-7"><PageHeader title="Settings" description="Only settings authorized by your active institution membership are shown." />{visibleAreas.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleAreas.map((area) => { const Icon = area.icon; return <Link key={area.href} href={area.href} className="flex min-h-44 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"><Icon className="h-6 w-6 text-slate-700" /><h2 className="mt-5 font-semibold text-slate-950">{area.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{area.description}</p></Link>; })}</div> : <EmptyState title="No settings are available" description="Your current role does not grant a settings area in this institution." />}</div>;
}
