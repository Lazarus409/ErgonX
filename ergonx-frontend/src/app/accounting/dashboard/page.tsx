"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowRight, CircleAlert, FileText, Plus, Receipt, TrendingDown, TrendingUp } from "lucide-react";

import ErrorState from "@/components/ui/ErrorState";
import KPIStatCard from "@/components/ui/KPIStatCard";
import PageHeader from "@/components/ui/PageHeader";
import { dashboardsApi } from "@/lib/api";
import { EM_DASH, formatAmount, formatNumber } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { useAuth } from "@/components/guards/AuthProvider";

const actions = [
  ["New Journal", "/accounting/journals/new"],
  ["New Vendor Bill", "/accounting/payables"],
  ["Create Invoice", "/accounting/receivables"],
  ["Record Payment", "/accounting/banking"],
  ["Close Period", "/accounting/periods"],
] as const;

export default function AccountingDashboard() {
  const { user } = useAuth();
  const load = useCallback(() => dashboardsApi.getFinanceDashboard(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const placeholder = loading ? "…" : EM_DASH;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Accounting Dashboard"
        description="Financial operations and items requiring attention."
        actions={<Link href="/accounting/journals/new" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" />New Journal</Link>}
      />

      <section className="rounded-2xl bg-slate-950 p-6 text-white sm:p-8"><p className="text-sm font-medium text-slate-300">Accounting workspace</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.firstName ?? "there"}.</h2><p className="mt-2 text-sm text-slate-300">Review financial operations, approvals, and period controls that need your attention.</p></section>

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard title="Accounts Receivable" value={data ? formatAmount(data.accounts_receivable) : placeholder} icon={<TrendingUp className="h-5 w-5" />} />
        <KPIStatCard title="Accounts Payable" value={data ? formatAmount(data.accounts_payable) : placeholder} icon={<TrendingDown className="h-5 w-5" />} />
        <KPIStatCard title="Posted Expenses" value={data ? formatAmount(data.expenses) : placeholder} icon={<Receipt className="h-5 w-5" />} />
        <KPIStatCard title="Pending Journals" value={data ? formatNumber(data.pending_journals) : placeholder} icon={<FileText className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Financial Operations</h2><p className="text-sm text-slate-500">Tenant-scoped operational totals from the finance dashboard.</p></div><Link href="/accounting/reports" className="text-sm font-semibold text-slate-700">View reports</Link></div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">Open receivables</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{data ? formatAmount(data.accounts_receivable) : placeholder}</dd></div>
            <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">Open payables</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{data ? formatAmount(data.accounts_payable) : placeholder}</dd></div>
            <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">Posted expenses</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{data ? formatAmount(data.expenses) : placeholder}</dd></div>
            <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs text-slate-500">Journals awaiting review</dt><dd className="mt-1 text-xl font-semibold text-slate-900">{data ? formatNumber(data.pending_journals) : placeholder}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold text-slate-900">Quick Actions</h2><div className="mt-4 space-y-2">{actions.map(([label, href]) => <Link key={label} href={href} className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium hover:bg-slate-50">{label}<ArrowRight className="h-4 w-4 text-slate-400" /></Link>)}</div></section>
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 text-slate-500" /><div><h2 className="font-semibold text-slate-900">Journal and Compliance Detail</h2><p className="mt-1 text-sm text-slate-500">The finance dashboard does not expose recent-journal rows, bank/cash balances, revenue, profit/loss, or Ghana tax liabilities. These remain available only where supported by their dedicated screens and reports.</p></div></div>
      </section>
    </main>
  );
}
