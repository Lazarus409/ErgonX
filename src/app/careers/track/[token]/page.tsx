"use client";

import { useCallback, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarClock, FileText, Upload } from "lucide-react";

import CareersShell from "@/components/careers/CareersShell";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { careersApi, getApiErrorMessage } from "@/lib/api";
import { CANDIDATE_DOCUMENT_TYPES, type TrackingView } from "@/lib/api/careers";
import { formatDate, formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const TONES: Record<TrackingView["status"], "info" | "success" | "warning" | "neutral"> = {
  RECEIVED: "info", IN_REVIEW: "info", INTERVIEW: "warning", OFFER: "success", HIRED: "success", CLOSED: "neutral", WITHDRAWN: "neutral",
};

/** A candidate's private view of one application, opened from their tracking link. No sign-in. */
export default function TrackApplicationPage() {
  const { token } = useParams<{ token: string }>();
  const load = useCallback(() => careersApi.getTracking(token), [token]);
  const { data, error, setData } = useApiResource(load);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [category, setCategory] = useState("CERTIFICATE");
  const fileInput = useRef<HTMLInputElement>(null);

  const run = async (work: () => Promise<TrackingView>) => {
    setBusy(true); setActionError("");
    try { const next = await work(); setData(() => next); }
    catch (caught) { setActionError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  return (
    <CareersShell organisation={data?.organisation}>
      {error && <Alert tone="warning" title="Link not recognised">This tracking link is invalid or has expired. Use the latest link from your confirmation, or contact the employer.</Alert>}
      {data && (
        <>
          <header>
            <p className="text-caption font-semibold uppercase tracking-[0.08em] text-ink-muted">Your application</p>
            <h1 className="mt-1 text-page-title font-bold text-ink-strong">{data.job.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-support text-ink-muted"><Badge tone={TONES[data.status]}>{data.status_label}</Badge>{data.applied_at && <span>Applied {formatDate(data.applied_at)}</span>}</p>
          </header>
          {actionError && <Alert tone="danger" onDismiss={() => setActionError("")}>{actionError}</Alert>}

          {data.interviews.length > 0 && (
            <Card title="Interviews" icon={CalendarClock} accent="recruitment">
              <ul className="divide-y divide-line-soft">
                {data.interviews.map((interview) => (
                  <li key={interview.id} className="space-y-2 py-3">
                    <p className="font-semibold text-ink-strong">{formatDateTime(interview.scheduled_at)}{interview.time_zone ? ` (${interview.time_zone})` : ""} · {interview.duration_minutes} min{interview.mode ? ` · ${interview.mode}` : ""}</p>
                    {interview.where && <p className="text-support text-ink break-all">{interview.where}</p>}
                    {interview.message && <p className="whitespace-pre-line text-support text-ink">{interview.message}</p>}
                    {interview.response ? <Badge tone={interview.response === "ACCEPTED" ? "success" : "neutral"}>{interview.response === "ACCEPTED" ? "You confirmed" : "You declined"}</Badge> : (
                      <div className="flex gap-2">
                        <Button size="sm" loading={busy} onClick={() => void run(() => careersApi.respondToInterview(token, interview.id, "ACCEPT"))}>Confirm</Button>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => { const note = window.prompt("Let them know why, or suggest another time (optional):") ?? ""; void run(() => careersApi.respondToInterview(token, interview.id, "DECLINE", note)); }}>Can&apos;t make it</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Your documents" icon={FileText} accent="recruitment">
            <ul className="divide-y divide-line-soft">
              {data.documents.map((document) => <li key={document.id} className="flex justify-between gap-2 py-2 text-sm"><span className="truncate">{document.name}</span><span className="text-caption text-ink-muted">{CANDIDATE_DOCUMENT_TYPES[document.category] ?? document.category} · {formatDate(document.uploaded_at)}</span></li>)}
            </ul>
            {data.can_upload && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select value={category} onChange={(event) => setCategory(event.target.value)} className="w-44">{Object.entries(CANDIDATE_DOCUMENT_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
                <input ref={fileInput} type="file" className="sr-only" accept=".pdf,.doc,.docx,.odt,.txt,.jpg,.jpeg,.png" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void run(() => careersApi.uploadTrackingDocument(token, file, category)); }} />
                <Button size="sm" variant="secondary" loading={busy} leadingIcon={<Upload className="h-4 w-4" />} onClick={() => fileInput.current?.click()}>Send a document</Button>
              </div>
            )}
          </Card>

          {data.can_withdraw && (
            <div className="flex justify-end">
              <Button variant="ghost" className="text-danger-ink" disabled={busy} onClick={() => window.confirm("Withdraw your application? This can't be undone.") && void run(() => careersApi.withdrawApplication(token))}>Withdraw application</Button>
            </div>
          )}
          <p className="text-caption text-ink-muted">Keep this link private: anyone with it can see this application.</p>
        </>
      )}
    </CareersShell>
  );
}
