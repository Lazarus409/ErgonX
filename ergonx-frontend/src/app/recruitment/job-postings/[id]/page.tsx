"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import BackNavigation from "@/components/ui/BackNavigation";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, recruitmentApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import { buttonClasses } from "@/components/ui/Button";

type Action = "publish" | "close" | "cancel" | null;

export default function JobPostingDetailPage() {
  const { id } = useParams<{ id: string }>(); const load = useCallback(() => recruitmentApi.getJobPosting(id), [id]); const { data, loading, error, reload } = useApiResource(load); const [action, setAction] = useState<Action>(null); const [saving, setSaving] = useState(false); const [actionError, setActionError] = useState<string | null>(null);
  const run = async () => { if (!action) return; setSaving(true); setActionError(null); try { if (action === "publish") await recruitmentApi.publishJobPosting(id); else await recruitmentApi.closeJobPosting(id, action === "cancel"); setAction(null); reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); setAction(null); } finally { setSaving(false); } };
  if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error ?? "Job posting not found."} onRetry={reload} />;
  const actions = data.status === "DRAFT" ? <button type="button" onClick={() => setAction("publish")} className={buttonClasses({ variant: "primary" })}>Publish</button> : data.status === "OPEN" ? <div className="flex gap-2"><button type="button" onClick={() => setAction("close")} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium">Close</button><button type="button" onClick={() => setAction("cancel")} className={buttonClasses({ variant: "danger" })}>Cancel</button></div> : undefined;
  return <div className="space-y-6"><PageHeader title={data.title} description={`${data.code} · ${data.employment_type.replaceAll("_", " ")}`} actions={actions} />{actionError && <ErrorState message={actionError} />}<div className="rounded-2xl border border-line bg-surface p-6"><div className="flex items-center justify-between"><h2 className="font-semibold">Posting details</h2><StatusBadge status={data.status} /></div><dl className="mt-6 grid gap-5 sm:grid-cols-2"><div><dt className="text-xs font-medium uppercase text-ink-muted">Openings</dt><dd className="mt-1 text-sm font-medium">{data.openings}</dd></div><div><dt className="text-xs font-medium uppercase text-ink-muted">Closing date</dt><dd className="mt-1 text-sm font-medium">{data.closes_on ?? "Not set"}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-medium uppercase text-ink-muted">Description</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{data.description || "No description provided."}</dd></div></dl></div><BackNavigation fallback="/recruitment/job-postings" label="Back to Job Postings" /><ConfirmDialog open={action !== null} title={action === "publish" ? "Publish job posting?" : action === "cancel" ? "Cancel job posting?" : "Close job posting?"} description={action === "publish" ? "This makes the posting open for applications." : "The backend will prevent further applications to this posting."} confirmLabel={action === "publish" ? "Publish" : action === "cancel" ? "Cancel Posting" : "Close Posting"} destructive={action === "cancel"} loading={saving} onConfirm={() => void run()} onCancel={() => setAction(null)} /></div>;
}
