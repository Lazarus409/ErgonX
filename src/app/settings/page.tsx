import Link from "next/link";
import { Building2, GitPullRequest, Puzzle, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const areas = [
  { title: "Personal Preferences", description: "Manage your personal workspace preferences.", href: "/settings/profile", icon: SlidersHorizontal },
  { title: "Institution Settings", description: "Review institution configuration exposed to your role.", href: "/settings/institution", icon: Building2 },
  { title: "Modules", description: "Review enabled ERP modules and their configuration status.", href: "/settings/modules", icon: Puzzle },
  { title: "Roles & Permissions", description: "Manage institution roles and their assigned permissions.", href: "/settings/roles", icon: ShieldCheck },
  { title: "Users & Memberships", description: "Review active institution memberships and access roles.", href: "/settings/users", icon: Users },
  { title: "Approval Workflows", description: "Review approval workflow definitions used by operational processes.", href: "/settings/approval-workflows", icon: GitPullRequest },
];

export default function SettingsPage() {
  return <div className="space-y-6"><PageHeader title="Settings" description="Personal and institution administration settings are permission-controlled." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{areas.map((area) => { const Icon = area.icon; return <Link key={area.href} href={area.href} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"><Icon className="h-6 w-6 text-slate-700" /><h2 className="mt-4 font-semibold text-slate-950">{area.title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{area.description}</p></Link>; })}</div></div>;
}
