"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Lock, MessageSquare, MessageSquareWarning, RotateCcw, Search, Send, Undo2, UserCheck, XCircle } from "lucide-react";

import Alert from "@/components/ui/Alert";
import BackNavigation from "@/components/ui/BackNavigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SummaryList } from "@/components/ui/Card";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/Field";
import LifecycleStepper from "@/components/ui/LifecycleStepper";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { complaintsApi, getApiErrorMessage } from "@/lib/api";
import {
  COMPLAINT_PRIORITY_LABELS,
  COMPLAINT_PRIORITY_TONES,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_TONES,
  OPEN_COMPLAINT_STATUSES,
  type Complaint,
  type ComplaintPriority,
} from "@/lib/api/complaints";
import { cx } from "@/lib/cx";
import { formatDate, formatDateTime } from "@/lib/format";
import { lifecycles } from "@/lib/lifecycles";
import { useApiResource } from "@/lib/useApiResource";

type DialogKind = "resolve" | "reopen" | "withdraw" | "assign" | null;

/** One complaint: the employee who filed it follows and messages HR; HR investigates and records the outcome. */
export default function ComplaintPage() {
  const params = useParams<{ id: string }>();
  const load = useCallback(() => complaintsApi.getComplaint(params.id), [params.id]);
  const { data: complaint, loading, error, reload } = useApiResource(load);
  if (loading && !complaint) return <p className="text-support text-ink-muted">Loading complaint…</p>;
  if (error || !complaint) return <Alert tone="danger">{error ?? "Complaint not found."}</Alert>;
  return <ComplaintBody complaint={complaint} reload={reload} />;
}

