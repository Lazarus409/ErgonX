"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Building2, BriefcaseBusiness, GraduationCap, MapPin, Search } from "lucide-react";

import BackNavigation from "@/components/ui/BackNavigation";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { organizationApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { PaginatedData } from "@/types/api";
import type { Department, Grade, Location, Position } from "@/types/hr";

export type OrganizationResourceKind = "departments" | "positions" | "grades" | "locations";
type Resource = Department | Position | Grade | Location;

const metadata: Record<OrganizationResourceKind, { singular: string; title: string; description: string; icon: typeof Building2 }> = {
  departments: { singular: "Department", title: "Departments", description: "Tenant-scoped organization departments.", icon: Building2 },
  positions: { singular: "Position", title: "Positions", description: "Tenant-scoped job positions and their departments.", icon: BriefcaseBusiness },
  grades: { singular: "Grade", title: "Grades", description: "Tenant-scoped employee grade definitions.", icon: GraduationCap },
  locations: { singular: "Location", title: "Locations", description: "Tenant-scoped work locations and locale details.", icon: MapPin },
};

function list(kind: OrganizationResourceKind): Promise<PaginatedData<Resource>> { switch (kind) { case "departments": return organizationApi.listDepartments({ page_size: 100 }) as Promise<PaginatedData<Resource>>; case "positions": return organizationApi.listPositions({ page_size: 100 }) as Promise<PaginatedData<Resource>>; case "grades": return organizationApi.listGrades({ page_size: 100 }) as Promise<PaginatedData<Resource>>; case "locations": return organizationApi.listLocations({ page_size: 100 }) as Promise<PaginatedData<Resource>>; } }
function get(kind: OrganizationResourceKind, id: string): Promise<Resource> { switch (kind) { case "departments": return organizationApi.getDepartment(id) as Promise<Resource>; case "positions": return organizationApi.getPosition(id) as Promise<Resource>; case "grades": return organizationApi.getGrade(id) as Promise<Resource>; case "locations": return organizationApi.getLocation(id) as Promise<Resource>; } }
function nameOf(item: Resource) { return "title" in item ? item.title : item.name; }
function details(kind: OrganizationResourceKind, item: Resource): Array<[string, string]> { if (kind === "departments") { const value = item as Department; return [["Code", value.code], ["Description", value.description || "Not provided"], ["Parent reference", value.parent ?? "None"]]; } if (kind === "positions") { const value = item as Position; return [["Code", value.code], ["Department reference", value.department ?? "Not assigned"], ["Description", value.description || "Not provided"]]; } if (kind === "grades") { const value = item as Grade; return [["Code", value.code], ["Level", String(value.level ?? "Not set")], ["Description", value.description || "Not provided"]]; } const value = item as Location; return [["Code", value.code], ["Address", value.address || "Not provided"], ["City", value.city || "Not provided"], ["Country", value.country || "Not provided"], ["Time zone", value.timezone || "Not provided"], ["Work arrangement", value.is_remote ? "Remote" : "On site"]]; }

export function OrganizationResourceList({ kind }: { kind: OrganizationResourceKind }) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("ALL"); const meta = metadata[kind]; const Icon = meta.icon;
  const load = useCallback(() => list(kind), [kind]); const { data, loading, error, reload } = useApiResource(load);
  const items = useMemo(() => (data?.results ?? []).filter((item) => { const record = item as Resource; const queryMatch = `${nameOf(record)} ${record.code} ${"description" in record ? record.description : ""}`.toLowerCase().includes(query.toLowerCase()); return queryMatch && (status === "ALL" || (record.is_active ? "ACTIVE" : "INACTIVE") === status); }), [data, query, status]);
  if (loading && !data) return <LoadingState />; if (error && !data) return <ErrorState title={`Unable to load ${meta.title.toLowerCase()}`} message={error} onRetry={reload} />;
  return <main className="space-y-6"><PageHeader title={meta.title} description={meta.description} />{error && <ErrorState message={error} onRetry={reload} />}<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Search {meta.title.toLowerCase()}</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${meta.title.toLowerCase()}…`} className="h-10 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-slate-300 px-3 text-sm"><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>{!items.length ? <EmptyState title={`No ${meta.title.toLowerCase()} found`} description="Try a broader filter, or add organization records through the authorized API workflow." /> : <div className="divide-y divide-slate-100">{items.map((item) => { const record = item as Resource; return <Link key={record.id} href={`/hr/${kind}/${record.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-950">{nameOf(record)}</span><span className="mt-1 block truncate text-xs text-slate-500">{record.code}{kind === "positions" && (record as Position).department ? ` · Department reference ${(record as Position).department}` : ""}</span></span><StatusBadge status={record.is_active ? "ACTIVE" : "INACTIVE"} /></Link>; })}</div>}</section></main>;
}

export function OrganizationResourceDetail({ kind, id }: { kind: OrganizationResourceKind; id: string }) {
  const meta = metadata[kind]; const Icon = meta.icon; const load = useCallback(() => get(kind, id), [kind, id]); const { data, loading, error, reload } = useApiResource(load);
  if (loading) return <LoadingState />; if (error || !data) return <ErrorState title={`Unable to load ${meta.singular.toLowerCase()}`} message={error ?? "The requested record was not found."} onRetry={reload} />; const item = data as Resource;
  return <main className="mx-auto max-w-4xl space-y-6"><BackNavigation fallback={`/hr/${kind}`} label={`Back to ${meta.title}`} /><PageHeader title={nameOf(item)} description={`${meta.singular} code: ${item.code}`} actions={<StatusBadge status={item.is_active ? "ACTIVE" : "INACTIVE"} />} /><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Icon className="h-5 w-5" /></span><div><h2 className="font-semibold text-slate-950">{meta.singular} details</h2><p className="mt-1 text-sm text-slate-500">Server-owned organization data for the active institution.</p></div></div><dl className="mt-6 grid gap-5 sm:grid-cols-2">{details(kind, item).map(([label, value]) => <div key={label}><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd></div>)}</dl></section></main>;
}
