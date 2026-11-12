"use client";

import { useCallback, useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import { getApiErrorMessage, privacyApi } from "@/lib/api";
import type { BreachInput, BreachSeverity, DataBreach } from "@/lib/api/privacy";
import { formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const SEVERITY_TONES: Record<BreachSeverity, "neutral" | "warning" | "danger"> = { LOW: "neutral", MEDIUM: "warning", HIGH: "danger" };
const STATUS_TONES = { OPEN: "danger", CONTAINED: "warning", CLOSED: "success" } as const;

/** <input type="datetime-local"> value for an ISO timestamp, in the browser's time zone. */
function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

type Form = BreachInput & { id?: string; closing?: boolean };
const blank = (): Form => ({ title: "", description: "", discovered_at: new Date().toISOString(), severity: "MEDIUM", data_categories: [], people_affected: null });

function hoursText(hours: number) {
  return hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} days`;
}

/** Register of personal data breaches, with containment and who was notified (Data Protection Act, 2012, s.31). */
export default function BreachRegister({ canManage, onChanged }: { canManage: boolean; onChanged?: () => void }) {
  const load = useCallback(() => Promise.all([privacyApi.listBreaches(), privacyApi.dataCatalogue()]), []);
  const { data, error, reload } = useApiResource(load);
  const [breaches, catalogue] = data ?? [null, null];
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const save = async () => {
    if (!form) return;
    setBusy(true); setFormError("");
    const { id, closing, ...payload } = form;
    try {
      if (!id) await privacyApi.recordBreach(payload);
      else if (closing) await privacyApi.closeBreach(id, payload);
      else await privacyApi.updateBreach(id, payload);
      setForm(null); reload(); onChanged?.();
    } catch (caught) { setFormError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };
  const edit = (breach: DataBreach, closing = false) => setForm({
    id: breach.id, closing, containment: breach.containment, contained_at: breach.contained_at,
    commission_notified_at: breach.commission_notified_at, commission_reference: breach.commission_reference,
    subjects_notified_at: breach.subjects_notified_at, not_notifying_reason: breach.not_notifying_reason, lessons_learned: breach.lessons_learned,
    people_affected: breach.people_affected, severity: breach.severity,
  });
  const set = (update: Partial<Form>) => setForm((current) => (current ? { ...current, ...update } : current));

  return (
    <Card title="Breach register" icon={ShieldAlert} accent="audit" actions={canManage ? <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setForm(blank())}>Record a breach</Button> : undefined}>
      {error && <Alert tone="danger">{error}</Alert>}
      {breaches?.results.length ? (
        <ul className="divide-y divide-line-soft">
          {breaches.results.map((breach) => (
            <li key={breach.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{breach.title}<Badge size="sm" tone={SEVERITY_TONES[breach.severity]}>{breach.severity_label}</Badge><Badge size="sm" tone={STATUS_TONES[breach.status]}>{breach.status_label}</Badge></span>
                <span className="block text-caption text-ink-muted">Discovered {formatDateTime(breach.discovered_at)}{breach.people_affected !== null ? ` · ${breach.people_affected} people affected` : ""}{breach.data_category_labels.length ? ` · ${breach.data_category_labels.join(", ")}` : ""}</span>
                <span className="mt-1 block text-caption">
                  {breach.commission_notified_at
                    ? <span className="text-ink-muted">Commission notified {hoursText(breach.hours_to_commission)} after discovery{breach.commission_reference ? ` (ref. ${breach.commission_reference})` : ""}</span>
                    : breach.status === "CLOSED" ? <span className="text-ink-muted">Commission not notified: {breach.not_notifying_reason}</span>
                    : <span className="font-semibold text-danger-ink">Commission not yet notified · {hoursText(breach.hours_to_commission)} since discovery</span>}
                  {breach.subjects_notified_at && <span className="text-ink-muted"> · affected people told {formatDateTime(breach.subjects_notified_at)}</span>}
                </span>
              </span>
              {canManage && breach.status !== "CLOSED" && (
                <span className="flex shrink-0 gap-1">
                  <Button size="sm" variant="secondary" onClick={() => edit(breach)}>Update</Button>
                  <Button size="sm" variant="ghost" onClick={() => edit(breach, true)}>Close</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="text-support text-ink-muted">{breaches ? "No breaches recorded." : "Loading…"}</p>}

      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        dismissible={!busy}
        size="lg"
        title={!form?.id ? "Record a data breach" : form.closing ? "Close this breach" : "Update breach"}
        footer={<><Button variant="secondary" onClick={() => setForm(null)} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!form?.id && (!form?.title?.trim() || !form?.description?.trim())} onClick={() => void save()}>{form?.closing ? "Close breach" : "Save"}</Button></>}
      >
        {form && (
          <div className="space-y-4">
            {formError && <Alert tone="danger">{formError}</Alert>}
            {!form.id && (
              <>
                <Field label="What happened" required><Input value={form.title ?? ""} maxLength={200} onChange={(event) => set({ title: event.target.value })} placeholder="e.g. Payroll file emailed to the wrong person" /></Field>
                <Field label="Details" required><Textarea rows={3} value={form.description ?? ""} onChange={(event) => set({ description: event.target.value })} /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Discovered" required><Input type="datetime-local" value={toLocalInput(form.discovered_at)} onChange={(event) => set({ discovered_at: fromLocalInput(event.target.value) ?? undefined })} /></Field>
                  <Field label="Happened" optional><Input type="datetime-local" value={toLocalInput(form.occurred_at)} onChange={(event) => set({ occurred_at: fromLocalInput(event.target.value) })} /></Field>
                </div>
                <Field label="Kinds of data involved">
                  <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
                    {(catalogue?.categories ?? []).map((category) => (
                      <Checkbox key={category.key} label={category.label} checked={form.data_categories?.includes(category.key) ?? false}
                        onChange={(event) => set({ data_categories: event.target.checked ? [...(form.data_categories ?? []), category.key] : (form.data_categories ?? []).filter((key) => key !== category.key) })} />
                    ))}
                  </div>
                </Field>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Severity"><Select value={form.severity} onChange={(event) => set({ severity: event.target.value as BreachSeverity })}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></Select></Field>
              <Field label="People affected" optional><Input type="number" min={0} value={form.people_affected ?? ""} onChange={(event) => set({ people_affected: event.target.value === "" ? null : Number(event.target.value) })} /></Field>
            </div>
            {form.id && (
              <>
                <Field label="How it was contained"><Textarea rows={2} value={form.containment ?? ""} onChange={(event) => set({ containment: event.target.value })} /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Contained"><Input type="datetime-local" value={toLocalInput(form.contained_at)} onChange={(event) => set({ contained_at: fromLocalInput(event.target.value) })} /></Field>
                  <Field label="Data Protection Commission notified"><Input type="datetime-local" value={toLocalInput(form.commission_notified_at)} onChange={(event) => set({ commission_notified_at: fromLocalInput(event.target.value) })} /></Field>
                  <Field label="Commission reference" optional><Input value={form.commission_reference ?? ""} maxLength={100} onChange={(event) => set({ commission_reference: event.target.value })} /></Field>
                  <Field label="Affected people told"><Input type="datetime-local" value={toLocalInput(form.subjects_notified_at)} onChange={(event) => set({ subjects_notified_at: fromLocalInput(event.target.value) })} /></Field>
                </div>
                <Field label="Reason for not notifying" optional helper="Only when the Commission or the affected people were not told."><Textarea rows={2} value={form.not_notifying_reason ?? ""} onChange={(event) => set({ not_notifying_reason: event.target.value })} /></Field>
                <Field label="Lessons learned" optional><Textarea rows={2} value={form.lessons_learned ?? ""} onChange={(event) => set({ lessons_learned: event.target.value })} /></Field>
              </>
            )}
          </div>
        )}
      </Dialog>
    </Card>
  );
}
