"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowRight, CheckCircle2, Clock3, WalletCards } from "lucide-react";

import ErrorState from "@/components/ui/ErrorState";
import KPIStatCard from "@/components/ui/KPIStatCard";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { dashboardsApi } from "@/lib/api";
import { EM_DASH, formatAmount, formatNumber } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const workflow = ["DRAFT", "CALCULATING", "CALCULATED", "UNDER_REVIEW", "APPROVED", "FINALIZED"];

export default function PayrollDashboardPage() {
  const load = useCallback(() => dashboardsApi.getPayrollDashboard(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const placeholder = loading ? "…" : EM_DASH;
  const latestStatus = data?.latest_run_status ?? null;
  const latestIndex = latestStatus ? workflow.indexOf(latestStatus) : -1;

  return (
    <main className="space-y-6">
      <PageHeader title="Payroll Dashboard" description="Monitor payroll runs, approvals and finalisation." />
      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KPIStatCard title="Finalized gross pay" value={data ? formatAmount(data.finalized_gross_pay) : placeholder} subtitle="Across finalized payroll runs" icon={<WalletCards size={20} />} />
        <KPIStatCard title="Finalized net pay" value={data ? formatAmount(data.finalized_net_pay) : placeholder} subtitle="Across finalized payroll runs" icon={<WalletCards size={20} />} />
        <KPIStatCard title="Deductions" value={data ? formatAmount(data.finalized_deductions) : placeholder} subtitle="Across finalized payroll runs" icon={<WalletCards size={20} />} />
        <KPIStatCard title="Employer contributions" value={data ? formatAmount(data.employer_contributions) : placeholder} subtitle="Across finalized payroll runs" icon={<WalletCards size={20} />} />
        <KPIStatCard title="Runs awaiting action" value={data ? formatNumber(data.pending_runs) : placeholder} subtitle={latestStatus ? `Latest: ${latestStatus.replaceAll("_", " ")}` : "No payroll run"} icon={<Clock3 size={20} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border bg-white p-5 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div><h2 className="font-semibold text-slate-900">Latest Payroll Run</h2><p className="text-sm text-slate-500">Current backend-reported payroll workflow state.</p></div>
            {latestStatus ? <StatusBadge status={latestStatus} /> : null}
          </div>
          {data?.latest_run_id ? (
            <><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Run reference</p><p className="mt-1 text-xl font-bold text-slate-900">{data.latest_run_id}</p></div><Link href={`/payroll/runs/${data.latest_run_id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:underline">Open payroll run <ArrowRight size={16} /></Link></>
          ) : <p className="text-sm text-slate-500">No payroll run is available for this institution yet.</p>}
        </section>

        <section className="rounded-xl border bg-white p-5">
          <div className="mb-5 flex items-center gap-2"><CheckCircle2 size={19} /><h2 className="font-semibold">Payroll Workflow</h2></div>
          <div className="space-y-3">{workflow.map((status, index) => <div key={status} className="flex items-center gap-3 rounded-lg border p-3"><span className={`h-2.5 w-2.5 rounded-full ${latestIndex >= index ? "bg-slate-900" : "bg-slate-300"}`} /><span className="text-sm font-medium">{status}</span></div>)}</div>
        </section>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <PayrollTrend points={data?.payroll_by_period ?? []} loading={loading} />
        <RunStatuses items={data?.runs_by_status ?? []} loading={loading} />
      </section>

    </main>
  );
}

function PayrollTrend({ points, loading }: { points: Array<{ label: string; gross_pay: string | number; net_pay: string | number; total_deductions: string | number }>; loading: boolean }) { if (loading) return <section className="rounded-2xl border bg-white p-6"><p className="text-sm text-slate-500">Loading payroll trend…</p></section>; if (!points.length) return <section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Payroll cost trend</h2><p className="mt-1 text-sm text-slate-500">Gross, net, and deductions will appear after a payroll run is finalized.</p></section>; const maximum = Math.max(...points.map((point) => Number(point.gross_pay)), 1); return <section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Payroll cost trend</h2><p className="mt-1 text-sm text-slate-500">Gross payroll by finalized pay period.</p><div className="mt-7 flex h-52 items-end gap-3">{points.map((point) => <div key={point.label} className="flex min-w-0 flex-1 flex-col justify-end gap-2"><span className="truncate text-center text-xs font-medium text-slate-600">{formatAmount(point.gross_pay)}</span><div className="rounded-t-lg bg-gradient-to-t from-amber-600 to-amber-300" style={{ height: `${Math.max((Number(point.gross_pay) / maximum) * 100, 4)}%` }} title={`${point.label}: gross ${formatAmount(point.gross_pay)}, net ${formatAmount(point.net_pay)}, deductions ${formatAmount(point.total_deductions)}`} /><span className="truncate text-center text-xs text-slate-500">{point.label}</span></div>)}</div></section>; }
function RunStatuses({ items, loading }: { items: Array<{ status: string; count: number }>; loading: boolean }) { if (loading) return <section className="rounded-2xl border bg-white p-6"><p className="text-sm text-slate-500">Loading payroll status…</p></section>; return <section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Run status</h2><p className="mt-1 text-sm text-slate-500">Payroll runs grouped by current workflow status.</p>{items.length ? <div className="mt-6 space-y-3">{items.map((item) => <div key={item.status} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="text-sm text-slate-600">{item.status.replaceAll("_", " ")}</span><span className="font-semibold text-slate-950">{formatNumber(item.count)}</span></div>)}</div> : <p className="mt-6 text-sm text-slate-500">No payroll runs are available yet.</p>}</section>; }
