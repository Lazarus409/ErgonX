"use client";

import { useCallback, useState } from "react";
import { BadgeCheck, Download, FileSignature, ScrollText } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, MetricCard } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { getApiErrorMessage, policiesApi } from "@/lib/api";
import { ACKNOWLEDGEMENT_STATUS_LABELS, ACKNOWLEDGEMENT_STATUS_TONES, saveBlob, type MyPolicy } from "@/lib/api/policies";
import { formatDate, formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

/** The workplace policies that apply to the signed-in employee: read, download and sign. */
export default function MyPoliciesPage() {
  const { showToast } = useToast();
  const load = useCallback(() => policiesApi.getMyPolicies(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const [open, setOpen] = useState<MyPolicy | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const policies = data?.policies ?? [];
  const summary = data?.summary;
  const outstanding = (summary?.pending ?? 0) + (summary?.overdue ?? 0);

  const read = async (policy: MyPolicy) => {
    setOpening(policy.id);
    try {
      setOpen(await policiesApi.getMyPolicy(policy.id));
      setConfirmed(false);
      setSignedName("");
      setFormError("");
    } catch (caught) {
      showToast({ tone: "error", message: getApiErrorMessage(caught) });
    } finally {
      setOpening(null);
    }
  };

  const download = async (policy: MyPolicy) => {
    if (!policy.document) return;
    try { await saveBlob(await policiesApi.downloadMyPolicyFile(policy.id), policy.document.original_filename); }
    catch (caught) { showToast({ tone: "error", message: getApiErrorMessage(caught) }); }
  };

  const acknowledge = async () => {
    if (!open) return;
    if (!confirmed) { setFormError("Tick the box to confirm you have read and understood the policy."); return; }
    if (!signedName.trim()) { setFormError("Type your full name to sign."); return; }
    setSaving(true);
    setFormError("");
    try {
      const updated = await policiesApi.acknowledgePolicy(open.id, signedName.trim());
      setOpen(updated);
      reload();
      showToast({ tone: "success", message: `${updated.title} acknowledged.` });
    } catch (caught) {
      setFormError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const needsSignature = open && (open.status === "PENDING" || open.status === "OVERDUE");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Self service"
        title="My policies"
        description="Workplace policies that apply to you. Read each one and sign to confirm you understand it."
        icon={ScrollText}
        accent="hr"
      />

      {error && <ErrorState variant="inline" title="Unable to load your policies" message={error} onRetry={reload} />}

      {summary && summary.applicable > 0 && (
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Policy summary">
          <MetricCard label="To acknowledge" value={String(outstanding)} description={summary.overdue ? `${summary.overdue} overdue` : "Waiting for your signature"} icon={FileSignature} accent="audit" />
          <MetricCard label="Acknowledged" value={`${summary.acknowledged} of ${summary.applicable}`} description="Current versions signed" icon={BadgeCheck} accent="attendance" />
          <MetricCard label="Completion" value={`${summary.rate.toFixed(0)}%`} description="Of policies that need a signature" icon={ScrollText} accent="hr" />
        </section>
      )}

      {loading && !data ? (
        <div className="space-y-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-20 w-full" />)}</div>
      ) : policies.length === 0 && !error ? (
        <EmptyState title="No policies yet" description="When HR publishes a policy that applies to you, it appears here." icon={ScrollText} />
      ) : (
        <Card title="Policies" icon={ScrollText} accent="hr">
          <ul className="divide-y divide-line-soft">
            {policies.map((policy) => (
              <li key={policy.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">
                    {policy.title}
                    <Badge size="sm" tone={ACKNOWLEDGEMENT_STATUS_TONES[policy.status]}>{ACKNOWLEDGEMENT_STATUS_LABELS[policy.status]}</Badge>
                    {policy.version > 1 && <Badge size="sm">Version {policy.version}</Badge>}
                  </p>
                  <p className="mt-0.5 text-caption text-ink-muted">
                    {policy.category_label}
                    {policy.acknowledgement ? ` · signed ${formatDate(policy.acknowledgement.acknowledged_at)}` : policy.requires_acknowledgement ? ` · sign by ${formatDate(policy.due_date)}` : ""}
                  </p>
                  {policy.summary && <p className="mt-1 text-support text-ink">{policy.summary}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {policy.document && <Button size="sm" variant="ghost" leadingIcon={<Download className="h-4 w-4" />} onClick={() => void download(policy)}>Download</Button>}
                  <Button size="sm" variant={policy.status === "PENDING" || policy.status === "OVERDUE" ? "primary" : "secondary"} loading={opening === policy.id} onClick={() => void read(policy)}>
                    {policy.status === "PENDING" || policy.status === "OVERDUE" ? "Read and sign" : "Read"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        dismissible={!saving}
        size="lg"
        title={open ? `${open.title}${open.version > 1 ? ` (version ${open.version})` : ""}` : "Policy"}
        description={open?.published_at ? `${open.category_label} · published ${formatDate(open.published_at)}` : undefined}
        footer={needsSignature
          ? <><Button variant="secondary" onClick={() => setOpen(null)} disabled={saving}>Close</Button><Button onClick={() => void acknowledge()} loading={saving} leadingIcon={<FileSignature className="h-4 w-4" />}>Sign and acknowledge</Button></>
          : <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>}
      >
        {open && (
          <div className="space-y-4">
            {open.change_summary && open.version > 1 && <Alert tone="info" title="What changed in this version">{open.change_summary}</Alert>}
            {open.summary && <p className="text-support font-medium text-ink-strong">{open.summary}</p>}
            {open.body && <div className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-line-soft bg-surface-muted p-4 text-sm leading-relaxed text-ink">{open.body}</div>}
            {open.document && (
              <Button variant="secondary" size="sm" leadingIcon={<Download className="h-4 w-4" />} onClick={() => void download(open)}>
                Download {open.document.original_filename}
              </Button>
            )}
            {open.acknowledgement && (
              <Alert tone="success" title="Acknowledged">Signed as “{open.acknowledgement.signed_name}” on {formatDateTime(open.acknowledgement.acknowledged_at)}.</Alert>
            )}
            {needsSignature && (
              <div className="space-y-3 border-t border-line-soft pt-4">
                {formError && <Alert tone="danger">{formError}</Alert>}
                <Checkbox label="I have read and understood this policy and agree to follow it." checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                <Field label="Type your full name to sign" required helper="Your signature, the date and time are recorded with your acknowledgement.">
                  <Input value={signedName} onChange={(event) => setSignedName(event.target.value)} autoComplete="name" maxLength={200} />
                </Field>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
