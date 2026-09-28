"use client";

import { Check, CheckCircle2, GitPullRequest, History, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Timeline } from "@/components/charts/Visuals";
import { Button } from "@/components/ui/Button";
import { Card, IconTile } from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, workflowsApi } from "@/lib/api";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { ApprovalRequest } from "@/types/workflows";
import { useAccess } from "@/lib/access";

export default function ApprovalsPage() {
  const { readOnly } = useAccess();
  const load = useCallback(async () => { const [requests, actions] = await Promise.all([workflowsApi.listApprovalRequests(), workflowsApi.listApprovalActions()]); return { requests: requests.results, actions: actions.results }; }, []);
  const { data, loading, error, reload } = useApiResource(load);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject" | "cancel">("approve");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const decide = async () => { if (!selected) return; setSaving(true); setActionError(null); try { await workflowsApi.decideApprovalRequest(selected.id, decision, ""); setSelected(null); reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); setSelected(null); } finally { setSaving(false); } };
  if (loading) return <LoadingState variant="table" />;
  if (error || !data) return <ErrorState message={error ?? "You may not have permission to view approval requests."} onRetry={reload} />;
  const pending = data.requests.filter((request) => request.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workflow"
        title="Approvals"
        description="Review and action requests as they move through your institution's approval workflows."
        icon={GitPullRequest}
        accent="brand"
        meta={
          <span className={pending > 0 ? "inline-flex items-center gap-2 rounded-full bg-warning-soft px-3 py-1 text-support font-semibold text-warning-ink" : "inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1 text-support font-semibold text-success-ink"}>
            {pending === 0 && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            <strong className="tabular-nums">{pending}</strong> pending decision{pending === 1 ? "" : "s"}
          </span>
        }
      />
      {actionError && <ErrorState variant="inline" title="Approval action failed" message={actionError} onRetry={reload} />}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
        <Card title="Approval requests" description="Requests that need your decision appear here." icon={GitPullRequest} accent="brand" padding="none" className="min-h-[22rem] [&>div:first-child]:mb-0 [&>div:first-child]:border-b [&>div:first-child]:border-line-soft [&>div:first-child]:px-5 [&>div:first-child]:py-5 sm:[&>div:first-child]:px-6">
          {data.requests.length === 0 ? (
            <EmptyState size="compact" icon={CheckCircle2} title="Your approval queue is clear" description="New requests from leave, payroll, recruitment and other workflows will appear here." className="min-h-[15rem] justify-center px-6" />
          ) : (
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {data.requests.map((request) => (
                <li key={request.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center">
                  <IconTile icon={GitPullRequest} accent="brand" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-strong">{humanizeEnum(request.entity_type)}</p>
                    <p className="text-caption text-ink-muted">Requested {formatDateTime(request.created_at)} · {request.current_step ? "Awaiting current step" : "No current step"}</p>
                  </div>
                  <StatusBadge status={request.status} size="sm" />
                  {request.status === "PENDING" && (
                    <div className="flex gap-2">
                      {!readOnly && <Button size="sm" variant="secondary" className="text-danger-ink" leadingIcon={<X className="h-3.5 w-3.5" />} onClick={() => { setDecision("reject"); setSelected(request); }}>Reject</Button>}
                      {!readOnly && <Button size="sm" leadingIcon={<Check className="h-3.5 w-3.5" />} onClick={() => { setDecision("approve"); setSelected(request); }}>Approve</Button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent decisions" description="A record of the latest ten approval actions." icon={History} accent="brand" padding="none" className="min-h-[22rem] [&>div:first-child]:mb-0 [&>div:first-child]:border-b [&>div:first-child]:border-line-soft [&>div:first-child]:px-5 [&>div:first-child]:py-5 sm:[&>div:first-child]:px-6">
          {data.actions.length === 0 ? (
            <EmptyState size="compact" icon={History} title="No decisions recorded yet" description="Approved, rejected and cancelled requests will be listed here." className="min-h-[15rem] justify-center px-6" />
          ) : (
            <div className="p-5 sm:p-6"><Timeline items={data.actions.slice(0, 10).map((item) => ({ id: item.id, title: humanizeEnum(item.action), time: formatDateTime(item.acted_at), description: item.comments || undefined, tone: /APPROV/i.test(item.action) ? "success" as const : /REJECT|CANCEL/i.test(item.action) ? "danger" as const : "neutral" as const }))} /></div>
          )}
        </Card>
      </div>
      <ConfirmDialog open={Boolean(selected)} title={`${decision === "approve" ? "Approve" : "Reject"} request?`} description="This decision is applied by the backend approval workflow and cannot be changed from this screen." confirmLabel={decision === "approve" ? "Approve" : "Reject"} destructive={decision === "reject"} loading={saving} onConfirm={() => void decide()} onCancel={() => setSelected(null)} />
    </div>
  );
}
