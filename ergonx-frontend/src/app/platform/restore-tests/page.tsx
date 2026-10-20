"use client";

import { useCallback, useState } from "react";
import { DatabaseBackup } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { SectionTitle } from "@/components/platform/ui";
import { getApiErrorMessage, securityApi } from "@/lib/api";
import type { RestoreTest } from "@/lib/api/security";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const TONES: Record<RestoreTest["result"], "success" | "warning" | "danger"> = { PASSED: "success", PARTIAL: "warning", FAILED: "danger" };

/** Platform operators record each backup restore test; organisations see the latest in their security checks and evidence pack. */
export default function RestoreTestsPage() {
  const load = useCallback(() => securityApi.listRestoreTests(), []);
  const { data, error, reload } = useApiResource(load);
  const empty = { performed_on: new Date().toISOString().slice(0, 10), backup_reference: "", environment: "", result: "PASSED" as RestoreTest["result"], duration_minutes: "", checks: "", issues: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const save = async () => {
    if (!form.backup_reference.trim() || !form.environment.trim() || !form.checks.trim()) { setFormError("Say which backup, where it was restored and what you checked."); return; }
    setBusy(true); setFormError("");
    try {
      await securityApi.recordRestoreTest({ ...form, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null, backup_reference: form.backup_reference.trim(), environment: form.environment.trim(), checks: form.checks.trim(), issues: form.issues.trim() });
      setForm(empty);
      reload();
    } catch (caught) { setFormError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow={<span className="inline-flex items-center gap-1"><DatabaseBackup className="h-3.5 w-3.5" aria-hidden="true" />Operations</span>} title="Backup restore tests" />
      {error && <Alert tone="danger">{error}</Alert>}
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Date"><Input type="date" value={form.performed_on} onChange={(event) => setForm({ ...form, performed_on: event.target.value })} /></Field>
          <Field label="Result"><Select value={form.result} onChange={(event) => setForm({ ...form, result: event.target.value as RestoreTest["result"] })}><option value="PASSED">Passed</option><option value="PARTIAL">Passed with issues</option><option value="FAILED">Failed</option></Select></Field>
          <Field label="Minutes" optional><Input type="number" min={1} value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} /></Field>
          <Field label="Restored into" required><Input value={form.environment} onChange={(event) => setForm({ ...form, environment: event.target.value })} placeholder="e.g. local postgres:18" /></Field>
        </div>
        <Field label="Backup" required><Input value={form.backup_reference} onChange={(event) => setForm({ ...form, backup_reference: event.target.value })} placeholder="e.g. live-2026-10-18.dump" /></Field>
        <Field label="What you checked" required><Textarea rows={2} value={form.checks} onChange={(event) => setForm({ ...form, checks: event.target.value })} placeholder="e.g. migrate ran, row counts match, signed in as an admin, opened a payslip PDF" /></Field>
        <Field label="Issues" optional><Textarea rows={2} value={form.issues} onChange={(event) => setForm({ ...form, issues: event.target.value })} /></Field>
        <div className="flex justify-end"><Button loading={busy} onClick={() => void save()}>Record test</Button></div>
      </section>
      <ul className="divide-y divide-line-soft rounded-2xl border border-line bg-surface px-5">
        {(data?.results ?? []).map((test) => (
          <li key={test.id} className="py-3">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{formatDate(test.performed_on)} · {test.backup_reference}<Badge size="sm" tone={TONES[test.result]}>{test.result_label}</Badge></p>
            <p className="text-caption text-ink-muted">{test.environment}{test.duration_minutes ? ` · ${test.duration_minutes} min` : ""} · by {test.performed_by_name || "unknown"}</p>
            <p className="text-support text-ink">{test.checks}</p>
            {test.issues && <p className="text-support text-warning-ink">{test.issues}</p>}
          </li>
        ))}
        {data && data.results.length === 0 && <li className="py-4 text-support text-ink-muted">No restore tests recorded yet.</li>}
      </ul>
    </div>
  );
}
