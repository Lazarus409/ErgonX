"use client";

import { useCallback } from "react";

import { Badge } from "@/components/ui/Badge";
import { procurementApi } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const LABELS = { NO_BUDGET: ["No budget", "neutral"], OVER_BUDGET: ["Over budget", "danger"], WITHIN_BUDGET: ["Within budget", "success"] } as const;

/** Approved budget left for each account this purchase is charged to. Advisory: it does not block. */
export default function BudgetCheckPanel({ kind, id }: { kind: "requisition" | "order"; id: string }) {
  const load = useCallback(() => (kind === "order" ? procurementApi.orderBudgetCheck(id) : procurementApi.requisitionBudgetCheck(id)), [kind, id]);
  const { data } = useApiResource(load);
  if (!data || data.rows.length === 0) return null;
  return (
    <section className="space-y-2 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-body font-semibold text-ink-strong">Budget{data.fiscal_year ? ` · ${data.fiscal_year}` : ""}</h2>
      <ul className="divide-y divide-line-soft text-support">
        {data.rows.map((row) => (
          <li key={row.account_id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="min-w-0 flex-1 text-ink-strong">{row.account}</span>
            <span className="tabular-nums text-ink-muted">This purchase {formatAmount(row.amount)}</span>
            {row.status !== "NO_BUDGET" && <span className="tabular-nums text-ink-muted">Left {formatAmount(row.remaining)} of {formatAmount(row.allocated)}</span>}
            <Badge size="sm" tone={LABELS[row.status][1]}>{LABELS[row.status][0]}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
