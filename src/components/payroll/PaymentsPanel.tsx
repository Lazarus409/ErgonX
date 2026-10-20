"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Banknote, Download, Landmark, Smartphone } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";
import { getApiErrorMessage, payrollApi } from "@/lib/api";
import { saveBlob } from "@/lib/api/policies";
import { formatAmount } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { PaymentFileKey } from "@/types/payroll";

const METHOD_LABELS: Record<string, string> = { BANK: "Bank transfer", MOBILE_MONEY: "Mobile money", CASH: "Cash", CHEQUE: "Cheque", UNASSIGNED: "No payment details" };
const FILE_HELP: Record<PaymentFileKey, string> = {
  bank: "Upload to your bank's bulk-payment service.",
  "mobile-money": "Upload to your MoMo bulk-pay portal.",
  pension: "Tier 1 (SSNIT) and Tier 2 contributions per employee.",
  paye: "Tax withheld per employee, for the GRA monthly return.",
};

/** How a run's net pay is paid out, with the payment and statutory files once it is finalized. */
export default function PaymentsPanel({ runId, canDownload, canEditProfiles }: { runId: string; canDownload: boolean; canEditProfiles: boolean }) {
  const load = useCallback(() => payrollApi.getPaymentSummary(runId), [runId]);
  const { data, loading, error, reload } = useApiResource(load);
  const [busy, setBusy] = useState<PaymentFileKey | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (loading && !data) return <LoadingState label="Loading payments" />;
  if (error || !data) return <ErrorState title="Unable to load payments" message={error ?? "Payment summary unavailable."} onRetry={reload} />;

  const download = async (key: PaymentFileKey, label: string) => {
    setBusy(key); setDownloadError(null);
    try { await saveBlob(await payrollApi.downloadPaymentFile(runId, key), `${key}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`); }
    catch (caught) { setDownloadError(getApiErrorMessage(caught)); }
    finally { setBusy(null); }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-elevation-1" aria-labelledby="payments-heading">
      <div>
        <h2 id="payments-heading" className="flex items-center gap-2 text-card-title font-semibold text-ink-strong"><Banknote className="h-5 w-5 text-mod-payroll" aria-hidden="true" />Payments</h2>
        <p className="mt-1 text-support text-ink-muted">Net pay by payment method. Files come from the finalized figures, never from current salaries.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.methods.map((bucket) => (
          <div key={bucket.method} className="rounded-xl border border-line-soft bg-surface-muted p-4">
            <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {bucket.method === "BANK" ? <Landmark className="h-3.5 w-3.5" aria-hidden="true" /> : bucket.method === "MOBILE_MONEY" ? <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              {METHOD_LABELS[bucket.method] ?? bucket.method}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink-strong">{formatAmount(bucket.net_pay, data.currency)}</p>
            <p className="text-caption text-ink-muted">{bucket.employees} employee{bucket.employees === 1 ? "" : "s"}</p>
          </div>
        ))}
      </div>

      {data.needs_attention.length > 0 && (
        <Alert tone="warning" title={`${data.needs_attention.length} employee${data.needs_attention.length === 1 ? "" : "s"} can't be paid by transfer`}
          actions={canEditProfiles ? <Link href="/payroll/employee-profiles" className="text-sm font-semibold underline">Update payment details</Link> : undefined}>
          <ul className="mt-1 space-y-0.5">
            {data.needs_attention.slice(0, 8).map((row) => <li key={row.employee_id}>{row.employee_number} {row.employee_name}: {row.problem} ({formatAmount(row.net_pay, data.currency)})</li>)}
            {data.needs_attention.length > 8 && <li>…and {data.needs_attention.length - 8} more</li>}
          </ul>
        </Alert>
      )}

      {downloadError && <Alert tone="danger" onDismiss={() => setDownloadError(null)}>{downloadError}</Alert>}
      {!data.ready ? (
        <p className="text-support text-ink-muted">Payment and statutory files are available once the run is finalized.</p>
      ) : !canDownload ? (
        <p className="text-support text-ink-muted">People who can finalize payroll can download the payment files.</p>
      ) : (
        <ul className="divide-y divide-line-soft rounded-xl border border-line-soft">
          {data.files.map((file) => (
            <li key={file.key} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1"><p className="font-semibold text-ink-strong">{file.label}</p><p className="text-caption text-ink-muted">{FILE_HELP[file.key]}</p></div>
              {file.key === "bank" || file.key === "mobile-money" ? <Badge size="sm" tone="neutral">CSV</Badge> : <Badge size="sm" tone="neutral">Schedule · CSV</Badge>}
              <Button size="sm" variant="secondary" leadingIcon={<Download className="h-4 w-4" />} loading={busy === file.key} onClick={() => void download(file.key, file.label)}>Download</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
