"use client";

import { useCallback, useMemo, useState } from "react";
import { Siren } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SectionTitle } from "@/components/platform/ui";
import { getApiErrorMessage, platformApi, securityApi } from "@/lib/api";
import { INCIDENT_KINDS, INCIDENT_STATUS_ORDER, INCIDENT_STATUS_TONES, type IncidentKind, type IncidentSeverity, type IncidentStatus, type SecurityIncident } from "@/lib/api/security";
import { formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const SEVERITY_TONES: Record<IncidentSeverity, "danger" | "warning" | "neutral"> = { SEV1: "danger", SEV2: "warning", SEV3: "neutral" };
const STATUS_LABELS: Record<IncidentStatus, string> = { DETECTED: "Detected", INVESTIGATING: "Investigating", CONTAINED: "Contained", RECOVERED: "Recovered", CLOSED: "Closed" };

function duration(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) return `${(minutes / 60).toFixed(1)} h`;
  return `${Math.round(minutes / 1440)} days`;
}
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** Platform incident register: each incident's timeline, and recovery time against the target. */
export default function IncidentsPage() {
  const load = useCallback(() => Promise.all([securityApi.listIncidents(), platformApi.listInstitutions({ page: 1 })]), []);
  const { data, error, reload } = useApiResource(load);
  const [incidents, organisations] = data ?? [null, null];
  const blank = { title: "", summary: "", kind: "OUTAGE" as IncidentKind, severity: "SEV2" as IncidentSeverity, detected_at: nowLocal(), personal_data_affected: false, affected_institutions: [] as string[] };
  const [form, setForm] = useState<typeof blank | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const open = useMemo(() => incidents?.results.find((item) => item.id === openId) ?? null, [incidents, openId]);

  const run = async (work: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setFormError("");
    try { await work(); after?.(); reload(); } catch (caught) { setFormError(getApiErrorMessage(caught)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow={<span className="inline-flex items-center gap-1"><Siren className="h-3.5 w-3.5" aria-hidden="true" />Operations</span>} title="Incidents"
        meta={incidents ? `Recovery target ${incidents.targets.rto_hours} h · data-loss target ${incidents.targets.rpo_hours} h` : undefined} />
      {error && <Alert tone="danger">{error}</Alert>}
      {formError && !form && <Alert tone="danger" onDismiss={() => setFormError("")}>{formError}</Alert>}

      {form ? (
        <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="What happened" required><Input value={form.title} maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Sign-in failing for all organisations" /></Field>
          <Field label="Summary" required><Textarea rows={3} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Kind"><Select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as IncidentKind })}>{Object.entries(INCIDENT_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="Severity"><Select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as IncidentSeverity })}><option value="SEV1">SEV1 Critical</option><option value="SEV2">SEV2 Major</option><option value="SEV3">SEV3 Minor</option></Select></Field>
            <Field label="Detected"><Input type="datetime-local" value={form.detected_at} onChange={(event) => setForm({ ...form, detected_at: event.target.value })} /></Field>
          </div>
          <Checkbox label="Personal data may be affected" description="Each affected organisation should then record it in its own breach register (Privacy → Breaches)." checked={form.personal_data_affected} onChange={(event) => setForm({ ...form, personal_data_affected: event.target.checked })} />
          <Field label="Affected organisations" optional>
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
              {(organisations?.results ?? []).map((organisation) => (
                <Checkbox key={organisation.id} label={organisation.name} checked={form.affected_institutions.includes(organisation.id)}
                  onChange={(event) => setForm({ ...form, affected_institutions: event.target.checked ? [...form.affected_institutions, organisation.id] : form.affected_institutions.filter((value) => value !== organisation.id) })} />
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setForm(null); setFormError(""); }} disabled={busy}>Cancel</Button>
            <Button loading={busy} disabled={!form.title.trim() || !form.summary.trim()} onClick={() => void run(() => securityApi.recordIncident({ ...form, detected_at: new Date(form.detected_at).toISOString() }), () => setForm(null))}>Record incident</Button>
          </div>
        </section>
      ) : (
        <div className="flex justify-end"><Button leadingIcon={<Siren className="h-4 w-4" />} onClick={() => { setFormError(""); setForm(blank); }}>Record an incident</Button></div>
      )}

      <ul className="divide-y divide-line-soft rounded-2xl border border-line bg-surface px-5">
        {(incidents?.results ?? []).map((incident) => (
          <li key={incident.id} className="py-3">
            <button type="button" onClick={() => setOpenId(openId === incident.id ? null : incident.id)} className="w-full text-left">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{incident.title}<Badge size="sm" tone={SEVERITY_TONES[incident.severity]}>{incident.severity}</Badge><Badge size="sm" tone={INCIDENT_STATUS_TONES[incident.status]}>{incident.status_label}</Badge>{incident.personal_data_affected && <Badge size="sm" tone="danger">Personal data</Badge>}</p>
              <p className="text-caption text-ink-muted">
                {incident.kind_label} · detected {formatDateTime(incident.detected_at)}
                {incident.timings.minutes_to_recover !== null
                  ? ` · recovered in ${duration(incident.timings.minutes_to_recover)}${incident.timings.within_rto === false ? " (over target)" : ""}`
                  : ` · open ${duration(incident.timings.minutes_open)}`}
                {incident.affected_names.length ? ` · ${incident.affected_names.join(", ")}` : ""}
              </p>
            </button>
            {open?.id === incident.id && <IncidentDetail incident={incident} busy={busy} onUpdate={(note, status) => void run(() => securityApi.addIncidentUpdate(incident.id, note, status))} onSave={(values) => void run(() => securityApi.updateIncident(incident.id, values))} />}
          </li>
        ))}
        {incidents && incidents.results.length === 0 && <li className="py-4 text-support text-ink-muted">No incidents recorded.</li>}
      </ul>
    </div>
  );
}

function IncidentDetail({ incident, busy, onUpdate, onSave }: { incident: SecurityIncident; busy: boolean; onUpdate: (note: string, status?: IncidentStatus) => void; onSave: (values: { root_cause: string; lessons_learned: string }) => void }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<IncidentStatus | "">("");
  const [rootCause, setRootCause] = useState(incident.root_cause);
  const [lessons, setLessons] = useState(incident.lessons_learned);
  const later = INCIDENT_STATUS_ORDER.slice(INCIDENT_STATUS_ORDER.indexOf(incident.status) + 1);
  const closed = incident.status === "CLOSED";
  return (
    <div className="mt-3 space-y-4 rounded-xl bg-surface-muted/60 p-4">
      <p className="text-support text-ink">{incident.summary}</p>
      <ol className="space-y-2 border-l-2 border-line pl-4">
        {incident.updates.map((entry) => (
          <li key={entry.id} className="text-support">
            <span className="text-caption text-ink-muted">{formatDateTime(entry.created_at)} · {entry.author_name}{entry.status_label ? ` · now ${entry.status_label.toLowerCase()}` : ""}</span>
            <span className="block text-ink">{entry.note}</span>
          </li>
        ))}
      </ol>
      {!closed && (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Add to the timeline"><Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was found or done" /></Field>
          <Field label="Move to"><Select value={status} onChange={(event) => setStatus(event.target.value as IncidentStatus | "")}><option value="">No change</option>{later.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}</Select></Field>
          <Button loading={busy} disabled={!note.trim()} onClick={() => { onUpdate(note.trim(), status || undefined); setNote(""); setStatus(""); }}>Add</Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Root cause"><Textarea rows={2} disabled={closed} value={rootCause} onChange={(event) => setRootCause(event.target.value)} /></Field>
        <Field label="Lessons learned"><Textarea rows={2} disabled={closed} value={lessons} onChange={(event) => setLessons(event.target.value)} /></Field>
      </div>
      {!closed && <div className="flex justify-end"><Button variant="secondary" loading={busy} onClick={() => onSave({ root_cause: rootCause, lessons_learned: lessons })}>Save root cause</Button></div>}
    </div>
  );
}
