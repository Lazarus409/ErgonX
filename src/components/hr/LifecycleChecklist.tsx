"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, MinusCircle, Plus, RotateCcw, Trash2 } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import { employeesApi, getApiErrorMessage } from "@/lib/api";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/format";
import {
  LIFECYCLE_CATEGORY_LABELS,
  LIFECYCLE_TASK_CATEGORIES,
  LIFECYCLE_TASK_OWNERS,
  type EmployeeOffboarding,
  type EmployeeOnboarding,
  type LifecycleProcess,
  type LifecycleTask,
  type LifecycleTaskCategory,
  type LifecycleTaskOwner,
} from "@/types/hr";

type AddForm = { title: string; category: LifecycleTaskCategory; owner: LifecycleTaskOwner; due_date: string; is_required: boolean };
const emptyAdd: AddForm = { title: "", category: "OTHER", owner: "HR", due_date: "", is_required: true };

/**
 * The checklist on one onboarding or offboarding record. Required items must be
 * done (or marked not applicable with a reason) before the record can complete.
 */
export default function LifecycleChecklist({ employeeId, process, record, canManage, onChanged }: {
  employeeId: string;
  process: LifecycleProcess;
  record: EmployeeOnboarding | EmployeeOffboarding | null | undefined;
  canManage: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [skipping, setSkipping] = useState<LifecycleTask | null>(null);
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AddForm>(emptyAdd);

  if (!record || record.status === "NOT_STARTED") return null;
  const tasks = record.tasks ?? [];
  const editable = canManage && record.status !== "COMPLETED" && record.status !== "CANCELLED";
  const { total, closed, required_open: requiredOpen } = record.checklist ?? { total: 0, closed: 0, required_open: 0 };

  const run = async (key: string, work: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try { await work(); await onChanged(); return true; }
    catch (caught) { setError(getApiErrorMessage(caught)); return false; }
    finally { setBusy(null); }
  };

  const setStatus = (task: LifecycleTask, status: LifecycleTask["status"], note?: string) =>
    run(task.id, () => employeesApi.updateLifecycleTask(employeeId, task.id, note === undefined ? { status } : { status, note }));

  const skip = async () => {
    if (!skipping) return;
    if (skipping.is_required && !reason.trim()) { setError("Give a reason for skipping a required item."); return; }
    if (await setStatus(skipping, "NOT_APPLICABLE", reason.trim())) setSkipping(null);
  };

  const add = async () => {
    if (!form.title.trim()) { setError("Enter what needs to be done."); return; }
    const ok = await run("add", () => employeesApi.addLifecycleTask(employeeId, { process, title: form.title.trim(), category: form.category, owner: form.owner, due_date: form.due_date || null, is_required: form.is_required }));
    if (ok) { setAdding(false); setForm(emptyAdd); }
  };

  return (
    <div className="mt-4 border-t border-line-soft pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Checklist</p>
        {total > 0 && <Badge size="sm" tone={requiredOpen ? "warning" : "success"}>{closed} of {total} done{requiredOpen ? ` · ${requiredOpen} required open` : ""}</Badge>}
      </div>
      {error && !skipping && !adding && <div className="mt-2"><Alert tone="danger" onDismiss={() => setError("")}>{error}</Alert></div>}
      {total > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
          <div className={cx("h-full rounded-full", requiredOpen ? "bg-warning" : "bg-success")} style={{ width: `${(closed * 100) / total}%` }} />
        </div>
      )}
      {tasks.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          No checklist items.{canManage && <> Set up the standard items in <Link href="/hr/lifecycle-checklists" className="font-semibold text-primary-ink hover:underline">Onboarding &amp; offboarding checklists</Link>.</>}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line-soft">
          {tasks.map((task) => {
            const isDone = task.status === "DONE";
            const isSkipped = task.status === "NOT_APPLICABLE";
            const StatusIcon = isDone ? CheckCircle2 : isSkipped ? MinusCircle : Circle;
            return (
              <li key={task.id} className="flex items-start gap-3 py-2.5">
                <button
                  type="button"
                  disabled={!editable || isSkipped || busy !== null}
                  onClick={() => void setStatus(task, isDone ? "OPEN" : "DONE")}
                  aria-label={isDone ? `Reopen ${task.title}` : `Mark ${task.title} done`}
                  className={cx("mt-0.5 shrink-0 rounded-full disabled:cursor-default", isDone ? "text-success" : isSkipped ? "text-ink-muted" : "text-ink-muted hover:text-primary-ink")}
                >
                  <StatusIcon className="h-5 w-5" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cx("flex flex-wrap items-center gap-1.5 text-sm font-medium", isDone || isSkipped ? "text-ink-muted line-through decoration-ink-muted/50" : "text-ink-strong")}>
                    {task.title}
                    {!task.is_required && <Badge size="sm">Optional</Badge>}
                    {task.is_overdue && <Badge size="sm" tone="danger">Overdue</Badge>}
                  </p>
                  <p className="mt-0.5 text-caption text-ink-muted">
                    {task.owner_label} · {task.category_label}
                    {task.due_date && ` · due ${formatDate(task.due_date)}`}
                    {task.completed_at && ` · ${isSkipped ? "skipped" : "done"} by ${task.completed_by_name || "HR"} ${formatDate(task.completed_at)}`}
                  </p>
                  {task.note && <p className="mt-0.5 text-caption text-ink">{task.note}</p>}
                </div>
                {editable && (
                  <div className="flex shrink-0 gap-1">
                    {task.status === "OPEN" && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => { setSkipping(task); setReason(""); setError(""); }}>Skip</Button>}
                    {isSkipped && <IconButton size="sm" label={`Reopen ${task.title}`} disabled={busy !== null} onClick={() => void setStatus(task, "OPEN")}><RotateCcw className="h-4 w-4" /></IconButton>}
                    {!task.is_standard && <IconButton size="sm" label={`Remove ${task.title}`} className="text-danger-ink hover:bg-danger-soft" disabled={busy !== null} onClick={() => void run(task.id, () => employeesApi.deleteLifecycleTask(employeeId, task.id))}><Trash2 className="h-4 w-4" /></IconButton>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editable && <Button className="mt-2" size="sm" variant="ghost" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => { setForm(emptyAdd); setError(""); setAdding(true); }}>Add item</Button>}

      <Dialog
        open={skipping !== null}
        onClose={() => setSkipping(null)}
        title={skipping ? `Skip “${skipping.title}”` : "Skip item"}
        description="The item is marked not applicable. The reason stays on the record and in the audit trail."
        footer={<><Button variant="secondary" onClick={() => setSkipping(null)}>Cancel</Button><Button onClick={() => void skip()} loading={busy !== null}>Mark not applicable</Button></>}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Reason" required={skipping?.is_required} optional={!skipping?.is_required}>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="e.g. Works remotely; no ID card or office keys issued." data-autofocus />
        </Field>
      </Dialog>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={`Add ${process === "ONBOARDING" ? "onboarding" : "offboarding"} item`}
        description="Adds an item to this employee's checklist only. To change the standard list, edit the checklist templates."
        footer={<><Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button onClick={() => void add()} loading={busy === "add"}>Add item</Button></>}
      >
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="What needs to be done" required><Input value={form.title} maxLength={150} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={process === "ONBOARDING" ? "e.g. Issue site safety boots" : "e.g. Return fuel card"} data-autofocus /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Category"><Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as LifecycleTaskCategory })}>{LIFECYCLE_TASK_CATEGORIES[process].map((value) => <option key={value} value={value}>{LIFECYCLE_CATEGORY_LABELS[value]}</option>)}</Select></Field>
            <Field label="Responsible"><Select value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value as LifecycleTaskOwner })}>{Object.entries(LIFECYCLE_TASK_OWNERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="Due date" optional><Input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></Field>
          </div>
          <Checkbox label="Required" description={`Required items must be done before ${process === "ONBOARDING" ? "onboarding" : "offboarding"} can complete.`} checked={form.is_required} onChange={(event) => setForm({ ...form, is_required: event.target.checked })} />
        </div>
      </Dialog>
    </div>
  );
}
