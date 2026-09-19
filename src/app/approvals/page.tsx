"use client";

import { useCallback, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, workflowsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { ApprovalRequest } from "@/types/workflows";

export default function ApprovalsPage() {
  const load = useCallback(async () => { const [requests, actions] = await Promise.all([workflowsApi.listApprovalRequests(), workflowsApi.listApprovalActions()]); return { requests: requests.results, actions: actions.results }; }, []);
  const { data, loading, error, reload } = useApiResource(load);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | "cancel">("approve");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const decide = async () => { if (!selected) return; setSaving(true); setActionError(null); try { await workflowsApi.decideApprovalRequest(selected.id, decision, ""); setSelected(null); reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); setSelected(null); } finally { setSaving(false); } };
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? "You may not have permission to view approval requests."} onRetry={reload} />;
  return <div className="space-y-6"><PageHeader title="Approvals" description="Review and action backend-managed approval requests." />{actionError && <ErrorState title="Approval action failed" message={actionError} onRetry={reload} />}<section className="rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Approval requests</h2></div>{data.requests.length === 0 ? <EmptyState title="No approval requests" description="Requests submitted by ERP workflows will appear here." /> : <div className="divide-y divide-slate-100">{data.requests.map((request) => <div key={request.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-medium text-slate-950">{request.entity_type.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-slate-500">Requested {new Date(request.created_at).toLocaleString()} · {request.current_step ? "Awaiting current step" : "No current step"}</p></div><StatusBadge status={request.status} />{request.status === "PENDING" && <div className="flex gap-2"><button onClick={() => { setDecision("approve"); setSelected(request); }} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Approve</button><button onClick={() => { setDecision("reject"); setSelected(request); }} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700">Reject</button></div>}</div>)}</div>}</section><section className="rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Recent decisions</h2></div>{data.actions.length === 0 ? <p className="p-5 text-sm text-slate-500">No approval actions recorded.</p> : <div className="divide-y divide-slate-100">{data.actions.slice(0, 10).map((item) => <div key={item.id} className="p-4 text-sm"><span className="font-medium text-slate-900">{item.action}</span><span className="text-slate-500"> · {new Date(item.acted_at).toLocaleString()}</span>{item.comments && <p className="mt-1 text-slate-500">{item.comments}</p>}</div>)}</div>}</section><ConfirmDialog open={Boolean(selected)} title={`${decision === "approve" ? "Approve" : "Reject"} request?`} description="This decision is applied by the backend approval workflow and cannot be changed from this screen." confirmLabel={decision === "approve" ? "Approve" : "Reject"} destructive={decision === "reject"} loading={saving} onConfirm={() => void decide()} onCancel={() => setSelected(null)} /></div>;
}
