"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Scale } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { performanceApi } from "@/lib/api";
import { RATING_LABELS } from "@/lib/api/performance";
import { useApiResource } from "@/lib/useApiResource";

/**
 * Calibration for one cycle: the spread of manager ratings next to the final
 * (calibrated) ones, and each review awaiting or past sign-off.
 */
export default function CalibrationBoardCard({ cycleId }: { cycleId: string }) {
  const load = useCallback(() => performanceApi.getCalibrationBoard(cycleId), [cycleId]);
  const { data } = useApiResource(load);
  if (!data || data.reviews.length === 0) return null;
  const max = Math.max(1, ...data.distribution.flatMap((row) => [row.manager, row.final]));
  const awaiting = data.reviews.filter((row) => row.status === "HR_REVIEW").length;

  return (
    <Card title="Calibration" icon={Scale} accent="hr" actions={awaiting ? <Badge tone="warning">{awaiting} awaiting sign-off</Badge> : undefined}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ul className="space-y-2" aria-label="Rating distribution, manager compared with final">
          {[...data.distribution].reverse().map((row) => (
            <li key={row.rating} className="text-caption">
              <span className="text-ink">{row.rating} · {RATING_LABELS[row.rating]}</span>
              <span className="mt-1 grid grid-cols-[3.5rem_1fr_2rem] items-center gap-2"><span className="text-ink-muted">Manager</span><span className="h-2 rounded-sm bg-surface-muted"><span className="block h-full rounded-sm bg-line-strong" style={{ width: `${(row.manager / max) * 100}%` }} /></span><span className="text-right tabular-nums">{row.manager}</span></span>
              <span className="grid grid-cols-[3.5rem_1fr_2rem] items-center gap-2"><span className="text-ink-muted">Final</span><span className="h-2 rounded-sm bg-surface-muted"><span className="block h-full rounded-sm bg-primary" style={{ width: `${(row.final / max) * 100}%` }} /></span><span className="text-right font-semibold tabular-nums">{row.final}</span></span>
            </li>
          ))}
        </ul>
        <ul className="max-h-80 divide-y divide-line-soft overflow-y-auto">
          {data.reviews.map((row) => (
            <li key={row.id}>
              <Link href={`/reviews/${row.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-surface-hover">
                <span className="min-w-0"><span className="block truncate font-medium text-ink-strong">{row.employee}</span><span className="block truncate text-caption text-ink-muted">{row.department}{row.reviewer ? ` · reviewed by ${row.reviewer}` : ""}</span></span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  <span className="text-ink-muted">{row.manager_rating ?? "–"}</span>
                  {row.calibrated_rating && <><span aria-hidden="true">→</span><span className="font-semibold text-primary-ink">{row.calibrated_rating}</span></>}
                  {row.status === "HR_REVIEW" && <Badge size="sm" tone="warning">To sign off</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
