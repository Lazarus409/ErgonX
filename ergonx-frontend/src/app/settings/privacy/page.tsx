"use client";

import { useCallback, useState } from "react";
import { ShieldCheck } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select, Textarea } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import { getApiErrorMessage, privacyApi } from "@/lib/api";
import { DSR_STATUS_TONES, DSR_TYPE_LABELS, type DsrType } from "@/lib/api/privacy";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const EXPLAIN: Record<DsrType, string> = {
  ACCESS: "HR sends you a copy of the personal data ErgonX holds about you.",
  RECTIFICATION: "Tell HR what is wrong and what it should say. You can correct your contact details yourself under My Profile.",
  ERASURE: "Ask for data to be deleted. Some records (pay, tax, pension, employment history) must be kept by law; HR will explain anything they keep.",
  OBJECTION: "Object to a particular use of your data. Explain which use and why.",
};

/** The signed-in employee's data protection rights: make a request and follow it. */
export default function MyPrivacyPage() {
  const { showToast } = useToast();
  const load = useCallback(() => privacyApi.myRequests(), []);
  const { data, error, reload } = useApiResource(load);
  const [type, setType] = useState<DsrType>("ACCESS");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const submit = async () => {
    if (type !== "ACCESS" && !details.trim()) { setFormError("Explain what you are asking for."); return; }
    setBusy(true); setFormError("");
    try { await privacyApi.makeMyRequest(type, details.trim()); setDetails(""); showToast({ tone: "success", message: "Request sent to HR." }); reload(); }
    catch (caught) { setFormError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Settings" title="My data & privacy" description="Under Ghana's Data Protection Act, 2012 you can ask for a copy of your personal data, have it corrected, or object to how it is used. HR responds within 30 days." icon={ShieldCheck} accent="settings" />
      {error && <Alert tone="warning">{error}</Alert>}
      <Card title="Make a request" icon={ShieldCheck} accent="settings">
        <div className="space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="What would you like?" helper={EXPLAIN[type]}><Select value={type} onChange={(event) => setType(event.target.value as DsrType)}>{Object.entries(DSR_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          <Field label="Details" optional={type === "ACCESS"} required={type !== "ACCESS"}><Textarea rows={3} maxLength={4000} value={details} onChange={(event) => setDetails(event.target.value)} /></Field>
          <div className="flex justify-end"><Button loading={busy} onClick={() => void submit()}>Send request</Button></div>
        </div>
      </Card>
      {data && data.requests.length > 0 && (
        <Card title="Your requests" icon={ShieldCheck} accent="settings">
          <ul className="divide-y divide-line-soft">
            {data.requests.map((row) => (
              <li key={row.id} className="py-3">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{row.type_label}<Badge size="sm" tone={DSR_STATUS_TONES[row.status]}>{row.status_label}</Badge></p>
                <p className="text-caption text-ink-muted">Sent {formatDate(row.received_at)} · HR responds by {formatDate(row.due_on)}</p>
                {row.outcome && <p className="mt-1 text-support text-ink">{row.outcome}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