function ComplaintBody({ complaint, reload }: { complaint: Complaint; reload: () => void }) {
  const { viewer } = complaint;
  const id = complaint.id;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [dialogText, setDialogText] = useState("");
  const [assignee, setAssignee] = useState("");
  const loadHandlers = useCallback(() => (dialog === "assign" ? complaintsApi.listHandlers() : Promise.resolve(null)), [dialog]);
  const { data: handlers } = useApiResource(loadHandlers);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setSaving(true);
    setActionError("");
    setMessage("");
    try { await work(); setMessage(done); setDialog(null); reload(); return true; }
    catch (caught) { setActionError(getApiErrorMessage(caught)); return false; }
    finally { setSaving(false); }
  };
  const open = (kind: DialogKind) => { setDialogText(""); setAssignee(complaint.assigned_to ?? ""); setActionError(""); setDialog(kind); };
  const sendNote = async () => {
    if (!note.trim()) return;
    if (await run(() => complaintsApi.addNote(id, note.trim(), viewer.is_staff && internal), viewer.is_staff && internal ? "Internal note added." : "Message sent.")) setNote("");
  };
  const isOpen = OPEN_COMPLAINT_STATUSES.includes(complaint.status);
  const back = viewer.is_staff ? "/complaints" : "/me/complaints";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackNavigation fallback={back} />
      <PageHeader
        eyebrow={complaint.code}
        title={complaint.subject}
        description={complaint.category_label}
        icon={MessageSquareWarning}
        accent="hr"
        actions={<div className="flex flex-wrap items-center gap-2"><Badge tone={COMPLAINT_STATUS_TONES[complaint.status]}>{COMPLAINT_STATUS_LABELS[complaint.status]}</Badge>{viewer.is_staff && <Badge tone={COMPLAINT_PRIORITY_TONES[complaint.priority]}>{COMPLAINT_PRIORITY_LABELS[complaint.priority]} priority</Badge>}</div>}
      />
      <LifecycleStepper lifecycle={lifecycles.complaint} status={complaint.status} />

      {message && <Alert tone="success" onDismiss={() => setMessage("")}>{message}</Alert>}
      {actionError && !dialog && <Alert tone="danger" onDismiss={() => setActionError("")}>{actionError}</Alert>}
      {viewer.is_complainant && <Alert tone="info">Your complaint is confidential. Only HR staff who handle complaints can see it; the person it is about cannot.</Alert>}

      {viewer.can_manage && (
        <Card title="HR actions" icon={UserCheck}>
          <div className="flex flex-wrap gap-2">
            {isOpen && <Button variant="secondary" leadingIcon={<UserCheck className="h-4 w-4" />} onClick={() => open("assign")}>{complaint.assigned_to ? "Reassign" : "Assign"}</Button>}
            {(complaint.status === "SUBMITTED" || complaint.status === "UNDER_REVIEW") && <Button variant="secondary" leadingIcon={<Search className="h-4 w-4" />} loading={saving} onClick={() => void run(() => complaintsApi.investigate(id), "Investigation started; the employee was notified.")}>Start investigation</Button>}
            {(complaint.status === "UNDER_REVIEW" || complaint.status === "INVESTIGATING") && <Button leadingIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => open("resolve")}>Resolve</Button>}
            {complaint.status === "RESOLVED" && <Button variant="secondary" leadingIcon={<RotateCcw className="h-4 w-4" />} onClick={() => open("reopen")}>Reopen</Button>}
            {complaint.status === "RESOLVED" && <Button leadingIcon={<Lock className="h-4 w-4" />} loading={saving} onClick={() => void run(() => complaintsApi.close(id), "Complaint closed.")}>Close</Button>}
            {isOpen && (
              <Select size="sm" aria-label="Priority" className="w-40" value={complaint.priority} onChange={(event) => void run(() => complaintsApi.setPriority(id, event.target.value as ComplaintPriority), "Priority updated.")}>
                {(Object.keys(COMPLAINT_PRIORITY_LABELS) as ComplaintPriority[]).map((value) => <option key={value} value={value}>{COMPLAINT_PRIORITY_LABELS[value]} priority</option>)}
              </Select>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="What happened">
          <p className="whitespace-pre-wrap text-support text-ink">{complaint.description}</p>
          {complaint.resolution && (
            <div className="mt-5 rounded-lg border border-success/25 bg-success-soft p-4">
              <p className="text-caption font-semibold uppercase tracking-wide text-success-ink">Outcome</p>
              <p className="mt-1 whitespace-pre-wrap text-support text-ink-strong">{complaint.resolution}</p>
              {complaint.resolved_at && <p className="mt-2 text-caption text-ink-muted">Resolved {formatDate(complaint.resolved_at)}{complaint.resolved_by_name ? ` by ${complaint.resolved_by_name}` : ""}</p>}
            </div>
          )}
        </Card>
        <Card title="Details">
          <SummaryList items={[
            ...(viewer.is_staff ? [{ label: "Filed by", value: `${complaint.complainant_name} (${complaint.complainant_number})` }] : []),
            { label: "About", value: complaint.respondent_name || "Not a specific person" },
            { label: "When", value: complaint.incident_date ? formatDate(complaint.incident_date) : "Not given" },
            { label: "Where", value: complaint.incident_location || "Not given" },
            { label: "Filed on", value: formatDate(complaint.created_at) },
            { label: "Handled by", value: complaint.assigned_to_name || "Not yet assigned" },
          ]} />
          {viewer.can_withdraw && <Button variant="ghost" className="mt-4 text-danger-ink" leadingIcon={<Undo2 className="h-4 w-4" />} onClick={() => open("withdraw")}>Withdraw complaint</Button>}
        </Card>
      </div>

      <Card title={viewer.is_staff ? "Notes and messages" : "Messages with HR"} icon={MessageSquare}>
        {complaint.notes.length === 0 ? <p className="text-support text-ink-muted">No messages yet.</p> : (
          <ol className="space-y-3">
            {complaint.notes.map((item) => (
              <li key={item.id} className={cx("rounded-lg border p-3", item.is_internal ? "border-warning/25 bg-warning-soft" : item.from_hr ? "border-line bg-surface-muted" : "border-primary/25 bg-primary-soft")}>
                <div className="flex flex-wrap items-center gap-2 text-caption text-ink-muted">
                  <span className="font-semibold text-ink-strong">{item.from_hr ? item.author_name || "HR" : viewer.is_complainant ? "You" : item.author_name}</span>
                  <span>{formatDateTime(item.created_at)}</span>
                  {item.is_internal && <Badge size="sm" tone="warning">Internal · HR only</Badge>}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-support text-ink">{item.body}</p>
              </li>
            ))}
          </ol>
        )}
        {viewer.can_message && (
          <div className="mt-4 space-y-2">
            <Field label={viewer.is_staff && internal ? "Internal note" : viewer.is_staff ? "Message to the employee" : "Message to HR"} hideLabel>
              <Textarea rows={3} value={note} placeholder={viewer.is_staff ? (internal ? "Only HR sees this note…" : "The employee will see this message…") : "Add information or ask HR a question…"} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              {viewer.is_staff ? <Checkbox label="Internal note (HR only)" checked={internal} onChange={(event) => setInternal(event.target.checked)} /> : <span />}
              <Button leadingIcon={<Send className="h-4 w-4" />} loading={saving} disabled={!note.trim()} onClick={() => void sendNote()}>{viewer.is_staff && internal ? "Add note" : "Send"}</Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "resolve" ? "Resolve complaint" : dialog === "reopen" ? "Reopen complaint" : dialog === "withdraw" ? "Withdraw complaint" : "Assign complaint"}
        description={dialog === "resolve" ? "The employee is notified and sees the outcome you record." : dialog === "reopen" ? "The complaint goes back to investigation." : dialog === "withdraw" ? "HR stops working on it. You can file a new complaint later." : "Choose the HR handler. People named in the complaint are not listed."}
        footer={<>
          <Button variant="secondary" onClick={() => setDialog(null)} disabled={saving}>Cancel</Button>
          <Button
            loading={saving}
            variant={dialog === "withdraw" ? "danger" : "primary"}
            leadingIcon={dialog === "withdraw" ? <XCircle className="h-4 w-4" /> : undefined}
            onClick={() => void (dialog === "resolve" ? run(() => complaintsApi.resolve(id, dialogText), "Complaint resolved; the employee was notified.")
              : dialog === "reopen" ? run(() => complaintsApi.reopen(id, dialogText), "Complaint reopened.")
              : dialog === "withdraw" ? run(() => complaintsApi.withdraw(id, dialogText), "Complaint withdrawn.")
              : run(() => complaintsApi.assign(id, assignee), "Complaint assigned."))}
          >
            {dialog === "resolve" ? "Resolve" : dialog === "reopen" ? "Reopen" : dialog === "withdraw" ? "Withdraw" : "Assign"}
          </Button>
        </>}
      >
        {actionError && <Alert tone="danger" className="mb-3">{actionError}</Alert>}
        {dialog === "assign" ? (
          <Field label="Handler" required>
            <Select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
              <option value="">Choose…</option>
              {(handlers ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label={dialog === "resolve" ? "Outcome and action taken" : dialog === "reopen" ? "Why it is reopened" : "Reason"} required={dialog !== "withdraw"} optional={dialog === "withdraw"}>
            <Textarea rows={4} value={dialogText} onChange={(event) => setDialogText(event.target.value)} data-autofocus />
          </Field>
        )}
      </Dialog>
    </div>
  );
}
