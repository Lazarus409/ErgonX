"use client";

import { PackageCheck } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";

import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { procurementApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";

/** Every delivery recorded against a purchase order. */
export default function GoodsReceivedPage() {
  const load = useCallback(() => procurementApi.listReceipts({ page_size: MAX_PAGE_SIZE }), []);
  const { data, loading, error, reload } = useApiResource(load);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Goods received" />
      {loading && !data ? <LoadingState variant="table" /> : error || !data ? <ErrorState message={error ?? "Deliveries could not be loaded."} onRetry={reload} /> : data.results.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-6"><EmptyState icon={PackageCheck} title="No deliveries recorded yet" /></div>
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-surface">
          {data.results.map((receipt) => {
            const rejected = receipt.lines.reduce((sum, line) => sum + Number(line.rejected_quantity), 0);
            return (
              <li key={receipt.id}>
                <Link href={`/procurement/orders/${receipt.order}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface-hover">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink-strong">{receipt.vendor_name}</span>
                    <span className="block text-caption text-ink-muted">{receipt.receipt_number} · {receipt.order_number} · {receipt.received_by_name}{receipt.delivery_note ? ` · ${receipt.delivery_note}` : ""}</span>
                  </span>
                  {rejected > 0 && <span className="text-caption font-semibold text-danger">{rejected} rejected</span>}
                  <span className="text-support text-ink-muted">{receipt.lines.length} line{receipt.lines.length === 1 ? "" : "s"}</span>
                  <span className="w-28 text-right text-support text-ink-strong">{formatDate(receipt.received_date)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
