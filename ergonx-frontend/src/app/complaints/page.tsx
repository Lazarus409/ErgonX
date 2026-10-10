"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, Inbox, MessageSquareWarning } from "lucide-react";

import ModuleAccessGate from "@/components/guards/ModuleAccessGate";
import { INSTITUTION_WIDE } from "@/components/navigation/navigation";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/Card";
import { DataTable, DataToolbar } from "@/components/ui/DataTable";
import { Select } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { complaintsApi } from "@/lib/api";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_PRIORITY_LABELS,
  COMPLAINT_PRIORITY_TONES,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_TONES,
  OPEN_COMPLAINT_STATUSES,
  type ComplaintCategory,
  type ComplaintSummary,
} from "@/lib/api/complaints";
import { formatDate, formatNumber } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const COMPLAINT_PERMISSIONS = ["complaint.view", "complaint.manage"] as const;
type View = "open" | "mine" | "all";
const ALL = "ALL";
const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as const;

export default function ComplaintsPage() {
  return <ModuleAccessGate module="HR" anyPermissions={COMPLAINT_PERMISSIONS} scopes={INSTITUTION_WIDE}><ComplaintsWorkspace /></ModuleAccessGate>;
}

/** HR's complaints workspace: what is open, what is assigned to me, and everything filed. */
function ComplaintsWorkspace() {
  const router = useRouter();
  const [view, setView] = useState<View>("open");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const load = useCallback(() => Promise.all([complaintsApi.getOverview(), complaintsApi.listComplaints({ ordering: "-created_at" }), complaintsApi.listComplaints({ assigned: "me" })]), []);
  const { data, loading, error, reload } = useApiResource(load);
  const overview = data?.[0];
  const initial = loading && !data;

  const rows = useMemo(() => {
    const all = (view === "mine" ? data?.[2].results : data?.[1].results) ?? [];
    const query = search.trim().toLowerCase();
    return all
      .filter((row) => (view === "open" ? OPEN_COMPLAINT_STATUSES.includes(row.status) : true))
      .filter((row) => category === ALL || row.category === category)
      .filter((row) => !query || [row.code, row.subject, row.complainant_name, row.complainant_number, row.respondent_name].some((value) => value.toLowerCase().includes(query)))
      .sort((a, b) => (view === "open" ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] : 0) || b.created_at.localeCompare(a.created_at));
  }, [data, view, search, category]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Human Resources" title="Complaints" description="Confidential employee complaints: review, investigate and record the outcome." icon={MessageSquareWarning} accent="hr" />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Complaints summary">
        <MetricCard label="Open complaints" value={overview ? formatNumber(overview.open) : "—"} description={overview ? `${formatNumber(overview.by_status.SUBMITTED)} waiting for HR` : undefined} icon={Inbox} accent="hr" loading={initial} />
        <MetricCard label="High or urgent" value={overview ? formatNumber(overview.urgent_open) : "—"} description="Open complaints" icon={AlertTriangle} accent="audit" loading={initial} />
        <MetricCard label="Overdue" value={overview ? formatNumber(overview.overdue) : "—"} description={overview ? `Open more than ${overview.overdue_days} days` : undefined} icon={Clock3} accent="leave" loading={initial} />
        <MetricCard label="Resolved this year" value={overview ? formatNumber(overview.resolved_this_year) : "—"} description={overview?.average_days_to_resolve != null ? `${overview.average_days_to_resolve} days on average` : undefined} icon={CheckCircle2} accent="attendance" loading={initial} />
      </section>

      <Tabs label="Complaints" value={view} onChange={(value) => setView(value as View)} items={[
        { value: "open", label: `Open (${overview?.open ?? 0})` },
        { value: "mine", label: `Assigned to me (${data?.[2].results.filter((row) => OPEN_COMPLAINT_STATUSES.includes(row.status)).length ?? 0})` },
        { value: "all", label: `All (${overview?.total ?? 0})` },
      ]} />

      <DataTable<ComplaintSummary>
        caption="Complaints"
        rows={rows}
        rowKey={(row) => row.id}
        loading={initial}
        error={error}
        onRetry={reload}
        minWidth={900}
        onRowClick={(row) => router.push(`/complaints/${row.id}`)}
        toolbar={
          <DataToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search code, subject or employee…"
            filters={<Select size="sm" aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}><option value={ALL}>All categories</option>{(Object.keys(COMPLAINT_CATEGORY_LABELS) as ComplaintCategory[]).map((value) => <option key={value} value={value}>{COMPLAINT_CATEGORY_LABELS[value]}</option>)}</Select>}
            onClear={search || category !== ALL ? () => { setSearch(""); setCategory(ALL); } : undefined}
          />
        }
        empty={{ title: view === "open" ? "No open complaints" : "No complaints found", description: "Complaints employees file from My Complaints appear here.", icon: MessageSquareWarning }}
        columns={[
          { key: "code", header: "Complaint", sortValue: (row) => row.code, cell: (row) => <span><Link href={`/complaints/${row.id}`} className="block font-semibold text-ink-strong hover:underline">{row.subject}</Link><span className="text-caption text-ink-muted">{row.code} · {row.category_label}</span></span> },
          { key: "complainant", header: "Filed by", sortValue: (row) => row.complainant_name, cell: (row) => <span><span className="block text-ink-strong">{row.complainant_name}</span><span className="text-caption text-ink-muted">{row.complainant_number}</span></span> },
          { key: "about", header: "About", hideBelow: "lg", cell: (row) => row.respondent_name || <span className="text-ink-subtle">—</span> },
          { key: "filed", header: "Filed", sortValue: (row) => row.created_at, cell: (row) => formatDate(row.created_at) },
          { key: "priority", header: "Priority", cell: (row) => <Badge size="sm" tone={COMPLAINT_PRIORITY_TONES[row.priority]}>{COMPLAINT_PRIORITY_LABELS[row.priority]}</Badge> },
          { key: "status", header: "Status", cell: (row) => <Badge size="sm" tone={COMPLAINT_STATUS_TONES[row.status]}>{COMPLAINT_STATUS_LABELS[row.status]}</Badge> },
          { key: "handler", header: "Handled by", hideBelow: "lg", cell: (row) => row.assigned_to_name || <span className="text-ink-subtle">Unassigned</span> },
        ]}
      />
    </div>
  );
}
