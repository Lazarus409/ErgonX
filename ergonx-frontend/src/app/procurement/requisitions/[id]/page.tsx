"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import BudgetCheckPanel from "@/components/procurement/BudgetCheckPanel";
import OrderForm from "@/components/procurement/OrderForm";
import RequisitionForm from "@/components/procurement/RequisitionForm";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import BackNavigation from "@/components/ui/BackNavigation";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Textarea } from "@/components/ui/Field";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { getApiErrorMessage, procurementApi } from "@/lib/api";
import { ORDER_TONES, REQUISITION_TONES } from "@/lib/api/procurement";
import { useAccess } from "@/lib/access";
import { formatAmount, formatDate, formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const STEP_TONES = { PENDING: "info", APPROVED: "success", RETURNED: "warning", REJECTED: "danger" } as const;

export default function RequisitionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAccess();
  const load = useCallback(() => procurementApi.getRequisition(id), [id]);
  const { data: requisition, loading, error, reload } = useApiResource(load);
  const [editing, setEditing] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  if (loading && !requisition) return <LoadingState />;
  if (error || !requisition) return <ErrorState message={error ?? "This requisition could not be loaded."} onRetry={reload} />;

  const viewer = requisition.viewer;
  const run = async (key: string, work: () => Promise<unknown>) => {
    setBusy(key); setActionError("");
    try { await work(); setComment(""); reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); } finally { setBusy(null); }
  };
  const cancellable = (viewer.is_requester || can("purchase_order.create")) && ["DRAFT", "RETURNED", "PENDING", "APPROVED"].includes(requisition.status);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        back={<BackNavigation fallback={viewer.is_requester ? "/me/purchases" : "/procurement"} />}
        title={requisition.title}
        meta={<span className="flex flex-wrap items-center gap-2 text-support text-ink-muted">{requisition.requisition_number}<Badge tone={REQUISITION_TONES[requisition.status]} dot size="sm">{requisition.status_label}</Badge></span>}
        actions={
          <div className="flex flex-wrap gap-2">
            {viewer.can_edit && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
            {viewer.can_edit && <Button loading={busy === "submit"} onClick={() => void run("submit", () => procurementApi.submitRequisition(requisition.id))}>{requisition.status === "RETURNED" ? "Resubmit" : "Submit for approval"}</Button>}
            {requisition.status === "APPROVED" && can("purchase_order.create") && <Button onClick={() => setOrdering(true)}>Create purchase order</Button>}
            {cancellable && <Button variant="ghost" onClick={() => setCancelling(true)}>Cancel request</Button>}
          </div>
        }
      />
      {actionError && <Alert tone="danger" onDismiss={() => setActionError("")}>{actionError}</Alert>}
      {requisition.decision_note && ["RETURNED", "REJECTED", "CANCELLED"].includes(requisition.status) && <Alert tone={requisition.status === "RETURNED" ? "warning" : "info"}>{requisition.decision_note}</Alert>}

      <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-4">
        <div><p className="text-caption text-ink-muted">Requested by</p><p className="font-semibold text-ink-strong">{requisition.requested_by_name}</p></div>
        <div><p className="text-caption text-ink-muted">Department</p><p className="font-semibold text-ink-strong">{requisition.department_name || "—"}</p></div>
        <div><p className="text-caption text-ink-muted">Needed by</p><p className="font-semibold text-ink-strong">{formatDate(requisition.needed_by)}</p></div>
        <div><p className="text-caption text-ink-muted">Estimated total</p><p className="font-semibold tabular-nums text-ink-strong">{formatAmount(requisition.estimated_total, requisition.currency)}</p></div>
        {requisition.justification && <p className="text-support text-ink sm:col-span-4">{requisition.justification}</p>}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[32rem] text-support">
          <thead className="bg-surface-muted text-left text-caption uppercase tracking-[0.06em] text-ink-muted"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Est. unit price</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-line-soft">
            {requisition.lines.map((line) => (
              <tr key={line.id}><td className="px-4 py-2 text-ink-strong">{line.description}</td><td className="px-4 py-2 text-right tabular-nums">{Number(line.quantity)} {line.unit}</td><td className="px-4 py-2 text-right tabular-nums">{formatAmount(line.estimated_unit_price, requisition.currency)}</td><td className="px-4 py-2 text-right tabular-nums">{formatAmount(line.line_total, requisition.currency)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {requisition.approvals.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-body font-semibold text-ink-strong">Approval</h2>
          <ol className="space-y-2">
            {requisition.approvals.map((step) => (
              <li key={step.id} className="flex flex-wrap items-center gap-2 text-support">
                <span className="font-semibold text-ink-strong">{step.step_name}</span>
                <span className="text-ink-muted">{step.decided_by_name || step.approver_name}</span>
                <Badge size="sm" tone={STEP_TONES[step.status]}>{step.status_label}</Badge>
                {step.acted_at && <span className="text-caption text-ink-muted">{formatDateTime(step.acted_at)}</span>}
                {step.comment && <span className="w-full text-ink">“{step.comment}”</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {(viewer.can_decide || can("procurement.view")) && requisition.lines.some((line) => line.expense_account) && <BudgetCheckPanel kind="requisition" id={requisition.id} />}

      {viewer.can_decide && (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <Field label="Comment" helper="Required to return or reject."><Textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} /></Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="danger" disabled={!comment.trim() || busy !== null} loading={busy === "reject"} onClick={() => void run("reject", () => procurementApi.decideRequisition(requisition.id, "reject", comment.trim()))}>Reject</Button>
            <Button variant="secondary" disabled={!comment.trim() || busy !== null} loading={busy === "return"} onClick={() => void run("return", () => procurementApi.decideRequisition(requisition.id, "return", comment.trim()))}>Return for changes</Button>
            <Button disabled={busy !== null} loading={busy === "approve"} onClick={() => void run("approve", () => procurementApi.decideRequisition(requisition.id, "approve", comment.trim()))}>Approve</Button>
          </div>
        </section>
      )}

      {requisition.orders.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-body font-semibold text-ink-strong">Purchase orders</h2>
          <ul className="space-y-1 text-support">
            {requisition.orders.map((order) => (
              <li key={order.id} className="flex items-center gap-2">
                {can("procurement.view") ? <Link className="font-semibold text-primary-ink hover:underline" href={`/procurement/orders/${order.id}`}>{order.order_number}</Link> : <span className="font-semibold text-ink-strong">{order.order_number}</span>}
                <Badge size="sm" tone={ORDER_TONES[order.status]}>{order.status_label}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && <RequisitionForm requisition={requisition} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      {ordering && <OrderForm requisition={requisition} onClose={() => setOrdering(false)} onSaved={(order) => router.push(`/procurement/orders/${order.id}`)} />}
      <ConfirmDialog
        open={cancelling}
        title="Cancel this request?"
        description="Approvers stop seeing it, and it cannot be reopened."
        confirmLabel="Cancel request"
        tone="destructive"
        loading={busy === "cancel"}
        onConfirm={() => void run("cancel", () => procurementApi.cancelRequisition(requisition.id)).then(() => setCancelling(false))}
        onCancel={() => setCancelling(false)}
      />
    </div>
  );
}
