"use client";

import { useCallback, useMemo, useState } from "react";
import { Archive, Download, Edit3, FilePlus2, Plus, ScrollText, Send, Trash2, Users } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Checkbox, Field, FileInput, Input, Select, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { getApiErrorMessage, policiesApi } from "@/lib/api";
import {
  ACKNOWLEDGEMENT_STATUS_LABELS,
  ACKNOWLEDGEMENT_STATUS_TONES,
  POLICY_CATEGORY_LABELS,
  saveBlob,
  type Policy,
  type PolicyAcknowledgementReport,
  type PolicyCategory,
  type PolicyStatus,
} from "@/lib/api/policies";
import { useAccess } from "@/lib/access";
import { cx } from "@/lib/cx";
import { formatDate, formatDateTime, humanizeEnum } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { EMPLOYMENT_TYPES } from "@/types/hr";

type View = "PUBLISHED" | "DRAFT" | "RETIRED";
type PolicyForm = { title: string; category: PolicyCategory; summary: string; body: string; employment_types: string[]; requires_acknowledgement: boolean; acknowledge_within_days: string; change_summary: string };
const emptyForm: PolicyForm = { title: "", category: "HR", summary: "", body: "", employment_types: [], requires_acknowledgement: true, acknowledge_within_days: "14", change_summary: "" };
const STATUS_TONES: Record<PolicyStatus, "neutral" | "success" | "warning"> = { DRAFT: "neutral", PUBLISHED: "success", RETIRED: "warning" };

function ProgressBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-24 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true"><span className={cx("block h-full rounded-full", value >= 90 ? "bg-success" : value >= 60 ? "bg-warning" : "bg-danger")} style={{ width: `${Math.min(100, value)}%` }} /></span>
      <span className="text-caption font-semibold tabular-nums text-ink-strong">{value.toFixed(0)}%</span>
    </span>
  );
}

