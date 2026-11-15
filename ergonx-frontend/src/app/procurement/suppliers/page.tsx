"use client";

import Link from "next/link";
import { useCallback } from "react";

import { Badge } from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { procurementApi } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

/** Money promised on open orders, and how each supplier delivers. */
export default function CommitmentsPage() {
  const load = useCallback(() => Promise.all([procurementApi.getCommitments(), procurementApi.getSupplierScores()]), []);
  const { data, loading, error, reload } = useApiResource(load);
  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? "Commitments could not be loaded."} onRetry={reload} />;
  const [commitments, scores] = data;
  const currency = commitments.currency;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Commitments & suppliers" />
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Summary">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-elevation-1"><p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">Committed, not yet billed</p><p className="mt-1 text-heading font-bold tabular-nums text-ink-strong">{formatAmount(commitments.total, currency)}</p></div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-elevation-1"><p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">Open orders</p><p className="mt-1 text-heading font-bold text-ink-strong">{commitments.orders.length}</p></div>
        <div className="rounded-xl border border-line bg-surface p-4 shadow-elevation-1"><p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">Late deliveries</p><p className={`mt-1 text-heading font-bold ${commitments.late_orders ? "text-danger" : "text-ink-strong"}`}>{commitments.late_orders}</p></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-body font-semibold text-ink-strong">By account</h2>
          {commitments.by_account.length === 0 ? <p className="text-support text-ink-muted">Nothing committed.</p> : (
            <ul className="divide-y divide-line-soft text-support">{commitments.by_account.map((row) => <li key={row.account_id} className="flex justify-between gap-3 py-2"><span className="text-ink-strong">{row.account}</span><span className="tabular-nums">{formatAmount(row.amount, currency)}</span></li>)}</ul>
          )}
        </section>
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-body font-semibold text-ink-strong">Open orders</h2>
          {commitments.orders.length === 0 ? <p className="text-support text-ink-muted">No open orders.</p> : (
            <ul className="divide-y divide-line-soft text-support">
              {commitments.orders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Link className="font-semibold text-primary-ink hover:underline" href={`/procurement/orders/${order.id}`}>{order.order_number}</Link>
                  <span className="text-ink-muted">{order.vendor}</span>
                  {order.late && <Badge size="sm" tone="danger">Late · due {formatDate(order.expected_date)}</Badge>}
                  <span className="ml-auto tabular-nums">{formatAmount(order.unbilled, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[36rem] text-support">
          <thead className="bg-surface-muted text-left text-caption uppercase tracking-[0.06em] text-ink-muted">
            <tr><th className="px-4 py-2">Supplier</th><th className="px-4 py-2 text-right">Orders</th><th className="px-4 py-2 text-right">Ordered value</th><th className="px-4 py-2 text-right">On time</th><th className="px-4 py-2 text-right">Lines with rejects</th></tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {scores.results.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-ink-muted">No orders issued yet.</td></tr>}
            {scores.results.map((row) => (
              <tr key={row.vendor_id}>
                <td className="px-4 py-2 font-semibold text-ink-strong">{row.vendor}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.orders}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatAmount(row.spend, currency)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.on_time_rate === null ? "—" : `${row.on_time_rate}% of ${row.delivered}`}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.rejected_lines}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
