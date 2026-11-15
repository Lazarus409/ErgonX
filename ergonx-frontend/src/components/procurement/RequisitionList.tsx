"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { REQUISITION_TONES, type Requisition } from "@/lib/api/procurement";
import { formatAmount, formatDate } from "@/lib/format";
import { ShoppingCart } from "lucide-react";

export default function RequisitionList({ requisitions, showRequester = false, emptyTitle }: { requisitions: Requisition[]; showRequester?: boolean; emptyTitle: string }) {
  if (requisitions.length === 0) return <div className="rounded-2xl border border-line bg-surface p-6"><EmptyState icon={ShoppingCart} title={emptyTitle} /></div>;
  return (
    <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-surface">
      {requisitions.map((requisition) => (
        <li key={requisition.id}>
          <Link href={`/procurement/requisitions/${requisition.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface-hover">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink-strong">{requisition.title}</span>
              <span className="block text-caption text-ink-muted">
                {requisition.requisition_number}
                {showRequester ? ` · ${requisition.requested_by_name}` : ""}
                {requisition.department_name ? ` · ${requisition.department_name}` : ""}
                {requisition.needed_by ? ` · needed by ${formatDate(requisition.needed_by)}` : ""}
              </span>
            </span>
            <Badge tone={REQUISITION_TONES[requisition.status]} dot size="sm">{requisition.status_label}</Badge>
            <span className="w-32 text-right font-semibold tabular-nums text-ink-strong">{formatAmount(requisition.estimated_total, requisition.currency)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