/** Workplace policies: write drafts, publish them for acknowledgement, and follow up on who hasn't signed. */
export default function PoliciesPage() {
  const canManage = useAccess().can("policy.manage");
  const [view, setView] = useState<View>("PUBLISHED");
  const [editor, setEditor] = useState<{ mode: "create" | "edit" | "version"; policy: Policy | null } | null>(null);
  const [form, setForm] = useState<PolicyForm>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "publish" | "retire" | "delete"; policy: Policy } | null>(null);
  const [report, setReport] = useState<{ policy: Policy; data: PolicyAcknowledgementReport | null } | null>(null);
  const [reportFilter, setReportFilter] = useState<"outstanding" | "all">("outstanding");

  const load = useCallback(() => policiesApi.listPolicies(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const all = useMemo(() => data?.results ?? [], [data]);
  const rows = all.filter((policy) => policy.status === view);
  const count = (status: View) => all.filter((policy) => policy.status === status).length;

  const openEditor = (mode: "create" | "edit" | "version", policy: Policy | null = null) => {
    setForm(policy ? { title: policy.title, category: policy.category, summary: policy.summary, body: policy.body, employment_types: policy.employment_types, requires_acknowledgement: policy.requires_acknowledgement, acknowledge_within_days: String(policy.acknowledge_within_days), change_summary: "" } : emptyForm);
    setFile(null);
    setFormError("");
    setEditor({ mode, policy });
  };

  const save = async () => {
    if (!editor) return;
    if (!form.title.trim()) { setFormError("Give the policy a title."); return; }
    if (editor.mode === "version" && !form.change_summary.trim()) { setFormError("Say what changed, so employees know why they are signing again."); return; }
    setSaving(true);
    setFormError("");
    const payload = { title: form.title.trim(), category: form.category, summary: form.summary.trim(), body: form.body, employment_types: form.employment_types, requires_acknowledgement: form.requires_acknowledgement, acknowledge_within_days: Number(form.acknowledge_within_days) || 14 };
    try {
      if (editor.mode === "create") await policiesApi.createPolicy(payload, file);
      else if (editor.mode === "edit" && editor.policy) await policiesApi.updatePolicy(editor.policy.id, payload, file);
      else if (editor.policy) await policiesApi.publishNewVersion(editor.policy.id, { ...payload, change_summary: form.change_summary.trim() }, file);
      setEditor(null);
      if (editor.mode === "create") setView("DRAFT");
      reload();
    } catch (caught) {
      setFormError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setSaving(true);
    try {
      if (confirm.kind === "publish") { await policiesApi.publishPolicy(confirm.policy.id); setView("PUBLISHED"); }
      if (confirm.kind === "retire") await policiesApi.retirePolicy(confirm.policy.id);
      if (confirm.kind === "delete") await policiesApi.deletePolicy(confirm.policy.id);
      setConfirm(null);
      reload();
    } catch (caught) {
      setPageError(getApiErrorMessage(caught));
      setConfirm(null);
    } finally {
      setSaving(false);
    }
  };

  const openReport = async (policy: Policy) => {
    setReport({ policy, data: null });
    setReportFilter("outstanding");
    try { setReport({ policy, data: await policiesApi.getPolicyAcknowledgements(policy.id) }); }
    catch (caught) { setPageError(getApiErrorMessage(caught)); setReport(null); }
  };

  const download = async (policy: Policy) => {
    if (!policy.document) return;
    try { await saveBlob(await policiesApi.downloadPolicyFile(policy.id), policy.document.original_filename); }
    catch (caught) { setPageError(getApiErrorMessage(caught)); }
  };

  const toggleType = (type: string) => setForm((current) => ({ ...current, employment_types: current.employment_types.includes(type) ? current.employment_types.filter((item) => item !== type) : [...current.employment_types, type] }));
  const reportRows = (report?.data?.employees ?? []).filter((row) => reportFilter === "all" || row.status === "PENDING" || row.status === "OVERDUE");
  const editorTitle = editor?.mode === "create" ? "New policy" : editor?.mode === "edit" ? "Edit draft" : `New version of ${editor?.policy?.title ?? "policy"}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Human Resources"
        title="Policies"
       
        icon={ScrollText}
        accent="hr"
        actions={canManage ? <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => openEditor("create")}>New policy</Button> : null}
      />

      {pageError && <Alert tone="danger" onDismiss={() => setPageError("")}>{pageError}</Alert>}

      <Tabs label="Policy status" value={view} onChange={(value) => setView(value as View)} items={[{ value: "PUBLISHED", label: `Published (${count("PUBLISHED")})` }, { value: "DRAFT", label: `Drafts (${count("DRAFT")})` }, { value: "RETIRED", label: `Retired (${count("RETIRED")})` }]} />

      <DataTable<Policy>
        caption="Policies"
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        minWidth={820}
        onRowClick={view === "PUBLISHED" ? (row) => void openReport(row) : undefined}
        empty={{ title: view === "DRAFT" ? "No drafts" : view === "RETIRED" ? "No retired policies" : "No published policies", description: view === "PUBLISHED" ? "Write a policy, then publish it for employees to acknowledge." : undefined, icon: ScrollText, action: canManage && view !== "RETIRED" ? <Button variant="secondary" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => openEditor("create")}>New policy</Button> : undefined }}
        columns={[
          { key: "title", header: "Policy", sortValue: (row) => row.title, cell: (row) => <span><span className="block font-semibold text-ink-strong">{row.title}</span><span className="text-caption text-ink-muted">{row.category_label}{row.version > 1 ? ` · version ${row.version}` : ""}{row.document ? " · document attached" : ""}</span></span> },
          { key: "applies", header: "Applies to", hideBelow: "md", cell: (row) => row.employment_types.length ? row.employment_types.map(humanizeEnum).join(", ") : "All employees" },
          { key: "status", header: "Status", cell: (row) => <span className="flex flex-col gap-0.5"><Badge size="sm" tone={STATUS_TONES[row.status]}>{humanizeEnum(row.status)}</Badge>{row.published_at && <span className="text-caption text-ink-muted">{formatDate(row.published_at)}</span>}</span> },
          { key: "acknowledged", header: "Acknowledged", cell: (row) => !row.requires_acknowledgement ? <span className="text-caption text-ink-muted">For information</span> : row.acknowledgement_summary ? <span className="flex flex-col gap-0.5"><ProgressBar value={row.acknowledgement_summary.rate} /><span className="text-caption text-ink-muted">{row.acknowledgement_summary.acknowledged} of {row.acknowledgement_summary.applicable}{row.acknowledgement_summary.overdue ? ` · ${row.acknowledgement_summary.overdue} overdue` : ""}</span></span> : <span className="text-caption text-ink-muted">—</span> },
          {
            key: "actions", header: <span className="sr-only">Actions</span>, cell: (row) => (
              <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                {row.document && <IconButton size="sm" label={`Download ${row.title}`} onClick={() => void download(row)}><Download className="h-4 w-4" /></IconButton>}
                {row.status === "PUBLISHED" && <IconButton size="sm" label={`Who has signed ${row.title}`} onClick={() => void openReport(row)}><Users className="h-4 w-4" /></IconButton>}
                {canManage && row.status === "DRAFT" && <>
                  <Button size="sm" variant="secondary" leadingIcon={<Send className="h-4 w-4" />} onClick={() => setConfirm({ kind: "publish", policy: row })}>Publish</Button>
                  <IconButton size="sm" label={`Edit ${row.title}`} onClick={() => openEditor("edit", row)}><Edit3 className="h-4 w-4" /></IconButton>
                  <IconButton size="sm" label={`Delete ${row.title}`} className="text-danger-ink hover:bg-danger-soft" onClick={() => setConfirm({ kind: "delete", policy: row })}><Trash2 className="h-4 w-4" /></IconButton>
                </>}
                {canManage && row.status === "PUBLISHED" && <>
                  <IconButton size="sm" label={`New version of ${row.title}`} onClick={() => openEditor("version", row)}><FilePlus2 className="h-4 w-4" /></IconButton>
                  <IconButton size="sm" label={`Retire ${row.title}`} onClick={() => setConfirm({ kind: "retire", policy: row })}><Archive className="h-4 w-4" /></IconButton>
                </>}
              </div>
            ),
          },
        ]}
      />

      <Dialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        dismissible={!saving}
        size="lg"
        title={editorTitle}
        description={editor?.mode === "version" ? "Publishing a new version asks everyone it applies to to sign again. Earlier signatures stay on record." : "Drafts are visible to HR only until you publish them."}
        footer={<><Button variant="secondary" onClick={() => setEditor(null)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} loading={saving} loadingLabel="Saving…">{editor?.mode === "version" ? "Publish new version" : editor?.mode === "edit" ? "Save draft" : "Save as draft"}</Button></>}
      >
        <div className="space-y-5">
          {formError && <Alert tone="danger">{formError}</Alert>}
          {editor?.mode === "version" && <Field label="What changed" required><Input value={form.change_summary} maxLength={500} onChange={(event) => setForm({ ...form, change_summary: event.target.value })} placeholder="e.g. Gift limit raised to GHS 1,000; new reporting hotline." data-autofocus /></Field>}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="Title" required><Input value={form.title} maxLength={150} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Code of conduct" data-autofocus={editor?.mode !== "version" ? true : undefined} /></Field>
            <Field label="Category"><Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as PolicyCategory })}>{Object.entries(POLICY_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          </div>
          <Field label="Summary" optional helper="One or two sentences shown in the policy list."><Textarea value={form.summary} maxLength={1000} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows={2} /></Field>
          <Field label="Policy text" optional helper="Write the policy here, attach the document below, or both."><Textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} rows={8} /></Field>
          <Field label={editor?.policy?.document ? `Replace document (${editor.policy.document.original_filename})` : "Policy document"} optional>
            <FileInput accept=".pdf,.doc,.docx,.odt,.txt" fileName={file?.name} hint="PDF or Word, up to 25 MB." onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </Field>
          <Field label="Applies to" helper="Leave all unticked for every employee.">
            <div className="flex flex-wrap gap-3">{EMPLOYMENT_TYPES.map((type) => <Checkbox key={type} label={humanizeEnum(type)} checked={form.employment_types.includes(type)} onChange={() => toggleType(type)} />)}</div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Checkbox label="Employees must acknowledge" description="Untick for policies shared for information only." checked={form.requires_acknowledgement} onChange={(event) => setForm({ ...form, requires_acknowledgement: event.target.checked })} />
            {form.requires_acknowledgement && <Field label="Days to acknowledge" helper="Counted from publication, or from the start date for new hires."><Input type="number" min={1} max={365} value={form.acknowledge_within_days} onChange={(event) => setForm({ ...form, acknowledge_within_days: event.target.value })} /></Field>}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={report !== null}
        onClose={() => setReport(null)}
        size="lg"
        title={report ? `Who has signed: ${report.policy.title}` : "Acknowledgements"}
        description={report?.data ? `Version ${report.data.version} · ${report.data.summary.acknowledged} of ${report.data.summary.applicable} acknowledged${report.data.summary.overdue ? ` · ${report.data.summary.overdue} overdue` : ""}` : "Loading…"}
        footer={<Button variant="secondary" onClick={() => setReport(null)}>Close</Button>}
      >
        <div className="space-y-3">
          <Tabs label="Show" value={reportFilter} onChange={(value) => setReportFilter(value as "outstanding" | "all")} items={[{ value: "outstanding", label: "Not yet signed" }, { value: "all", label: "Everyone" }]} />
          {report && !report.data ? <p className="text-support text-ink-muted">Loading…</p> : reportRows.length === 0 ? (
            <p className="text-support text-ink-muted">{reportFilter === "outstanding" ? "Everyone has signed the current version." : "This policy applies to no active employees."}</p>
          ) : (
            <ul className="max-h-[50vh] divide-y divide-line-soft overflow-y-auto">
              {reportRows.map((row) => (
                <li key={row.employee_id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink-strong">{row.employee}</span><span className="text-caption text-ink-muted">{row.employee_number}{row.acknowledgement ? ` · signed “${row.acknowledgement.signed_name}” ${formatDateTime(row.acknowledgement.acknowledged_at)}` : ` · due ${formatDate(row.due_date)}`}</span></span>
                  <Badge size="sm" tone={ACKNOWLEDGEMENT_STATUS_TONES[row.status]}>{ACKNOWLEDGEMENT_STATUS_LABELS[row.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "publish" ? "Publish policy" : confirm?.kind === "retire" ? "Retire policy" : "Delete draft"}
        description={confirm ? confirm.kind === "publish" ? `Publish "${confirm.policy.title}"? Employees it applies to will be asked to read${confirm.policy.requires_acknowledgement ? " and sign" : ""} it. Its content can't be edited afterwards; publish a new version instead.` : confirm.kind === "retire" ? `Retire "${confirm.policy.title}"? Employees stop seeing it. Existing signatures stay on record.` : `Delete the draft "${confirm.policy.title}"?` : ""}
        confirmLabel={confirm?.kind === "publish" ? "Publish" : confirm?.kind === "retire" ? "Retire" : "Delete"}
        destructive={confirm?.kind !== "publish"}
        loading={saving}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />
    </div>
  );
}
