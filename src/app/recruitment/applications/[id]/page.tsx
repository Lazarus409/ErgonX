"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, recruitmentApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

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
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Current stage</p><p className="mt-3 text-lg font-semibold">{currentStage?.stage_name ?? "Not assigned"}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Submitted</p><p className="mt-3 text-lg font-semibold">{application.applied_at ? new Date(application.applied_at).toLocaleDateString() : "Draft"}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Status</p><p className="mt-3"><StatusBadge status={application.status} /></p></div>
      </div>

      {application.status === "DRAFT" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">Draft application</h2>
          <p className="mt-1 text-sm text-slate-500">Submission requires an open job posting and at least one active recruitment stage.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => setConfirmedAction("submit")} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">Submit Application</button>
            <button type="button" onClick={() => setConfirmedAction("withdraw")} className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700">Withdraw Draft</button>
          </div>
        </section>
      )}

      {isActive && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">Move through pipeline</h2>
          <p className="mt-1 text-sm text-slate-500">The backend validates the target stage and preserves an immutable history entry.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <select value={nextStage} onChange={(event) => setNextStage(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"><option value="">Select stage</option>{stages.map((stage) => <option key={stage.stage_id} value={stage.stage_id}>{stage.sequence}. {stage.stage_name}</option>)}</select>
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional note" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
            <button type="button" disabled={!nextStage} onClick={() => setConfirmedAction("move")} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">Move Stage</button>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={() => setShowRejectForm(true)} className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700">Reject Application</button>
            <button type="button" onClick={() => setConfirmedAction("withdraw")} className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700">Withdraw Application</button>
          </div>
        </section>
      )}

      {showRejectForm && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <label className="block text-sm font-medium text-slate-800">Rejection reason <span className="font-normal text-slate-500">(optional)</span><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm" /></label>
          <div className="mt-3 flex justify-end gap-3"><button type="button" onClick={() => setShowRejectForm(false)} className="text-sm font-medium text-slate-600">Cancel</button><button type="button" onClick={() => setConfirmReject(true)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white">Reject Application</button></div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold">Stage history</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {history.length === 0 ? <p className="py-4 text-sm text-slate-500">No stage history yet.</p> : history.map((item) => <div key={item.id} className="py-3"><p className="text-sm font-medium">Moved to {stages.find((stage) => stage.stage_id === item.to_stage)?.stage_name ?? item.to_stage}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}{item.comment ? ` · ${item.comment}` : ""}</p></div>)}
        </div>
      </section>

      <Link href="/recruitment/applications" className="text-sm font-medium text-slate-600 hover:text-slate-900">Back to Applications</Link>

      <ConfirmDialog open={confirmedAction !== null} title={confirmedAction === "submit" ? "Submit application?" : confirmedAction === "withdraw" ? "Withdraw application?" : "Move application stage?"} description={confirmedAction === "submit" ? "The backend will assign the first active stage and create the initial history entry." : confirmedAction === "withdraw" ? "This application will no longer progress through recruitment." : "This creates an immutable pipeline-history entry."} confirmLabel={confirmedAction === "submit" ? "Submit" : confirmedAction === "withdraw" ? "Withdraw" : "Move Stage"} destructive={confirmedAction === "withdraw"} loading={saving} onConfirm={() => void runConfirmedAction()} onCancel={() => setConfirmedAction(null)} />
      <ConfirmDialog open={confirmReject} title="Reject application?" description="The optional reason will be retained with this terminal workflow decision." confirmLabel="Reject Application" destructive loading={saving} onConfirm={() => void rejectApplication()} onCancel={() => setConfirmReject(false)} />
    </div>
  );
}
