"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, MessageSquareWarning, Plus, X } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, FileInput, Input, Select, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { complaintsApi, getApiErrorMessage } from "@/lib/api";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_TONES,
  type Colleague,
  type ComplaintCategory,
  type ComplaintSummary,
} from "@/lib/api/complaints";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

type Form = { category: ComplaintCategory | ""; subject: string; description: string; incident_date: string; incident_location: string; respondent_description: string };
const emptyForm: Form = { category: "", subject: "", description: "", incident_date: "", incident_location: "", respondent_description: "" };
const today = () => new Date().toISOString().slice(0, 10);

/** The signed-in employee's complaints, and the form to file a new one. */
export default function MyComplaintsPage() {
  const router = useRouter();
  const load = useCallback(() => complaintsApi.listComplaints({ mine: "1" }), []);
  const { data, loading, error, reload } = useApiResource(load);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [respondent, setRespondent] = useState<Colleague | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Colleague[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || respondent || query.trim().length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      complaintsApi.searchColleagues(query.trim()).then((rows) => { if (active) setMatches(rows); }).catch(() => { if (active) setMatches([]); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, query, respondent]);

  const start = () => { setForm(emptyForm); setRespondent(null); setQuery(""); setMatches([]); setFiles([]); setFormError(""); setOpen(true); };
  const submit = async () => {
    if (!form.category || !form.subject.trim() || !form.description.trim()) { setFormError("Choose a category, give a subject and describe what happened."); return; }
    setSaving(true);
    setFormError("");
    try {
      const complaint = await complaintsApi.fileComplaint({
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
        incident_date: form.incident_date || null,
        incident_location: form.incident_location.trim(),
        respondent: respondent?.id ?? null,
        respondent_description: respondent ? "" : form.respondent_description.trim(),
      });
      // Files go up once the complaint exists; any that fail can be attached again from the complaint page.
      for (const item of files) {
        try { await complaintsApi.uploadAttachment(complaint.id, item); } catch { /* shown as missing on the complaint page */ }
      }
      setOpen(false);
      reload();
      router.push(`/complaints/${complaint.id}`);
    } catch (caught) { setFormError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="My complaints" description="Raise a concern about something at work and follow it with HR." icon={MessageSquareWarning} accent="hr" actions={<Button leadingIcon={<Plus className="h-4 w-4" />} onClick={start}>File a complaint</Button>} />
      <Alert tone="info" title="Confidential">Only HR staff who handle complaints see what you file. The person it is about and your manager do not.</Alert>

      <DataTable<ComplaintSummary>
        caption="My complaints"
        rows={data?.results ?? []}
        rowKey={(row) => row.id}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        minWidth={640}
        onRowClick={(row) => router.push(`/complaints/${row.id}`)}
        empty={{ title: "You have not filed any complaints", description: "If something at work concerns you, file a complaint and HR will follow it up.", icon: MessageSquareWarning, action: <Button variant="secondary" leadingIcon={<Plus className="h-4 w-4" />} onClick={start}>File a complaint</Button> }}
        columns={[
          { key: "subject", header: "Complaint", cell: (row) => <span><Link href={`/complaints/${row.id}`} className="block font-semibold text-ink-strong hover:underline">{row.subject}</Link><span className="text-caption text-ink-muted">{row.code} · {row.category_label}</span></span> },
          { key: "filed", header: "Filed", sortValue: (row) => row.created_at, cell: (row) => formatDate(row.created_at) },
          { key: "handler", header: "Handled by", hideBelow: "md", cell: (row) => row.assigned_to_name || <span className="text-ink-subtle">Waiting for HR</span> },
          { key: "status", header: "Status", cell: (row) => <Badge size="sm" tone={COMPLAINT_STATUS_TONES[row.status]}>{COMPLAINT_STATUS_LABELS[row.status]}</Badge> },
        ]}
      />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        icon={<Lock className="h-5 w-5" />}
        title="File a complaint"
        description="Be as specific as you can: what happened, when, where and who was involved."
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button loading={saving} onClick={() => void submit()}>Submit complaint</Button></>}
      >
        <div className="space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Category" required>
            <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ComplaintCategory })}>
              <option value="">Choose…</option>
              {(Object.keys(COMPLAINT_CATEGORY_LABELS) as ComplaintCategory[]).map((value) => <option key={value} value={value}>{COMPLAINT_CATEGORY_LABELS[value]}</option>)}
            </Select>
          </Field>
          <Field label="Subject" required><Input value={form.subject} maxLength={200} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="A short summary" /></Field>
          <Field label="What happened" required><Textarea rows={6} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="When did it happen" optional><Input type="date" max={today()} value={form.incident_date} onChange={(event) => setForm({ ...form, incident_date: event.target.value })} /></Field>
            <Field label="Where" optional><Input value={form.incident_location} maxLength={200} onChange={(event) => setForm({ ...form, incident_location: event.target.value })} placeholder="Office, site, online…" /></Field>
          </div>
          <Field label="Supporting files" optional helper="Photos, screenshots, letters or other evidence. Only HR handlers can open them.">
            <FileInput multiple fileName={files.length ? files.map((item) => item.name).join(", ") : null} hint="Up to 25 MB each" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          </Field>
          <Field label="Who is it about" optional helper="Search for a colleague, or describe the person if they are not an employee. Leave empty if it is not about a person.">
            {respondent ? (
              <div className="flex items-center justify-between rounded-lg border border-line bg-surface-muted px-3 py-2">
                <span><span className="font-semibold text-ink-strong">{respondent.name}</span> <span className="text-caption text-ink-muted">{respondent.employee_number}{respondent.department ? ` · ${respondent.department}` : ""}</span></span>
                <IconButton size="sm" label="Remove" onClick={() => { setRespondent(null); setQuery(""); }}><X className="h-4 w-4" /></IconButton>
              </div>
            ) : (
              <div className="space-y-2">
                <Input value={query} onChange={(event) => { setQuery(event.target.value); setForm({ ...form, respondent_description: event.target.value }); if (event.target.value.trim().length < 2) setMatches([]); }} placeholder="Type a name or staff number…" />
                {matches.length > 0 && (
                  <ul className="max-h-48 overflow-y-auto rounded-lg border border-line">
                    {matches.map((item) => (
                      <li key={item.id}>
                        <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-support hover:bg-surface-hover" onClick={() => { setRespondent(item); setMatches([]); }}>
                          <span className="font-medium text-ink-strong">{item.name}</span>
                          <span className="text-caption text-ink-muted">{item.employee_number}{item.department ? ` · ${item.department}` : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
