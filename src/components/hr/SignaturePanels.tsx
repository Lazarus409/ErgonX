"use client";

import { useCallback, useState } from "react";
import { Download, FileSignature, Send } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import { getApiErrorMessage, signaturesApi } from "@/lib/api";
import { saveBlob } from "@/lib/api/policies";
import { SIGNATURE_STATUS_TONES, type SignatureRequest } from "@/lib/api/signatures";
import { formatDate, formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

/** The signed-in employee's documents to sign, and those they have signed. Hidden when there are none. */
export function MySignaturesPanel() {
  const load = useCallback(() => signaturesApi.listMySignatureRequests(), []);
  const { data, reload } = useApiResource(load);
  const [signing, setSigning] = useState<SignatureRequest | null>(null);
  const [declining, setDeclining] = useState<SignatureRequest | null>(null);
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const pending = rows.filter((row) => row.status === "PENDING");

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await work(); setSigning(null); setDeclining(null); reload(); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };
  const download = (row: SignatureRequest, record = false) =>
    void (record ? signaturesApi.downloadMySignatureRecord(row.id) : signaturesApi.downloadMySignatureDocument(row.id))
      .then((blob) => saveBlob(blob, record ? `signature-record-${row.title}.txt` : row.document_name))
      .catch((caught) => setError(getApiErrorMessage(caught)));

  return (
    <Card title="Documents to sign" icon={FileSignature} accent="hr" actions={pending.length ? <Badge tone="warning">{pending.length} waiting</Badge> : undefined}>
      {error && !signing && !declining && <Alert tone="danger" onDismiss={() => setError("")}>{error}</Alert>}
      <ul className="divide-y divide-line-soft">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{row.title}<Badge size="sm" tone={SIGNATURE_STATUS_TONES[row.status]}>{row.status_label}</Badge></span>
              <span className="block text-caption text-ink-muted">{row.document_name} · from {row.requested_by_name || "HR"}{row.due_date && row.status === "PENDING" ? ` · sign by ${formatDate(row.due_date)}` : ""}{row.signed_at ? ` · signed ${formatDateTime(row.signed_at)}` : ""}</span>
              {row.message && row.status === "PENDING" && <span className="mt-1 block text-support text-ink">{row.message}</span>}
            </span>
            <span className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" variant="ghost" leadingIcon={<Download className="h-4 w-4" />} onClick={() => download(row)}>Read</Button>
              {row.status === "PENDING" && <><Button size="sm" onClick={() => { setSigning(row); setName(""); setConfirmed(false); setError(""); }}>Sign</Button><Button size="sm" variant="secondary" onClick={() => { setDeclining(row); setReason(""); setError(""); }}>Decline</Button></>}
              {row.status === "SIGNED" && <Button size="sm" variant="ghost" onClick={() => download(row, true)}>Signature record</Button>}
            </span>
          </li>
        ))}
      </ul>

      <Dialog open={signing !== null} onClose={() => setSigning(null)} dismissible={!busy} title={signing ? `Sign: ${signing.title}` : "Sign"} description="Your typed name is your signature. The date, time, your IP address and browser are recorded with it."
        footer={<><Button variant="secondary" onClick={() => setSigning(null)} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!confirmed || !name.trim()} leadingIcon={<FileSignature className="h-4 w-4" />} onClick={() => signing && void run(() => signaturesApi.signDocument(signing.id, name.trim()))}>Sign document</Button></>}>
        {signing && (
          <div className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button size="sm" variant="secondary" leadingIcon={<Download className="h-4 w-4" />} onClick={() => download(signing)}>Download {signing.document_name}</Button>
            <Checkbox label="I have read this document and agree to sign it." checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <Field label="Type your full name" required><Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={200} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog open={declining !== null} onClose={() => setDeclining(null)} dismissible={!busy} title={declining ? `Decline: ${declining.title}` : "Decline"} description="HR will see your reason and can send a corrected document."
        footer={<><Button variant="secondary" onClick={() => setDeclining(null)} disabled={busy}>Back</Button><Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={() => declining && void run(() => signaturesApi.declineSignature(declining.id, reason.trim()))}>Decline</Button></>}>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Reason" required><Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. The start date is wrong" /></Field>
      </Dialog>
    </Card>
  );
}

/** HR: signature requests for one employee, and sending one of their documents for signature. */
export function EmployeeSignaturesPanel({ employeeId, documents, canSend }: { employeeId: string; documents: { id: string; original_filename: string; category?: string }[]; canSend: boolean }) {
  const load = useCallback(() => signaturesApi.listSignatureRequests({ employee: employeeId }), [employeeId]);
  const { data, reload } = useApiResource(load);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ document: "", title: "", message: "", due_date: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rows = data?.results ?? [];
  if (!canSend && rows.length === 0) return null;

  const send = async () => {
    setBusy(true); setError("");
    try {
      await signaturesApi.requestSignature({ document: form.document, employee: employeeId, title: form.title.trim(), message: form.message.trim(), due_date: form.due_date || null });
      setSending(false);
      reload();
    } catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Signatures" icon={FileSignature} accent="hr"
      actions={canSend && documents.length > 0 ? <Button size="sm" variant="secondary" leadingIcon={<Send className="h-4 w-4" />} onClick={() => { setForm({ document: documents[0]?.id ?? "", title: "", message: "", due_date: "" }); setError(""); setSending(true); }}>Send for signature</Button> : undefined}>
      {error && !sending && <Alert tone="danger" onDismiss={() => setError("")}>{error}</Alert>}
      {rows.length === 0 ? <p className="text-support text-ink-muted">Nothing sent for signature yet. Upload the document to this record, then send it.</p> : (
        <ul className="divide-y divide-line-soft">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{row.title}<Badge size="sm" tone={SIGNATURE_STATUS_TONES[row.status]}>{row.status_label}</Badge></span>
                <span className="block text-caption text-ink-muted">{row.document_name} · sent {formatDate(row.created_at)}{row.signed_at ? ` · signed as “${row.signed_name}” ${formatDateTime(row.signed_at)}` : ""}{row.decline_reason ? ` · declined: ${row.decline_reason}` : ""}</span>
              </span>
              <span className="flex shrink-0 gap-2">
                {row.status !== "CANCELLED" && <Button size="sm" variant="ghost" onClick={() => void signaturesApi.downloadSignatureRecord(row.id).then((blob) => saveBlob(blob, `signature-record-${row.title}.txt`)).catch((caught) => setError(getApiErrorMessage(caught)))}>Record</Button>}
                {canSend && row.status === "PENDING" && <Button size="sm" variant="ghost" onClick={() => void signaturesApi.cancelSignatureRequest(row.id).then(reload).catch((caught) => setError(getApiErrorMessage(caught)))}>Cancel</Button>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={sending} onClose={() => setSending(false)} dismissible={!busy} title="Send for signature" description="The employee reads and signs it in ErgonX. If the file is replaced afterwards, the request can no longer be signed."
        footer={<><Button variant="secondary" onClick={() => setSending(false)} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!form.document} onClick={() => void send()}>Send</Button></>}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Document" required>
            <Select value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value })}>
              {documents.map((document) => <option key={document.id} value={document.id}>{document.original_filename}{document.category ? ` (${document.category})` : ""}</option>)}
            </Select>
          </Field>
          <Field label="Title" optional><Input value={form.title} maxLength={150} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Employment contract" /></Field>
          <Field label="Message" optional><Textarea rows={2} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></Field>
          <Field label="Sign by" optional><Input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></Field>
        </div>
      </Dialog>
    </Card>
  );
}
