"use client";

import { Download, PackageCheck, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import BudgetCheckPanel from "@/components/procurement/BudgetCheckPanel";
import OrderForm from "@/components/procurement/OrderForm";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import BackNavigation from "@/components/ui/BackNavigation";
import { Button } from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Input, Textarea } from "@/components/ui/Field";
import LoadingState from "@/components/ui/LoadingState";
import { Drawer } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { getApiErrorMessage, procurementApi } from "@/lib/api";
import { ORDER_TONES, type MatchSummary, type Order } from "@/lib/api/procurement";
import { useAccess } from "@/lib/access";
import { formatAmount, formatDate, formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) => { const value = new Date(`${date}T00:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };

type Reasoned = { action: "reject" | "cancel" | "close"; title: string; label: string; required: boolean };

export default function PurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAccess();
  const load = useCallback(() => Promise.all([procurementApi.getOrder(id), procurementApi.getMatch(id)]), [id]);
  const { data, loading, error, reload } = useApiResource(load);
  const [editing, setEditing] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [billing, setBilling] = useState(false);
  const [reasoned, setReasoned] = useState<Reasoned | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? "This order could not be loaded."} onRetry={reload} />;
  const [order, match] = data;

  const run = async (key: string, work: () => Promise<unknown>) => {
    setBusy(key); setActionError("");
    try { await work(); reload(); return true; } catch (caught) { setActionError(getApiErrorMessage(caught)); return false; } finally { setBusy(null); }
  };
  const download = async () => {
    await run("pdf", async () => {
      const blob = await procurementApi.downloadOrder(order.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `purchase-order-${order.order_number}.pdf`; link.click(); URL.revokeObjectURL(url);
    });
  };
  const receivable = ["ISSUED", "PART_RECEIVED"].includes(order.status);
  const billable = match.lines.some((line) => Number(line.billable_quantity) > 0);
  const blocked = order.viewer.approval_blocked_reason;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        back={<BackNavigation fallback="/procurement/orders" />}
        title={`${order.order_number} · ${order.vendor_name}`}
        meta={<span className="flex flex-wrap items-center gap-2 text-support text-ink-muted"><Badge tone={ORDER_TONES[order.status]} dot size="sm">{order.status_label}</Badge>{formatAmount(order.total_amount, order.currency)}</span>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leadingIcon={<Download className="h-4 w-4" />} loading={busy === "pdf"} onClick={() => void download()}>PDF</Button>
            {order.status === "DRAFT" && can("purchase_order.create") && <>
              <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
              <Button loading={busy === "submit"} onClick={() => void run("submit", () => procurementApi.orderAction(order.id, "submit"))}>Submit for approval</Button>
            </>}
            {order.status === "PENDING" && can("purchase_order.approve") && !blocked && <>
              <Button variant="secondary" onClick={() => setReasoned({ action: "reject", title: "Send the order back", label: "What needs to change", required: true })}>Send back</Button>
              <Button loading={busy === "approve"} onClick={() => void run("approve", () => procurementApi.orderAction(order.id, "approve"))}>Approve and issue</Button>
            </>}
            {receivable && can("goods_receipt.create") && <Button leadingIcon={<PackageCheck className="h-4 w-4" />} onClick={() => setReceiving(true)}>Receive goods</Button>}
            {billable && can("vendor_bill.create") && <Button leadingIcon={<ReceiptText className="h-4 w-4" />} onClick={() => setBilling(true)}>Create bill</Button>}
            {["DRAFT", "PENDING", "ISSUED"].includes(order.status) && can("purchase_order.create") && <Button variant="ghost" onClick={() => setReasoned({ action: "cancel", title: "Cancel the order", label: "Reason", required: true })}>Cancel</Button>}
            {["PART_RECEIVED", "RECEIVED"].includes(order.status) && can("purchase_order.create") && <Button variant="ghost" onClick={() => setReasoned({ action: "close", title: "Close the order", label: order.status === "RECEIVED" ? "Note" : "Why the rest will not be delivered", required: order.status !== "RECEIVED" })}>Close</Button>}
          </div>
        }
      />
      {actionError && <Alert tone="danger" onDismiss={() => setActionError("")}>{actionError}</Alert>}
      {order.status === "PENDING" && blocked && <Alert tone="info">{blocked}</Alert>}
      {order.status === "DRAFT" && order.rejection_reason && <Alert tone="warning">Sent back: {order.rejection_reason}</Alert>}
      {order.close_reason && ["CLOSED", "CANCELLED"].includes(order.status) && <Alert tone="info">{order.close_reason}</Alert>}
      {match.mismatched_bills > 0 && <Alert tone="warning">{match.mismatched_bills} bill{match.mismatched_bills === 1 ? " no longer matches" : "s no longer match"} what was ordered and received. Check the amounts before approving.</Alert>}

      <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-4">
        <div><p className="text-caption text-ink-muted">Supplier</p><p className="font-semibold text-ink-strong">{order.vendor_name}</p><p className="text-caption text-ink-muted">{[order.vendor_details.email, order.vendor_details.phone].filter(Boolean).join(" · ")}</p></div>
        <div><p className="text-caption text-ink-muted">Ordered</p><p className="font-semibold text-ink-strong">{formatDate(order.order_date)}</p><p className="text-caption text-ink-muted">Deliver by {formatDate(order.expected_date)}</p></div>
        <div><p className="text-caption text-ink-muted">Requisition</p><p className="font-semibold text-ink-strong">{order.requisition ? <Link className="text-primary-ink hover:underline" href={`/procurement/requisitions/${order.requisition}`}>{order.requisition_number}</Link> : "—"}</p></div>
        <div><p className="text-caption text-ink-muted">Prepared by</p><p className="font-semibold text-ink-strong">{order.created_by_name}</p>{order.approved_by_name && <p className="text-caption text-ink-muted">Approved by {order.approved_by_name}</p>}</div>
        {order.delivery_address && <p className="text-support text-ink sm:col-span-2">Deliver to: {order.delivery_address}</p>}
        {order.terms && <p className="text-support text-ink sm:col-span-2">Terms: {order.terms}</p>}
      </section>

      <MatchTable order={order} match={match} />
      {order.lines.some((line) => line.expense_account) && <BudgetCheckPanel kind="order" id={order.id} />}

      {match.bills.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-body font-semibold text-ink-strong">Bills</h2>
          <ul className="divide-y divide-line-soft text-support">
            {match.bills.map((bill) => (
              <li key={bill.id} className="flex flex-wrap items-center gap-3 py-2">
                <Link className="font-semibold text-primary-ink hover:underline" href={`/accounting/payables/bills/${bill.id}`}>{bill.bill_number}</Link>
                <span className="text-ink-muted">{formatDate(bill.bill_date)}</span>
                <Badge size="sm" tone={bill.matches ? "success" : "warning"}>{bill.matches ? "Matches order" : "Differs from order"}</Badge>
                <span className="text-ink-muted">{bill.status_label}</span>
                <span className="ml-auto tabular-nums text-ink-strong">{formatAmount(bill.total_amount, order.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {order.receipts.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-body font-semibold text-ink-strong">Deliveries</h2>
          <ul className="space-y-3 text-support">
            {order.receipts.map((receipt) => (
              <li key={receipt.id}>
                <p className="font-semibold text-ink-strong">{receipt.receipt_number} · {formatDate(receipt.received_date)}<span className="font-normal text-ink-muted"> · {receipt.received_by_name}{receipt.delivery_note ? ` · delivery note ${receipt.delivery_note}` : ""}</span></p>
                <ul className="text-ink">
                  {receipt.lines.map((line) => <li key={line.id}>{line.description}: {Number(line.quantity)} received{Number(line.rejected_quantity) > 0 ? `, ${Number(line.rejected_quantity)} rejected` : ""}{line.note ? ` (${line.note})` : ""}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      {order.submitted_at && <p className="text-caption text-ink-muted">Submitted {formatDateTime(order.submitted_at)} by {order.submitted_by_name}{order.approved_at ? ` · approved ${formatDateTime(order.approved_at)}` : ""}</p>}

      {editing && <OrderForm order={order} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      {receiving && <ReceiveDrawer order={order} match={match} onClose={() => setReceiving(false)} onDone={() => { setReceiving(false); reload(); }} />}
      {billing && <BillDrawer order={order} match={match} onClose={() => setBilling(false)} onDone={(billId) => router.push(`/accounting/payables/bills/${billId}`)} />}
      {reasoned && <ReasonDrawer {...reasoned} busy={busy === reasoned.action} onClose={() => setReasoned(null)} onConfirm={async (reason) => { if (await run(reasoned.action, () => procurementApi.orderAction(order.id, reasoned.action, reason))) setReasoned(null); }} />}
    </div>
  );
}

function MatchTable({ order, match }: { order: Order; match: MatchSummary }) {
  return (
    <section className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[44rem] text-support">
        <thead className="bg-surface-muted text-left text-caption uppercase tracking-[0.06em] text-ink-muted">
          <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Account</th><th className="px-4 py-2 text-right">Unit price</th><th className="px-4 py-2 text-right">Ordered</th><th className="px-4 py-2 text-right">Received</th><th className="px-4 py-2 text-right">Billed</th><th className="px-4 py-2 text-right">Amount</th></tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {order.lines.map((line) => {
            const figures = match.lines.find((row) => row.line_id === line.id);
            return (
              <tr key={line.id}>
                <td className="px-4 py-2 text-ink-strong">{line.description}{line.tax_code_label ? <span className="block text-caption text-ink-muted">{line.tax_code_label}</span> : null}</td>
                <td className="px-4 py-2 text-ink-muted">{line.expense_account_label || "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatAmount(line.unit_price, order.currency)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{Number(line.quantity)} {line.unit}</td>
                <td className="px-4 py-2 text-right tabular-nums">{figures?.received_quantity ?? "0"}{figures && Number(figures.rejected_quantity) > 0 ? <span className="block text-caption text-danger">{figures.rejected_quantity} rejected</span> : null}</td>
                <td className="px-4 py-2 text-right tabular-nums">{figures?.billed_quantity ?? "0"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatAmount(line.line_total, order.currency)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="text-ink-strong">
          <tr><td colSpan={6} className="px-4 py-1 text-right text-ink-muted">Subtotal</td><td className="px-4 py-1 text-right tabular-nums">{formatAmount(order.subtotal, order.currency)}</td></tr>
          <tr><td colSpan={6} className="px-4 py-1 text-right text-ink-muted">Tax</td><td className="px-4 py-1 text-right tabular-nums">{formatAmount(order.tax_total, order.currency)}</td></tr>
          <tr><td colSpan={6} className="px-4 py-2 text-right font-semibold">Total</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{formatAmount(order.total_amount, order.currency)}</td></tr>
        </tfoot>
      </table>
    </section>
  );
}

function ReceiveDrawer({ order, match, onClose, onDone }: { order: Order; match: MatchSummary; onClose: () => void; onDone: () => void }) {
  const open = match.lines.filter((line) => Number(line.outstanding_quantity) > 0);
  const [date, setDate] = useState(today());
  const [deliveryNote, setDeliveryNote] = useState("");
  const [rows, setRows] = useState(() => Object.fromEntries(open.map((line) => [line.line_id, { quantity: line.outstanding_quantity, rejected: "", note: "" }])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); setError("");
    try {
      await procurementApi.receiveGoods(order.id, { received_date: date, delivery_note: deliveryNote.trim(), lines: open.map((line) => ({ order_line: line.line_id, quantity: rows[line.line_id].quantity || "0", rejected_quantity: rows[line.line_id].rejected || "0", note: rows[line.line_id].note })) });
      onDone();
    } catch (caught) { setError(getApiErrorMessage(caught)); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} width="lg" title={`Receive goods · ${order.order_number}`} footer={<div className="flex justify-end"><Button loading={busy} onClick={() => void save()}>Record delivery</Button></div>}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Received on"><Input type="date" value={date} max={today()} min={order.order_date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label="Supplier delivery note" optional><Input value={deliveryNote} maxLength={120} onChange={(event) => setDeliveryNote(event.target.value)} /></Field>
        </div>
        {open.map((line) => (
          <div key={line.line_id} className="space-y-2 rounded-xl border border-line p-3">
            <p className="font-semibold text-ink-strong">{line.description}<span className="font-normal text-ink-muted"> · {line.outstanding_quantity} {line.unit} still to come</span></p>
            <div className="grid gap-2 sm:grid-cols-[6rem_6rem_1fr]">
              <Field label="Accepted"><Input type="number" min="0" step="any" max={line.outstanding_quantity} value={rows[line.line_id].quantity} onChange={(event) => setRows({ ...rows, [line.line_id]: { ...rows[line.line_id], quantity: event.target.value } })} /></Field>
              <Field label="Rejected"><Input type="number" min="0" step="any" value={rows[line.line_id].rejected} onChange={(event) => setRows({ ...rows, [line.line_id]: { ...rows[line.line_id], rejected: event.target.value } })} /></Field>
              <Field label="Note" optional><Input value={rows[line.line_id].note} maxLength={255} onChange={(event) => setRows({ ...rows, [line.line_id]: { ...rows[line.line_id], note: event.target.value } })} placeholder="e.g. two boxes damaged" /></Field>
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

function BillDrawer({ order, match, onClose, onDone }: { order: Order; match: MatchSummary; onClose: () => void; onDone: (billId: string) => void }) {
  const lines = match.lines.filter((line) => Number(line.billable_quantity) > 0);
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(today(), 30));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); setError("");
    try { onDone((await procurementApi.billOrder(order.id, { bill_number: billNumber.trim(), bill_date: billDate, due_date: dueDate })).id); }
    catch (caught) { setError(getApiErrorMessage(caught)); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} width="md" title={`Bill from ${order.order_number}`} footer={<div className="flex justify-end"><Button disabled={!billNumber.trim()} loading={busy} onClick={() => void save()}>Create draft bill</Button></div>}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Supplier invoice number" required><Input value={billNumber} maxLength={80} onChange={(event) => setBillNumber(event.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice date"><Input type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} /></Field>
          <Field label="Due"><Input type="date" value={dueDate} min={billDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
        </div>
        <ul className="divide-y divide-line-soft rounded-xl border border-line text-support">
          {lines.map((line) => <li key={line.line_id} className="flex justify-between gap-3 px-3 py-2"><span className="text-ink-strong">{line.description}</span><span className="tabular-nums text-ink-muted">{line.billable_quantity} {line.unit}</span></li>)}
        </ul>
        <p className="text-caption text-ink-muted">Only what was received and not yet billed is included. The bill opens in Accounts payable as a draft for withholding, approval and posting.</p>
      </div>
    </Drawer>
  );
}

function ReasonDrawer({ title, label, required, busy, onClose, onConfirm }: Reasoned & { busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Drawer open onClose={onClose} width="md" title={title} footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Back</Button><Button disabled={required && !reason.trim()} loading={busy} onClick={() => onConfirm(reason.trim())}>Confirm</Button></div>}>
      <Field label={label} required={required} optional={!required}><Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
    </Drawer>
  );
}
