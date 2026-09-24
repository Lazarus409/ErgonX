"use client";

import { ChevronLeft, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { auditApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

const PAGE_SIZE = 25;
const pretty = (value: string) => value.replaceAll(".", " ").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const startOfDay = (value: string) => value ? `${value}T00:00:00Z` : undefined;
const endOfDay = (value: string) => value ? `${value}T23:59:59Z` : undefined;

export default function AuditSettingsPage() {
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const filters = useMemo(() => ({ q: query || undefined, actor: actor || undefined, action: action || undefined, entity_type: entityType || undefined, entity_id: entityId || undefined, from: startOfDay(from), to: endOfDay(to), page, page_size: PAGE_SIZE }), [query, actor, action, entityType, entityId, from, to, page]);
  const load = useCallback(() => auditApi.listAuditLogs(filters), [filters]);
  const { data, loading, error, reload } = useApiResource(load);
  const logs = data?.results ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));
  const update = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => { setter(event.target.value); setPage(1); };

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState title="Unable to load audit history" message={error} onRetry={reload} />;

  return <div className="mx-auto max-w-7xl space-y-6">
    <PageHeader title="Audit log" description="Read-only activity history for this institution. Sensitive values are redacted." />
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="relative"><span className="sr-only">Search audit history</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={update(setQuery)} placeholder="Search action, entity, or actor" className="h-10 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm" /></label>
        <input value={actor} onChange={update(setActor)} placeholder="Actor email" aria-label="Actor email" className="h-10 rounded-xl border border-slate-300 px-3 text-sm" />
        <input value={action} onChange={update(setAction)} placeholder="Action, for example payroll" aria-label="Action" className="h-10 rounded-xl border border-slate-300 px-3 text-sm" />
        <input value={entityType} onChange={update(setEntityType)} placeholder="Module or entity, for example recruitment" aria-label="Module or entity" className="h-10 rounded-xl border border-slate-300 px-3 text-sm" />
        <input value={entityId} onChange={update(setEntityId)} placeholder="Record UUID" aria-label="Record UUID" className="h-10 rounded-xl border border-slate-300 px-3 text-sm" />
        <label className="text-xs font-medium text-slate-600">From<input type="date" value={from} onChange={update(setFrom)} className="mt-1 block h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900" /></label>
        <label className="text-xs font-medium text-slate-600">To<input type="date" value={to} onChange={update(setTo)} className="mt-1 block h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900" /></label>
      </div>
    </section>
    {error && <ErrorState title="Unable to refresh audit history" message={error} onRetry={reload} />}
    {!loading && !logs.length ? <EmptyState title="No matching activity" description="Try broader filters, or activity will appear as records change." /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-sky-700" /><h2 className="font-semibold text-slate-950">Activity history</h2></div><span className="text-sm text-slate-500">{data?.count ?? 0} records</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">When</th><th className="px-5 py-3 font-semibold">Action</th><th className="px-5 py-3 font-semibold">Actor</th><th className="px-5 py-3 font-semibold">IP address</th><th className="px-5 py-3 font-semibold">Area / record</th><th className="px-5 py-3 font-semibold">Safe details</th></tr></thead><tbody className="divide-y divide-slate-100">{logs.map((entry) => <tr key={entry.id} className="align-top hover:bg-slate-50"><td className="whitespace-nowrap px-5 py-4 text-slate-500">{dateTime(entry.created_at)}</td><td className="px-5 py-4 font-medium text-slate-950">{pretty(entry.action)}</td><td className="px-5 py-4 text-slate-600">{entry.actor_email ?? "System"}</td><td className="px-5 py-4 font-mono text-xs text-slate-500">{entry.ip_address ?? "—"}</td><td className="px-5 py-4 text-slate-600"><p>{entry.entity_type ? pretty(entry.entity_type.split(".").pop() ?? entry.entity_type) : "—"}</p>{entry.entity_id && <p className="mt-1 font-mono text-xs text-slate-400">{entry.entity_id.slice(0, 8)}</p>}</td><td className="max-w-xs px-5 py-4 text-slate-600">{Object.entries(entry.metadata).length ? <dl className="space-y-1">{Object.entries(entry.metadata).slice(0, 2).map(([key, value]) => <div key={key}><dt className="inline text-xs text-slate-400">{pretty(key)}: </dt><dd className="inline text-xs">{typeof value === "object" ? "Updated" : String(value)}</dd></div>)}</dl> : "—"}</td></tr>)}</tbody></table></div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-slate-500">Page {page} of {pageCount}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><ChevronLeft className="h-4 w-4" />Previous</button><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Next<ChevronRight className="h-4 w-4" /></button></div></div>
    </section>}
  </div>;
}
