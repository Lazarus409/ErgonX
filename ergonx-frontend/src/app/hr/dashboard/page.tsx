"use client";

import Link from "next/link";
import { BriefcaseBusiness, Building2, MapPin, UserCheck, UserMinus, UserPlus, Users } from "lucide-react";
import { useCallback } from "react";

import ErrorState from "@/components/ui/ErrorState";
import { useAuth } from "@/components/guards/AuthProvider";
import KPIStatCard from "@/components/ui/KPIStatCard";
import PageHeader from "@/components/ui/PageHeader";
import { dashboardsApi } from "@/lib/api";
import { EM_DASH, formatNumber } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { NamedCount } from "@/types/dashboards";
import { hasModule } from "@/types/institutions";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function CountBars({ title, description, items, valueKey, tone = "bg-indigo-500" }: { title: string; description: string; items: NamedCount[]; valueKey: keyof NamedCount; tone?: string }) {
  const maximum = Math.max(...items.map((item) => item.count), 1);
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p>{items.length ? <div className="mt-6 space-y-4">{items.map((item) => { const name = String(item[valueKey] ?? "Not assigned"); return <div key={name}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate text-slate-600">{label(name)}</span><span className="font-semibold text-slate-950">{formatNumber(item.count)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max((item.count / maximum) * 100, 3)}%` }} /></div></div>; })}</div> : <p className="mt-6 text-sm text-slate-500">No current employment records are available.</p>}</section>;
}

/** Source-backed HR rollup. No workforce values are manufactured in the browser. */
export default function HRDashboardPage() {
  const { institution, user } = useAuth();
  const load = useCallback(() => dashboardsApi.getHrDashboard(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const placeholder = loading ? "…" : EM_DASH;
  const statusCount = (status: string) => data?.by_status.find((item) => item.status === status)?.count ?? 0;
  const currentYear = new Date().getFullYear();
  const hiresThisYear = data?.by_hire_year.find((item) => item.year === currentYear)?.count ?? 0;
  const can = (permission: string) => hasModule(institution?.enabledModules, "HR") && (user?.permissions.includes("*") || user?.permissions.includes(permission));
  const quickActions = [
    { href: "/hr/employees", label: "Employees", icon: Users, permission: "employee.view" },
    { href: "/hr/departments", label: "Departments", icon: Building2, permission: "organization.view" },
    { href: "/hr/positions", label: "Positions", icon: BriefcaseBusiness, permission: "organization.view" },
    { href: "/hr/locations", label: "Locations", icon: MapPin, permission: "organization.view" },
  ].filter((action) => can(action.permission));

  return <main className="space-y-6"><PageHeader title="HR Dashboard" description="Live workforce composition, staffing activity, and employee records for this institution." actions={<div className="flex flex-wrap gap-2">{can("employee.create") && <Link href="/hr/employees/new" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Add employee</Link>}{can("employee.view") && <Link href="/hr/employees" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">View employees</Link>}</div>} />{error && <ErrorState title="Unable to load HR dashboard" message={error} onRetry={reload} />}<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KPIStatCard title="Workforce" value={data ? formatNumber(data.total_employees) : placeholder} subtitle="Employee records" icon={<Users className="h-5 w-5 text-indigo-600" />} /><KPIStatCard title="Active employees" value={data ? formatNumber(data.active_employees) : placeholder} subtitle={data?.total_employees ? `${Math.round((data.active_employees / data.total_employees) * 100)}% of workforce` : "Current active records"} icon={<UserCheck className="h-5 w-5 text-emerald-600" />} /><KPIStatCard title="New hires" value={data ? formatNumber(hiresThisYear) : placeholder} subtitle={`Hired in ${currentYear}`} icon={<UserPlus className="h-5 w-5 text-sky-600" />} /><KPIStatCard title="Terminated" value={data ? formatNumber(statusCount("TERMINATED")) : placeholder} subtitle="Employee status records" icon={<UserMinus className="h-5 w-5 text-rose-600" />} /></section><section className="grid gap-5 xl:grid-cols-2"><CountBars title="Department distribution" description="Active employees with a current department." items={data?.by_department ?? []} valueKey="department__name" /><CountBars title="Grade distribution" description="Active employees with a current grade." items={data?.by_grade ?? []} valueKey="grade__name" tone="bg-violet-500" /></section><section className="grid gap-5 xl:grid-cols-2"><CountBars title="Location distribution" description="Active employees by current location." items={data?.by_location ?? []} valueKey="location__name" tone="bg-cyan-500" /><CountBars title="Employment type" description="Current active employments by type." items={data?.by_employment_type ?? []} valueKey="employment_type" tone="bg-blue-500" /></section><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-slate-950">Recent hires</h2><p className="mt-1 text-sm text-slate-500">Most recently hired active employees with a current employment record.</p></div>{can("employee.view") && <Link href="/hr/employees" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">View employees</Link>}</div>{data?.recent_hires.length ? <div className="divide-y divide-slate-100">{data.recent_hires.map((employee) => can("employee.view") ? <Link href={`/hr/employees/${employee.id}`} key={employee.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50"><HireRow employee={employee} /></Link> : <div key={employee.id} className="flex items-center gap-4 px-6 py-4"><HireRow employee={employee} /></div>)}</div> : <p className="px-6 py-10 text-center text-sm text-slate-500">No current employee hires are available.</p>}</section>{quickActions.length > 0 && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{quickActions.map(({ href, label: actionLabel, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"><Icon className="h-5 w-5 text-indigo-600" />{actionLabel}</Link>)}</section>}</main>;
}

function HireRow({ employee }: { employee: { first_name: string; last_name: string; employments__position__title: string; employments__department__name: string; hire_date: string } }) { return <><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">{`${employee.first_name[0] ?? ""}${employee.last_name[0] ?? ""}`}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-950">{employee.first_name} {employee.last_name}</span><span className="block truncate text-xs text-slate-500">{employee.employments__position__title} · {employee.employments__department__name}</span></span><time className="hidden shrink-0 text-xs text-slate-500 sm:block">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(employee.hire_date))}</time></>; }
