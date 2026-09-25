"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import BackNavigation from "@/components/ui/BackNavigation";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, recruitmentApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import { buttonClasses } from "@/components/ui/Button";

type ConfirmedAction = "submit" | "move" | "withdraw" | null;

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(
    () =>
      Promise.all([
        recruitmentApi.getApplication(id),
        recruitmentApi.getApplicationStageHistory(id),
        recruitmentApi.getPipeline(),
      ]),
    [id],
  );
  const { data, loading, error, reload } = useApiResource(load);
  const [nextStage, setNextStage] = useState("");
  const [comment, setComment] = useState("");
  const [confirmedAction, setConfirmedAction] = useState<ConfirmedAction>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const resetWorkflow = async () => {
    setConfirmedAction(null);
    setShowRejectForm(false);
    setConfirmReject(false);
    setComment("");
    setRejectionReason("");
    await reload();
  };

  const runConfirmedAction = async () => {
    if (!confirmedAction || (confirmedAction === "move" && !nextStage)) return;
    setSaving(true);
    setActionError(null);
    try {
      if (confirmedAction === "submit") await recruitmentApi.submitApplication(id);
      else if (confirmedAction === "move") await recruitmentApi.moveApplicationStage(id, nextStage, comment);
      else await recruitmentApi.withdrawApplication(id);
      await resetWorkflow();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
      setConfirmedAction(null);
    } finally {
      setSaving(false);
    }
  };

  const rejectApplication = async () => {
    setSaving(true);
    setActionError(null);
    try {
      await recruitmentApi.rejectApplication(id, rejectionReason.trim());
      await resetWorkflow();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
      setConfirmReject(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? "Application not found."} onRetry={reload} />;

  const [application, history, stages] = data;
  const isActive = ["ACTIVE", "OFFERED"].includes(application.status);
  const currentStage = stages.find((stage) => stage.stage_id === application.current_stage);

  return (
    <div className="space-y-6">
      <PageHeader title="Application" description={`Application ${application.status.toLowerCase()} · server-controlled workflow`} actions={<StatusBadge status={application.status} />} />
      {actionError && <ErrorState message={actionError} />}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5"><p className="text-sm text-ink-muted">Current stage</p><p className="mt-3 text-lg font-semibold">{currentStage?.stage_name ?? "Not assigned"}</p></div>
        <div className="rounded-2xl border border-line bg-surface p-5"><p className="text-sm text-ink-muted">Submitted</p><p className="mt-3 text-lg font-semibold">{application.applied_at ? new Date(application.applied_at).toLocaleDateString() : "Draft"}</p></div>
        <div className="rounded-2xl border border-line bg-surface p-5"><p className="text-sm text-ink-muted">Status</p><p className="mt-3"><StatusBadge status={application.status} /></p></div>
      </div>

      {application.status === "DRAFT" && (
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-semibold">Draft application</h2>
          <p className="mt-1 text-sm text-ink-muted">Submission requires an open job posting and at least one active recruitment stage.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => setConfirmedAction("submit")} className={buttonClasses({ variant: "primary" })}>Submit Application</button>
            <button type="button" onClick={() => setConfirmedAction("withdraw")} className="rounded-lg border border-danger/25 px-4 py-2.5 text-sm font-medium text-danger-ink">Withdraw Draft</button>
          </div>
        </section>
      )}

      {isActive && (
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-semibold">Move through pipeline</h2>
          <p className="mt-1 text-sm text-ink-muted">The backend validates the target stage and preserves an immutable history entry.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <select value={nextStage} onChange={(event) => setNextStage(event.target.value)} className="h-9 rounded-lg border border-line-strong px-3 text-sm"><option value="">Select stage</option>{stages.map((stage) => <option key={stage.stage_id} value={stage.stage_id}>{stage.sequence}. {stage.stage_name}</option>)}</select>
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional note" className="h-9 rounded-lg border border-line-strong px-3 text-sm" />
            <button type="button" disabled={!nextStage} onClick={() => setConfirmedAction("move")} className={buttonClasses({ variant: "primary" })}>Move Stage</button>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => setShowRejectForm(true)} className="rounded-lg border border-danger/25 px-4 py-2.5 text-sm font-medium text-danger-ink">Reject Application</button>
            <button type="button" onClick={() => setConfirmedAction("withdraw")} className="rounded-lg border border-danger/25 px-4 py-2.5 text-sm font-medium text-danger-ink">Withdraw Application</button>
          </div>
        </section>
      )}

      {showRejectForm && (
        <section className="rounded-2xl border border-danger/25 bg-danger-soft p-5">
          <label className="block text-sm font-medium text-ink">Rejection reason <span className="font-normal text-ink-muted">(optional)</span><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-danger/25 bg-surface px-3 py-2.5 text-sm" /></label>
          <div className="mt-3 flex justify-end gap-3"><button type="button" onClick={() => setShowRejectForm(false)} className="text-sm font-medium text-ink-muted">Cancel</button><button type="button" onClick={() => setConfirmReject(true)} className={buttonClasses({ variant: "danger" })}>Reject Application</button></div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-semibold">Stage history</h2>
        <div className="mt-4 divide-y divide-line-soft">
          {history.length === 0 ? <p className="py-4 text-sm text-ink-muted">No stage history yet.</p> : history.map((item) => <div key={item.id} className="py-3"><p className="text-sm font-medium">Moved to {stages.find((stage) => stage.stage_id === item.to_stage)?.stage_name ?? item.to_stage}</p><p className="mt-1 text-xs text-ink-muted">{new Date(item.created_at).toLocaleString()}{item.comment ? ` · ${item.comment}` : ""}</p></div>)}
        </div>
      </section>

      <BackNavigation fallback="/recruitment/applications" label="Back to applications" />

      <ConfirmDialog open={confirmedAction !== null} title={confirmedAction === "submit" ? "Submit application?" : confirmedAction === "withdraw" ? "Withdraw application?" : "Move application stage?"} description={confirmedAction === "submit" ? "The backend will assign the first active stage and create the initial history entry." : confirmedAction === "withdraw" ? "This application will no longer progress through recruitment." : "This creates an immutable pipeline-history entry."} confirmLabel={confirmedAction === "submit" ? "Submit" : confirmedAction === "withdraw" ? "Withdraw" : "Move Stage"} destructive={confirmedAction === "withdraw"} loading={saving} onConfirm={() => void runConfirmedAction()} onCancel={() => setConfirmedAction(null)} />
      <ConfirmDialog open={confirmReject} title="Reject application?" description="The optional reason will be retained with this terminal workflow decision." confirmLabel="Reject Application" destructive loading={saving} onConfirm={() => void rejectApplication()} onCancel={() => setConfirmReject(false)} />
    </div>
  );
}
