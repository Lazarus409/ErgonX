"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import { getApiErrorMessage, schedulingApi } from "@/lib/api";
import { SWAP_STATUS_TONES, type ShiftSwap } from "@/lib/api/scheduling";
import { formatDate, formatDateTime } from "@/lib/format";

type Act = "accept" | "decline" | "cancel" | "approve" | "reject";
const NEEDS_NOTE: Record<Act, "none" | "optional" | "required"> = { accept: "none", cancel: "none", approve: "optional", decline: "optional", reject: "required" };
const LABELS: Record<Act, string> = { accept: "Accept", decline: "Decline", cancel: "Cancel swap", approve: "Approve", reject: "Reject" };

/** A list of shift swaps with the actions the viewer may take on each. */
export default function ShiftSwapList({ swaps, onChanged, empty }: { swaps: ShiftSwap[]; onChanged: () => void; empty: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [noting, setNoting] = useState<{ swap: ShiftSwap; act: Act } | null>(null);
  const [note, setNote] = useState("");

  const run = async (swap: ShiftSwap, act: Act, text?: string) => {
    setBusy(swap.id);
    setError("");
    try { await schedulingApi.swapAction(swap.id, act, text); setNoting(null); onChanged(); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(null); }
  };

  const start = (swap: ShiftSwap, act: Act) => {
    if (NEEDS_NOTE[act] === "none") { void run(swap, act); return; }
    setNote("");
    setError("");
    setNoting({ swap, act });
  };

  if (swaps.length === 0) return <p className="text-support text-ink-muted">{empty}</p>;

  return (
    <>
      {error && !noting && <Alert tone="danger" onDismiss={() => setError("")}>{error}</Alert>}
      <ul className="divide-y divide-line-soft">
        {swaps.map((swap) => (
          <li key={swap.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">
                {formatDate(swap.swap_date)}
                <Badge size="sm" tone={SWAP_STATUS_TONES[swap.status]}>{swap.status_label}</Badge>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-support text-ink">
                <span><span className="font-medium">{swap.requester.name}</span> <span className="text-ink-muted">({swap.requester_shift_label})</span></span>
                <ArrowLeftRight className="h-4 w-4 text-ink-muted" aria-label="swaps with" />
                <span><span className="font-medium">{swap.counterpart.name}</span> <span className="text-ink-muted">({swap.counterpart_shift_label})</span></span>
              </p>
              {swap.reason && <p className="mt-1 text-caption text-ink-muted">Reason: {swap.reason}</p>}
              {swap.decided_at && <p className="mt-1 text-caption text-ink-muted">{swap.status_label} by {swap.decided_by_name || "an approver"} {formatDateTime(swap.decided_at)}{swap.decision_note ? `: ${swap.decision_note}` : ""}</p>}
              {!swap.decided_at && swap.decision_note && <p className="mt-1 text-caption text-ink-muted">Note: {swap.decision_note}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {swap.viewer.can_answer && <><Button size="sm" loading={busy === swap.id} onClick={() => start(swap, "accept")}>Accept</Button><Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => start(swap, "decline")}>Decline</Button></>}
              {swap.viewer.can_decide && <><Button size="sm" loading={busy === swap.id} onClick={() => start(swap, "approve")}>Approve</Button><Button size="sm" variant="danger" disabled={busy !== null} onClick={() => start(swap, "reject")}>Reject</Button></>}
              {swap.viewer.can_cancel && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => start(swap, "cancel")}>Cancel swap</Button>}
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={noting !== null}
        onClose={() => setNoting(null)}
        title={noting ? `${LABELS[noting.act]} shift swap` : "Shift swap"}
        description={noting ? `${noting.swap.requester.name} ⇄ ${noting.swap.counterpart.name} on ${formatDate(noting.swap.swap_date)}` : undefined}
        footer={<><Button variant="secondary" onClick={() => setNoting(null)}>Back</Button><Button variant={noting?.act === "reject" ? "danger" : "primary"} loading={busy !== null} onClick={() => noting && void run(noting.swap, noting.act, note.trim() || undefined)}>{noting ? LABELS[noting.act] : "Save"}</Button></>}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Note" required={noting ? NEEDS_NOTE[noting.act] === "required" : false} optional={noting ? NEEDS_NOTE[noting.act] === "optional" : false}>
          <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} data-autofocus />
        </Field>
      </Dialog>
    </>
  );
}
