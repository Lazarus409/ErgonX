"use client";

import { useCallback, useMemo } from "react";
import { ArrowLeftRight } from "lucide-react";

import ShiftSwapList from "@/components/attendance/ShiftSwapList";
import { Card } from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { schedulingApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

/** Shift swaps for approvers: the queue waiting for a decision, then recent history. */
export default function ShiftSwapsPage() {
  const load = useCallback(() => schedulingApi.listShiftSwaps(), []);
  const { data, error, reload } = useApiResource(load);
  const swaps = useMemo(() => data?.results ?? [], [data]);
  const waiting = swaps.filter((swap) => swap.status === "AWAITING_APPROVAL");
  const others = swaps.filter((swap) => swap.status !== "AWAITING_APPROVAL");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time & attendance"
        title="Shift swaps"
       
        icon={ArrowLeftRight}
        accent="attendance"
      />
      {error && <ErrorState variant="inline" title="Unable to load shift swaps" message={error} onRetry={reload} />}
      <Card title="Waiting for approval" icon={ArrowLeftRight} accent="attendance"><ShiftSwapList swaps={waiting} onChanged={reload} empty="No swaps are waiting for approval." /></Card>
      <Card title="Recent swaps" icon={ArrowLeftRight} accent="attendance"><ShiftSwapList swaps={others} onChanged={reload} empty="No other swaps." /></Card>
    </div>
  );
}
