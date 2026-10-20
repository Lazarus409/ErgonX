"use client";

import { useCallback, useState } from "react";
import { Archive, FileDown, Lock, Plus, ShieldCheck } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, MetricCard } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { employeesApi, getApiErrorMessage, privacyApi } from "@/lib/api";
import { saveBlob } from "@/lib/api/policies";
import { DSR_STATUS_TONES, DSR_TYPE_LABELS, RETENTION_LABELS, type DataSubjectRequest, type DsrStatus, type DsrType, type RetentionCategory } from "@/lib/api/privacy";
import { useAccess } from "@/lib/access";
import { formatDate, formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

type View = "requests" | "retention" | "holds" | "consents";
const CATEGORIES = Object.keys(RETENTION_LABELS) as RetentionCategory[];
const ANONYMISABLE: RetentionCategory[] = ["CANDIDATES", "FORMER_EMPLOYEES"];

/** Data protection: requests from data subjects, retention, legal holds and the consent register. */
export default function PrivacyPage() {
  const canManage = useAccess().can("privacy.manage");
  const [view, setView] = useState<View>("requests");
  const load = useCallback(() => Promise.all([privacyApi.listRequests(), privacyApi.listRetentionRules(), privacyApi.retentionReport(), privacyApi.listLegalHolds(), privacyApi.consents()]), []);
  const { data, error, reload } = useApiResource(load);
  const [requests, rules, report, holds, consentRows] = data ?? [null, null, null, null, null];
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [deciding, setDeciding] = useState<{ request: DataSubjectRequest; status: DsrStatus; outcome: string } | null>(null);
  const [logging, setLogging] = useState<{ request_type: DsrType; requester_name: string; requester_email: string; details: string } | null>(null);
  const [holdForm, setHoldForm] = useState<{ title: string; reason: string; employees: string[] } | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);

  const run = async (work: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setActionError("");
    try { await work(); after?.(); reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); } finally { setBusy(false); }
  };
  const open = (requests?.results ?? []).filter((row) => row.status === "RECEIVED" || row.status === "IN_PROGRESS");
  const ruleFor = (category: RetentionCategory) => rules?.results.find((rule) => rule.category === category);
  const reportFor = (category: RetentionCategory) => report?.rules.find((row) => row.category === category);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader eyebrow="Compliance" title="Privacy & data protection" icon={ShieldCheck} accent="audit" />
      {(error || actionError) && <Alert tone="danger" onDismiss={actionError ? () => setActionError("") : undefined}>{error || actionError}</Alert>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Privacy summary">
        <MetricCard label="Open requests" value={String(open.length)} description={`${open.filter((row) => row.overdue).length} overdue`} icon={FileDown} accent="audit" />
        <MetricCard label="Due for clean-up" value={String(report?.rules.reduce((sum, row) => sum + (ANONYMISABLE.includes(row.category) ? row.due : 0), 0) ?? 0)} description="Candidates and former employees" icon={Archive} accent="hr" />
        <MetricCard label="Legal holds" value={String(report?.legal_holds ?? 0)} description="Active holds pausing clean-up" icon={Lock} accent="payroll" />
        <MetricCard label="Consents on record" value={String(consentRows?.consents.length ?? 0)} description="Careers consents and policy signatures" icon={ShieldCheck} accent="attendance" />
      </section>
      <Tabs label="Privacy" value={view} onChange={(value) => setView(value as View)} items={[{ value: "requests", label: `Requests (${open.length} open)` }, { value: "retention", label: "Retention" }, { value: "holds", label: "Legal holds" }, { value: "consents", label: "Consents" }]} />

      {view === "requests" && (
        <Card title="Data subject requests" icon={FileDown} accent="audit" actions={canManage ? <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setLogging({ request_type: "ACCESS", requester_name: "", requester_email: "", details: "" })}>Log a request</Button> : undefined}>
          {requests?.results.length ? (
            <ul className="divide-y divide-line-soft">
              {requests.results.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{row.type_label} · {row.requester_name}<Badge size="sm" tone={DSR_STATUS_TONES[row.status]}>{row.status_label}</Badge>{row.overdue && <Badge size="sm" tone="danger">Overdue</Badge>}</span>
                    <span className="block text-caption text-ink-muted">{row.subject} · received {formatDate(row.received_at)} · respond by {formatDate(row.due_on)}{row.requester_email ? ` · ${row.requester_email}` : ""}</span>
                    {row.details && <span className="mt-1 block text-support text-ink">{row.details}</span>}
                    {row.outcome && <span className="mt-1 block text-caption text-ink-muted">Outcome: {row.outcome}</span>}
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-1">
                    {(row.employee || row.candidate) && <Button size="sm" variant="ghost" leadingIcon={<FileDown className="h-4 w-4" />} onClick={() => void privacyApi.exportRequest(row.id).then((blob) => saveBlob(blob, `personal-data-${row.requester_name}.json`)).catch((caught) => setActionError(getApiErrorMessage(caught)))}>Export data</Button>}
                    {canManage && row.request_type === "ERASURE" && row.candidate && (row.status === "RECEIVED" || row.status === "IN_PROGRESS") && <Button size="sm" variant="danger" disabled={busy} onClick={() => window.confirm("Anonymise this candidate and delete their documents? This can't be undone.") && void run(() => privacyApi.eraseCandidate(row.id))}>Erase candidate</Button>}
                    {canManage && (row.status === "RECEIVED" || row.status === "IN_PROGRESS") && <Button size="sm" variant="secondary" onClick={() => setDeciding({ request: row, status: "COMPLETED", outcome: row.outcome })}>Update</Button>}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-support text-ink-muted">No requests yet. Employees can make one from Settings → My data &amp; privacy; log requests received by email or letter here.</p>}
        </Card>
      )}

      {view === "retention" && (
        <Card title="Retention rules" description="Set how long each kind of personal data is kept. Anonymise rules clear personal details when due; review rules only list what is due." icon={Archive} accent="hr">
          <ul className="divide-y divide-line-soft">
            {CATEGORIES.map((category) => {
              const rule = ruleFor(category);
              const due = reportFor(category);
              return (
                <li key={category} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink-strong">{RETENTION_LABELS[category]}</span>
                    <span className="block text-caption text-ink-muted">{rule ? `Keep ${rule.keep_months} months · ${rule.action === "ANONYMISE" ? "anonymise when due" : "review only"}${rule.is_active ? "" : " · off"}${rule.last_run_at ? ` · last run ${formatDateTime(rule.last_run_at)}` : ""}` : "No rule set"}{due ? ` · ${due.due} due now` : ""}</span>
                    {due && due.sample.length > 0 && <span className="block text-caption text-ink-muted">e.g. {due.sample.slice(0, 5).map((row) => row.name).join(", ")}{due.due > 5 ? "…" : ""}</span>}
                  </span>
                  {canManage && <RetentionControls category={category} rule={rule} due={due?.due ?? 0} busy={busy} onSave={(values) => void run(() => privacyApi.saveRetentionRule({ category, ...values }, rule?.id))} onRun={() => rule && window.confirm(`Apply "${RETENTION_LABELS[category]}" to ${due?.due ?? 0} record(s) now? This can't be undone.`) && void run(() => privacyApi.runRetention(rule.id))} />}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {view === "holds" && (
        <Card title="Legal holds" description="People under a hold are skipped by every retention rule until the hold is released." icon={Lock} accent="payroll"
          actions={canManage ? <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => { setHoldForm({ title: "", reason: "", employees: [] }); void employeesApi.listEmployees({ page_size: 100, ordering: "first_name" }).then((page) => setPeople(page.results.map((row) => ({ id: row.id, name: row.full_name })))).catch(() => setPeople([])); }}>Place a hold</Button> : undefined}>
          {holds?.results.length ? (
            <ul className="divide-y divide-line-soft">
              {holds.results.map((hold) => (
                <li key={hold.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{hold.title}{hold.released_at ? <Badge size="sm">Released</Badge> : <Badge size="sm" tone="warning">Active</Badge>}</span>
                    <span className="block text-caption text-ink-muted">{[...hold.employee_names, ...hold.candidate_names].join(", ") || "Nobody named"} · placed {formatDate(hold.created_at)}</span>
                    <span className="block text-support text-ink">{hold.reason}</span>
                  </span>
                  {canManage && !hold.released_at && <Button size="sm" variant="secondary" disabled={busy} onClick={() => window.confirm("Release this hold? Retention rules apply again to these people.") && void run(() => privacyApi.releaseLegalHold(hold.id))}>Release</Button>}
                </li>
              ))}
            </ul>
          ) : <p className="text-support text-ink-muted">No legal holds.</p>}
        </Card>
      )}

      {view === "consents" && (
        <Card title="Consent register" description="Data-use consents given on the careers site and policy acknowledgements, newest first." icon={ShieldCheck} accent="attendance">
          {consentRows?.consents.length ? (
            <ul className="max-h-[60vh] divide-y divide-line-soft overflow-y-auto">
              {consentRows.consents.map((row, index) => (
                <li key={index} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0"><span className="block font-medium text-ink-strong">{row.subject}</span><span className="block truncate text-caption text-ink-muted">{row.kind === "CAREERS_DATA_USE" ? "Careers data use" : "Policy acknowledged"} · {row.detail}</span></span>
                  <span className="shrink-0 text-caption text-ink-muted">{formatDateTime(row.given_at)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-support text-ink-muted">No consents recorded yet.</p>}
        </Card>
      )}

      <Dialog open={deciding !== null} onClose={() => setDeciding(null)} dismissible={!busy} title={deciding ? `${deciding.request.type_label} · ${deciding.request.requester_name}` : "Update request"}
        footer={<><Button variant="secondary" onClick={() => setDeciding(null)} disabled={busy}>Cancel</Button><Button loading={busy} onClick={() => deciding && void run(() => privacyApi.updateRequest(deciding.request.id, deciding.status, deciding.outcome), () => setDeciding(null))}>Save</Button></>}>
        {deciding && (
          <div className="space-y-4">
            <Field label="Status"><Select value={deciding.status} onChange={(event) => setDeciding({ ...deciding, status: event.target.value as DsrStatus })}><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="REJECTED">Refused</option></Select></Field>
            <Field label="Outcome" required={deciding.status !== "IN_PROGRESS"} helper="What you did, or the lawful reason for refusing (e.g. records we must keep under tax law)."><Textarea rows={3} value={deciding.outcome} onChange={(event) => setDeciding({ ...deciding, outcome: event.target.value })} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog open={logging !== null} onClose={() => setLogging(null)} dismissible={!busy} title="Log a data protection request" description="For requests received by email, letter or in person. The 30-day clock starts now."
        footer={<><Button variant="secondary" onClick={() => setLogging(null)} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!logging?.requester_name.trim()} onClick={() => logging && void run(() => privacyApi.logRequest({ ...logging, requester_name: logging.requester_name.trim() }), () => setLogging(null))}>Log request</Button></>}>
        {logging && (
          <div className="space-y-4">
            <Field label="Request"><Select value={logging.request_type} onChange={(event) => setLogging({ ...logging, request_type: event.target.value as DsrType })}>{Object.entries(DSR_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required><Input value={logging.requester_name} onChange={(event) => setLogging({ ...logging, requester_name: event.target.value })} /></Field>
              <Field label="Email" optional><Input type="email" value={logging.requester_email} onChange={(event) => setLogging({ ...logging, requester_email: event.target.value })} /></Field>
            </div>
            <Field label="Details" optional><Textarea rows={3} value={logging.details} onChange={(event) => setLogging({ ...logging, details: event.target.value })} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog open={holdForm !== null} onClose={() => setHoldForm(null)} dismissible={!busy} title="Place a legal hold"
        footer={<><Button variant="secondary" onClick={() => setHoldForm(null)} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!holdForm?.title.trim() || !holdForm.reason.trim()} onClick={() => holdForm && void run(() => privacyApi.createLegalHold({ ...holdForm, candidates: [] }), () => setHoldForm(null))}>Place hold</Button></>}>
        {holdForm && (
          <div className="space-y-4">
            <Field label="Title" required><Input value={holdForm.title} maxLength={150} onChange={(event) => setHoldForm({ ...holdForm, title: event.target.value })} placeholder="e.g. Labour tribunal case 2026/14" /></Field>
            <Field label="Reason" required><Textarea rows={2} value={holdForm.reason} onChange={(event) => setHoldForm({ ...holdForm, reason: event.target.value })} /></Field>
            <Field label="Employees">
              <Select multiple value={holdForm.employees} onChange={(event) => setHoldForm({ ...holdForm, employees: Array.from(event.target.selectedOptions).map((option) => option.value) })} className="h-40">
                {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </Select>
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function RetentionControls({ category, rule, due, busy, onSave, onRun }: { category: RetentionCategory; rule?: { keep_months: number; action: "ANONYMISE" | "REVIEW"; is_active: boolean }; due: number; busy: boolean; onSave: (values: { keep_months: number; action: "ANONYMISE" | "REVIEW"; is_active: boolean }) => void; onRun: () => void }) {
  const [months, setMonths] = useState(String(rule?.keep_months ?? (category === "CANDIDATES" ? 12 : category === "FORMER_EMPLOYEES" ? 72 : 84)));
  const [mode, setMode] = useState<"ANONYMISE" | "REVIEW">(rule?.action ?? "REVIEW");
  const canAnonymise = ANONYMISABLE.includes(category);
  return (
    <span className="flex shrink-0 flex-wrap items-end gap-2">
      <Field label="Months" className="w-24"><Input type="number" min={1} max={1200} value={months} onChange={(event) => setMonths(event.target.value)} /></Field>
      <Field label="When due" className="w-44"><Select value={mode} onChange={(event) => setMode(event.target.value as "ANONYMISE" | "REVIEW")} disabled={!canAnonymise}><option value="REVIEW">List for review</option>{canAnonymise && <option value="ANONYMISE">Anonymise</option>}</Select></Field>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => onSave({ keep_months: Number(months) || 1, action: mode, is_active: true })}>{rule ? "Save" : "Set rule"}</Button>
      {rule?.action === "ANONYMISE" && due > 0 && <Button size="sm" variant="danger" disabled={busy} onClick={onRun}>Run now ({due})</Button>}
    </span>
  );
}
