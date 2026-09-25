"use client";

import { Lock, Search, ShieldCheck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Card";
import { DataTable, Pagination } from "@/components/ui/DataTable";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Input } from "@/components/ui/Field";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { auditApi } from "@/lib/api";
import type { AuditLogEntry } from "@/lib/api/audit";
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

  if (loading && !data) return <LoadingState variant="table" label="Loading audit history" />;
  if (error && !data) return <ErrorState title="Unable to load audit history" message={error} onRetry={reload} />;
  const hasFilters = Boolean(query || actor || action || entityType || entityId || from || to);
  const clearFilters = () => { setQuery(""); setActor(""); setAction(""); setEntityType(""); setEntityId(""); setFrom(""); setTo(""); setPage(1); };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader eyebrow="Audit" title="Audit log" description="Read-only activity history for this institution. Sensitive values are redacted." icon={ShieldCheck} accent="audit" meta={<Badge tone="neutral" icon={Lock}>Read-only</Badge>} />
      <DataTable<AuditLogEntry>
        caption="Audit activity history"
        rows={logs}
        rowKey={(entry) => entry.id}
        loading={loading}
        error={error && data ? error : null}
        onRetry={reload}
        minWidth={940}
        toolbar={
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-mod-audit" aria-hidden="true" /><h2 className="text-card-title font-semibold text-ink-strong">Activity history</h2></div>
              <span className="rounded-full bg-surface-muted px-2.5 py-1 text-caption font-semibold text-ink-muted tabular-nums">{data?.count ?? 0} records</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Search" hideLabel><Input size="sm" value={query} onChange={update(setQuery)} placeholder="Search action, entity, or actor" leadingIcon={<Search />} /></Field>
              <Field label="Actor email" hideLabel><Input size="sm" value={actor} onChange={update(setActor)} placeholder="Actor email" /></Field>
              <Field label="Action" hideLabel><Input size="sm" value={action} onChange={update(setAction)} placeholder="Action, e.g. payroll" /></Field>
              <Field label="Module or entity" hideLabel><Input size="sm" value={entityType} onChange={update(setEntityType)} placeholder="Module or entity, e.g. recruitment" /></Field>
              <Field label="Record UUID" hideLabel><Input size="sm" value={entityId} onChange={update(setEntityId)} placeholder="Record UUID" className="font-mono" /></Field>
              <Field label="From"><Input size="sm" type="date" value={from} onChange={update(setFrom)} /></Field>
              <Field label="To"><Input size="sm" type="date" value={to} onChange={update(setTo)} /></Field>
              {hasFilters && <div className="flex items-end"><Button size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button></div>}
            </div>
          </div>
        }
        empty={{ title: "No matching activity", description: "Try broader filters, or activity will appear as records change.", icon: ShieldCheck }}
        footer={<Pagination page={page} pageSize={PAGE_SIZE} total={data?.count ?? 0} onPageChange={(next) => setPage(Math.min(Math.max(1, next), pageCount))} />}
        columns={[
          { key: "when", header: "When", cell: (entry) => <span className="whitespace-nowrap text-ink-muted">{dateTime(entry.created_at)}</span> },
          { key: "action", header: "Action", cell: (entry) => <span className="font-semibold text-ink-strong">{pretty(entry.action)}</span> },
          { key: "actor", header: "Actor", cell: (entry) => entry.actor_email ? <span className="flex items-center gap-2"><Avatar name={entry.actor_email} size="sm" /><span className="max-w-[14rem] truncate" title={entry.actor_email}>{entry.actor_email}</span></span> : <Badge size="sm">System</Badge> },
          { key: "ip", header: "IP address", hideBelow: "xl", cell: (entry) => <span className="font-mono text-caption text-ink-muted">{entry.ip_address ?? "—"}</span> },
          { key: "area", header: "Area / record", cell: (entry) => <span><span className="block">{entry.entity_type ? pretty(entry.entity_type.split(".").pop() ?? entry.entity_type) : "—"}</span>{entry.entity_id && <span className="block font-mono text-caption text-ink-subtle">{entry.entity_id.slice(0, 8)}</span>}</span> },
          { key: "details", header: "Safe details", className: "max-w-xs", cell: (entry) => Object.entries(entry.metadata).length ? <dl className="space-y-0.5">{Object.entries(entry.metadata).slice(0, 2).map(([key, value]) => <div key={key} className="truncate text-caption"><dt className="inline text-ink-subtle">{pretty(key)}: </dt><dd className="inline text-ink">{typeof value === "object" ? "Updated" : String(value)}</dd></div>)}</dl> : "—" },
        ]}
      />
    </div>
  );
}
