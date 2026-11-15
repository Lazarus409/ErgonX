"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import LoadingState from "@/components/ui/LoadingState";
import { Drawer } from "@/components/ui/Overlay";
import { accountingApi, getApiErrorMessage, procurementApi } from "@/lib/api";
import type { Order, OrderInput, OrderLineInput, Requisition } from "@/lib/api/procurement";
import { formatAmount } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";

const today = () => new Date().toISOString().slice(0, 10);
const plain = (value: string | null | undefined) => (value ? Number(value).toString() : "");
const blankLine = (): OrderLineInput => ({ description: "", quantity: "1", unit: "", unit_price: "", expense_account: null, tax_code: null });

/** Draft or correct a purchase order; from an approved requisition its items are copied in. */
export default function OrderForm({ order, requisition, onClose, onSaved }: { order?: Order | null; requisition?: Requisition | null; onClose: () => void; onSaved: (saved: Order) => void }) {
  const load = useCallback(() => Promise.all([procurementApi.getFormOptions(), accountingApi.listVendors({ page_size: MAX_PAGE_SIZE, is_active: true })]), []);
  const { data, error: loadError } = useApiResource(load);
  const [vendor, setVendor] = useState(order?.vendor ?? requisition?.preferred_vendor ?? "");
  const [orderDate, setOrderDate] = useState(order?.order_date ?? today());
  const [expected, setExpected] = useState(order?.expected_date ?? requisition?.needed_by ?? "");
  const [address, setAddress] = useState(order?.delivery_address ?? "");
  const [terms, setTerms] = useState(order?.terms ?? "");
  const [lines, setLines] = useState<OrderLineInput[]>(() => {
    if (order) return order.lines.map((line) => ({ description: line.description, quantity: plain(line.quantity), unit: line.unit, unit_price: plain(line.unit_price), expense_account: line.expense_account, tax_code: line.tax_code, requisition_line: line.requisition_line }));
    if (requisition) return requisition.lines.map((line) => ({ description: line.description, quantity: plain(line.quantity), unit: line.unit, unit_price: plain(line.estimated_unit_price), expense_account: line.expense_account, tax_code: null, requisition_line: line.id }));
    return [blankLine()];
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [options, vendors] = data ?? [null, null];
  const subtotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0), 0);
  const valid = vendor && lines.length > 0 && lines.every((line) => line.description.trim() && Number(line.quantity) > 0 && line.unit_price !== "");
  const setLine = (index: number, values: Partial<OrderLineInput>) => setLines(lines.map((line, position) => (position === index ? { ...line, ...values } : line)));

  const save = async () => {
    setBusy(true); setError("");
    const payload: OrderInput = { vendor, order_date: orderDate, expected_date: expected || null, delivery_address: address.trim(), terms: terms.trim(), lines: lines.map((line) => ({ ...line, description: line.description.trim() })) };
    try {
      const saved = order
        ? await procurementApi.updateOrder(order.id, payload)
        : requisition ? await procurementApi.orderFromRequisition({ ...payload, requisition: requisition.id }) : await procurementApi.createOrder(payload);
      onSaved(saved);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={order ? `Edit ${order.order_number}` : requisition ? `Order ${requisition.requisition_number}` : "New purchase order"}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-support text-ink-muted">Before tax <strong className="tabular-nums text-ink-strong">{formatAmount(subtotal.toFixed(2), options?.currency)}</strong></span>
          <Button disabled={!valid || busy} loading={busy} onClick={() => void save()}>Save draft</Button>
        </div>
      }
    >
      {loadError ? <Alert tone="danger">{loadError}</Alert> : !options || !vendors ? <LoadingState /> : (
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          {vendors.results.length === 0 && <Alert tone="warning">Add the supplier under Accounting → Accounts payable → Vendors first.</Alert>}
          <Field label="Supplier" required>
            <Select value={vendor} onChange={(event) => setVendor(event.target.value)}>
              <option value="">Choose a supplier</option>
              {vendors.results.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Order date"><Input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} /></Field>
            <Field label="Deliver by" optional><Input type="date" value={expected} min={orderDate} onChange={(event) => setExpected(event.target.value)} /></Field>
          </div>
          <Field label="Deliver to" optional><Textarea rows={2} value={address} onChange={(event) => setAddress(event.target.value)} /></Field>
          <div className="space-y-3">
            <p className="text-support font-semibold text-ink-strong">Lines</p>
            {lines.map((line, index) => (
              <div key={index} className="space-y-2 rounded-xl border border-line p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_5rem_5rem_7rem_auto] sm:items-end">
                  <Field label="Item"><Input value={line.description} maxLength={255} onChange={(event) => setLine(index, { description: event.target.value })} /></Field>
                  <Field label="Qty"><Input type="number" min="0" step="any" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} /></Field>
                  <Field label="Unit"><Input value={line.unit ?? ""} maxLength={30} onChange={(event) => setLine(index, { unit: event.target.value })} /></Field>
                  <Field label="Unit price"><Input type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => setLine(index, { unit_price: event.target.value })} /></Field>
                  <Button variant="ghost" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Charge to account">
                    <Select value={line.expense_account ?? ""} onChange={(event) => setLine(index, { expense_account: event.target.value || null })}>
                      <option value="">Choose before submitting</option>
                      {options.accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Tax" optional>
                    <Select value={line.tax_code ?? ""} onChange={(event) => setLine(index, { tax_code: event.target.value || null })}>
                      <option value="">No tax</option>
                      {options.tax_codes.map((tax) => <option key={tax.id} value={tax.id}>{tax.label}</option>)}
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setLines([...lines, blankLine()])}>Add line</Button>
          </div>
          <Field label="Terms" optional><Textarea rows={2} value={terms} onChange={(event) => setTerms(event.target.value)} placeholder="e.g. Payment 30 days after delivery" /></Field>
        </div>
      )}
    </Drawer>
  );
}
