"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { FileArchive, ShieldAlert } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, MetricCard } from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Input } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { getApiErrorMessage, securityApi } from "@/lib/api";
import { saveBlob } from "@/lib/api/policies";
import { CHECK_TONES } from "@/lib/api/security";
import { formatDateTime, toISODate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const STATUS_LABELS = { CRITICAL: "Act now", WARNING: "Review", INFO: "For information", OK: "OK" } as const;

/** Security overview for administrators and auditors, and the compliance evidence pack. */
export default function SecurityPage() {
  const load = useCallback(() => securityApi.getSecurityOverview(), []);
  const { data, error, reload, loading } = useApiResource(load);
  const today = new Date();
  const [from, setFrom] = useState(toISODate(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())));
  const [to, setTo] = useState(toISODate(today));
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState("");

  const exportPack = async () => {
    setBusy(true); setExportError("");
    try { await saveBlob(await securityApi.downloadEvidence(from, to), `ergonx-evidence-${from}-${to}.zip`); }
    catch (caught) { setExportError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader eyebrow="Compliance" title="Security" icon={ShieldAlert} accent="audit" actions={<Button variant="secondary" onClick={reload} loading={loading}>Refresh</Button>} />
      {error && <ErrorState variant="inline" title="Unable to load security checks" message={error} onRetry={reload} />}
      {data && (
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Security summary">
          <MetricCard label="Act now" value={String(data.score.critical)} description="Critical findings" icon={ShieldAlert} accent="audit" />
          <MetricCard label="Review" value={String(data.score.warning)} description="Warnings to look at" icon={ShieldAlert} accent="payroll" />
          <MetricCard label="Checked" value={formatDateTime(data.generated_at)} description={`${data.checks.length} checks`} icon={ShieldAlert} accent="attendance" />
        </section>
      )}
      {data && (
        <Card title="Checks" icon={ShieldAlert} accent="audit">
          <ul className="divide-y divide-line-soft">
            {data.checks.map((check) => (
              <li key={check.code} className="py-3">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{check.title}<Badge size="sm" tone={CHECK_TONES[check.status]}>{STATUS_LABELS[check.status]}</Badge>{check.route && check.status !== "OK" && <Link href={check.route} className="text-caption font-semibold text-primary-ink hover:underline">Fix</Link>}</p>
                <p className="text-support text-ink">{check.detail}</p>
                {check.items.length > 0 && check.status !== "OK" && (
                  <ul className="mt-1 text-caption text-ink-muted">
                    {check.items.slice(0, 8).map((item, index) => <li key={index}>{Object.values(item).filter((value) => value !== null && value !== "").join(" · ")}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Evidence pack" description="Users, roles and MFA; the audit trail for the period; retention, data requests, policy sign-off and restore tests, as CSV files in a ZIP." icon={FileArchive} accent="settings">
          {exportError && <Alert tone="danger">{exportError}</Alert>}
          <div className="flex flex-wrap items-end gap-3">
            <Field label="From"><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
            <Field label="To"><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
            <Button loading={busy} leadingIcon={<FileArchive className="h-4 w-4" />} onClick={() => void exportPack()}>Download</Button>
          </div>
          <p className="mt-2 text-caption text-ink-muted">Downloading is recorded in the audit trail.</p>
        </Card>
        <Card title="Recent security events" icon={ShieldAlert} accent="audit">
          {data?.events.length ? (
            <ul className="max-h-80 divide-y divide-line-soft overflow-y-auto">
              {data.events.map((event, index) => (
                <li key={index} className="flex justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium text-ink-strong">{event.action}</span><span className="block truncate text-caption text-ink-muted">{event.actor}{event.ip_address ? ` · ${event.ip_address}` : ""}</span></span>
                  <span className="shrink-0 text-caption text-ink-muted">{formatDateTime(event.at)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-support text-ink-muted">No security events yet.</p>}
        </Card>
      </div>
    </div>
  );
}
