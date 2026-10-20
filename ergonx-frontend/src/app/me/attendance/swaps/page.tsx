"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ChevronLeft, Plus } from "lucide-react";

import ShiftSwapList from "@/components/attendance/ShiftSwapList";
import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import { getApiErrorMessage, schedulingApi } from "@/lib/api";
import type { SwapPerson } from "@/lib/api/scheduling";
import { toISODate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const OPEN = ["AWAITING_COLLEAGUE", "AWAITING_APPROVAL"];

/** My shift swaps: ask a colleague to swap a day, answer requests, follow approval. */
export default function MySwapsPage() {
  const { showToast } = useToast();
  const load = useCallback(() => schedulingApi.listShiftSwaps(), []);
  const { data, error, reload } = useApiResource(load);
  const swaps = useMemo(() => (data?.results ?? []).filter((swap) => swap.viewer.is_requester || swap.viewer.is_counterpart), [data]);
  const forMe = swaps.filter((swap) => swap.viewer.can_answer);
  const open = swaps.filter((swap) => OPEN.includes(swap.status) && !swap.viewer.can_answer);
  const past = swaps.filter((swap) => !OPEN.includes(swap.status));

  const [asking, setAsking] = useState(false);
  const [date, setDate] = useState("");
  const [options, setOptions] = useState<{ my_shift: string | null; colleagues: (SwapPerson & { shift: string })[] } | null>(null);
  const [counterpart, setCounterpart] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const minDate = toISODate(new Date());

  const pickDate = async (value: string) => {
    setDate(value);
    setCounterpart("");
    setOptions(null);
    setFormError("");
    if (!value) return;
    try { setOptions(await schedulingApi.swapColleagues(value)); }
    catch (caught) { setFormError(getApiErrorMessage(caught)); }
  };

  const submit = async () => {
    if (!date || !counterpart) { setFormError("Choose a date and a colleague."); return; }
    setSaving(true);
    setFormError("");
    try {
      await schedulingApi.requestShiftSwap({ counterpart, swap_date: date, reason: reason.trim() });
      setAsking(false);
      showToast({ tone: "success", message: "Swap request sent to your colleague." });
      reload();
    } catch (caught) {
      setFormError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/me/attendance" className="inline-flex items-center gap-1 text-support font-semibold text-primary-ink hover:underline"><ChevronLeft className="h-4 w-4" aria-hidden="true" />My attendance</Link>
      <PageHeader
        eyebrow="Self service"
        title="Shift swaps"
       
        icon={ArrowLeftRight}
        accent="attendance"
        actions={<Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => { setAsking(true); setDate(""); setOptions(null); setCounterpart(""); setReason(""); setFormError(""); }}>Ask for a swap</Button>}
      />
      {error && <ErrorState variant="inline" title="Unable to load your swaps" message={error} onRetry={reload} />}

      {forMe.length > 0 && <Card title="Waiting for your answer" icon={ArrowLeftRight} accent="attendance"><ShiftSwapList swaps={forMe} onChanged={reload} empty="" /></Card>}
      <Card title="In progress" icon={ArrowLeftRight} accent="attendance"><ShiftSwapList swaps={open} onChanged={reload} empty="No swaps in progress." /></Card>
      <Card title="History" icon={ArrowLeftRight} accent="attendance"><ShiftSwapList swaps={past} onChanged={reload} empty="No past swaps." /></Card>

      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        dismissible={!saving}
        title="Ask for a shift swap"
        description="You work your colleague's shift that day and they work yours. If one of you is off, the other covers and takes the day off."
        footer={<><Button variant="secondary" onClick={() => setAsking(false)} disabled={saving}>Cancel</Button><Button onClick={() => void submit()} loading={saving} disabled={!counterpart}>Send request</Button></>}
      >
        <div className="space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Date" required helper={options?.my_shift ? `You're on ${options.my_shift}.` : "Up to 90 days ahead."}>
            <Input type="date" min={minDate} value={date} onChange={(event) => void pickDate(event.target.value)} data-autofocus />
          </Field>
          {date && options && (
            options.my_shift === null ? <Alert tone="warning">You have no schedule on this date.</Alert>
              : options.colleagues.length === 0 ? <Alert tone="info">No colleague in your department or location is on a different shift that day.</Alert>
                : (
                  <Field label="Colleague" required helper="Colleagues in your department or work location who are on a different shift that day.">
                    <Select value={counterpart} onChange={(event) => setCounterpart(event.target.value)}>
                      <option value="">Choose a colleague</option>
                      {options.colleagues.map((person) => <option key={person.id} value={person.id}>{person.name}: {person.shift}</option>)}
                    </Select>
                  </Field>
                )
          )}
          <Field label="Reason" optional><Textarea rows={2} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Hospital appointment in the morning" /></Field>
        </div>
      </Dialog>
    </div>
  );
}
