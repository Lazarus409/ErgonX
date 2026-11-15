"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Overlay";
import { getApiErrorMessage, procurementApi } from "@/lib/api";
import type { Requisition, RequisitionLineInput } from "@/lib/api/procurement";
import { formatAmount } from "@/lib/format";

const blankLine = (): RequisitionLineInput => ({ description: "", quantity: "1", unit: "", estimated_unit_price: "" });

/** Raise or correct a purchase requisition: what is needed, how many, and roughly what it costs. */
export default function RequisitionForm({ requisition, onClose, onSaved }: { requisition: Requisition | null; onClose: () => void; onSaved: (saved: Requisition, submit: boolean) => void }) {
  const [title, setTitle] = useState(requisition?.title ?? "");
  const [justification, setJustification] = useState(requisition?.justification ?? "");
  const [neededBy, setNeededBy] = useState(requisition?.needed_by ?? "");
  const [lines, setLines] = useState<RequisitionLineInput[]>(
    requisition?.lines.length
      ? requisition.lines.map((line) => ({ description: line.description, quantity: Number(line.quantity).toString(), unit: line.unit, estimated_unit_price: Number(line.estimated_unit_price).toString(), expense_account: line.expense_account }))
      : [blankLine()],
  );
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState("");
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.estimated_unit_price) || 0), 0);
  const valid = title.trim() && lines.length > 0 && lines.every((line) => line.description.trim() && Number(line.quantity) > 0);
  const setLine = (index: number, values: Partial<RequisitionLineInput>) => setLines(lines.map((line, position) => (position === index ? { ...line, ...values } : line)));

  const save = async (submit: boolean) => {
    setBusy(submit ? "submit" : "save"); setError("");
    const payload = {
      title: title.trim(), justification: justification.trim(), needed_by: neededBy || null,
      lines: lines.map((line) => ({ ...line, description: line.description.trim(), estimated_unit_price: line.estimated_unit_price || "0" })),
    };
    try {
      let saved = requisition ? await procurementApi.updateRequisition(requisition.id, payload) : await procurementApi.createRequisition(payload);
      if (submit) saved = await procurementApi.submitRequisition(saved.id);
      onSaved(saved, submit);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={requisition ? `Edit ${requisition.requisition_number}` : "New purchase request"}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-support text-ink-muted">Estimated total <strong className="tabular-nums text-ink-strong">{formatAmount(total.toFixed(2), requisition?.currency)}</strong></span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!valid || busy !== null} loading={busy === "save"} onClick={() => void save(false)}>Save draft</Button>
            <Button disabled={!valid || busy !== null} loading={busy === "submit"} loadingLabel="Submitting…" onClick={() => void save(true)}>Submit for approval</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="What do you need?" required><Input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Printer paper for the finance office" /></Field>
        <Field label="Why is it needed?" optional><Textarea rows={3} value={justification} onChange={(event) => setJustification(event.target.value)} /></Field>
        <Field label="Needed by" optional><Input type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} /></Field>
        <div className="space-y-3">
          <p className="text-support font-semibold text-ink-strong">Items</p>
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_5rem_5rem_7rem_auto] sm:items-end">
              <Field label="Item" hideLabel={index > 0}><Input value={line.description} maxLength={255} onChange={(event) => setLine(index, { description: event.target.value })} placeholder="Description" /></Field>
              <Field label="Qty" hideLabel={index > 0}><Input type="number" min="0" step="any" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} /></Field>
              <Field label="Unit" hideLabel={index > 0}><Input value={line.unit ?? ""} maxLength={30} onChange={(event) => setLine(index, { unit: event.target.value })} placeholder="box" /></Field>
              <Field label="Est. unit price" hideLabel={index > 0}><Input type="number" min="0" step="0.01" value={line.estimated_unit_price ?? ""} onChange={(event) => setLine(index, { estimated_unit_price: event.target.value })} /></Field>
              <Button variant="ghost" aria-label="Remove item" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setLines([...lines, blankLine()])}>Add item</Button>
        </div>
      </div>
    </Drawer>
  );
}
