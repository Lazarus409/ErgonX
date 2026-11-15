"use client";

import { Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import OrderForm from "@/components/procurement/OrderForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { procurementApi } from "@/lib/api";
import { ORDER_TONES } from "@/lib/api/procurement";
import { useAccess } from "@/lib/access";
import { formatAmount, formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PENDING", label: "Awaiting approval" },
  { value: "", label: "All" },
];
const OPEN = new Set(["ISSUED", "PART_RECEIVED", "RECEIVED"]);

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { can } = useAccess();
  const [filter, setFilter] = useState("open");
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => procurementApi.listOrders({ page_size: MAX_PAGE_SIZE, ...(filter && filter !== "open" ? { status: filter } : {}) }), [filter]);
  const { data, loading, error, reload } = useApiResource(load);
  const today = new Date().toISOString().slice(0, 10);
  const rows = (data?.results ?? []).filter((order) => filter !== "open" || OPEN.has(order.status));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Purchase orders" actions={can("purchase_order.create") ? <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New order</Button> : undefined} />
      <Tabs label="Order status" variant="pill" items={FILTERS} value={filter} onChange={setFilter} />
      {loading && !data ? <LoadingState variant="table" /> : error || !data ? <ErrorState message={error ?? "Orders could not be loaded."} onRetry={reload} /> : rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-6"><EmptyState icon={ShoppingCart} title="No purchase orders here" /></div>
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-surface">
          {rows.map((order) => {
            const late = order.expected_date && order.expected_date < today && ["ISSUED", "PART_RECEIVED"].includes(order.status);
            return (
              <li key={order.id}>
                <Link href={`/procurement/orders/${order.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface-hover">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink-strong">{order.vendor_name}</span>
                    <span className="block text-caption text-ink-muted">
                      {order.order_number} · {formatDate(order.order_date)}{order.requisition_number ? ` · ${order.requisition_number}` : ""}{order.expected_date ? ` · due ${formatDate(order.expected_date)}` : ""}
                    </span>
                  </span>
                  {late && <Badge tone="danger" size="sm">Late</Badge>}
                  <Badge tone={ORDER_TONES[order.status]} dot size="sm">{order.status_label}</Badge>
                  <span className="w-32 text-right font-semibold tabular-nums text-ink-strong">{formatAmount(order.total_amount, order.currency)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {creating && <OrderForm onClose={() => setCreating(false)} onSaved={(order) => router.push(`/procurement/orders/${order.id}`)} />}
    </div>
  );
}
