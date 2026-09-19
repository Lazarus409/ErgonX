"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, FileText, Lock, PlayCircle, WalletCards } from "lucide-react";

import ErrorState from "@/components/ui/ErrorState";
import KPIStatCard from "@/components/ui/KPIStatCard";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { dashboardsApi } from "@/lib/api";
import { EM_DASH, formatAmount, formatNumber } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const workflow = ["DRAFT", "CALCULATING", "CALCULATED", "UNDER_REVIEW", "APPROVED", "FINALIZED"];

const actions = [
  { title: "Payroll runs", description: "View calculation and approval history.", href: "/payroll/runs", icon: PlayCircle },
  { title: "Manage periods", description: "Open, close and review payroll periods.", href: "/payroll/periods", icon: CalendarDays },
  { title: "Payroll configuration", description: "Review country and payroll setup.", href: "/payroll/configuration", icon: FileText },
];

export default function PayrollDashboardPage() {
  const load = useCallback(() => dashboardsApi.getPayrollDashboard(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const placeholder = loading ? "…" : EM_DASH;
  const latestStatus = data?.latest_run_status ?? null;
  const latestIndex = latestStatus ? workflow.indexOf(latestStatus) : -1;

  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader title="Payroll Dashboard" description="Monitor payroll runs, approvals and finalisation." />
      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard title="Latest Run" value={latestStatus ?? placeholder} icon={<PlayCircle size={20} />} />
        <KPIStatCard title="Runs Awaiting Action" value={data ? formatNumber(data.pending_runs) : placeholder} icon={<Clock3 size={20} />} />
        <KPIStatCard title="Finalized Gross Pay" value={data ? formatAmount(data.finalized_gross_pay) : placeholder} icon={<WalletCards size={20} />} />
        <KPIStatCard title="Latest Run ID" value={data?.latest_run_id ?? placeholder} icon={<Lock size={20} />} />
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

      <section className="rounded-xl border bg-white p-5">
        <div className="flex items-center justify-between"><div><h2 className="font-semibold">Payroll Activity</h2><p className="text-sm text-slate-500">Recent run lists are available on the payroll-runs screen.</p></div><Link href="/payroll/runs" className="text-sm font-semibold hover:underline">View all</Link></div>
        <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">The dashboard API provides the latest run and aggregate counts; it does not expose a recent-runs feed or payroll breakdowns.</p>
      </section>

      <section><h2 className="mb-3 font-semibold">Quick Actions</h2><div className="grid gap-4 md:grid-cols-3">{actions.map((action) => { const Icon = action.icon; return <Link key={action.href} href={action.href} className="rounded-xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm"><Icon size={20} /><h3 className="mt-4 font-semibold">{action.title}</h3><p className="mt-1 text-sm text-slate-500">{action.description}</p></Link>; })}</div></section>
    </main>
  );
}
