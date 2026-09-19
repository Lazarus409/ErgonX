"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, PlayCircle, Search } from "lucide-react";

import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { payrollApi } from "@/lib/api";
import { EM_DASH, formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { PayrollPeriod } from "@/types/payroll";

const ALL = "ALL";

export default function PayrollRunsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);

  const load = useCallback(
    () =>
      payrollApi.listPayrollRuns({
        page_size: MAX_PAGE_SIZE,
        status: status === ALL ? undefined : status,
        ordering: "-started_at",
      }),
    [status],
  );
  const { data, loading, error, reload } = useApiResource(load);

  useEffect(() => {
    let active = true;

    payrollApi
      .listPayrollPeriods({ page_size: MAX_PAGE_SIZE, ordering: "-start_date" })
      .then((page) => {
        if (active) setPeriods(page.results);
      })
      .catch(() => {
        if (active) setPeriods([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const periodNames = useMemo(
    () => new Map(periods.map((period) => [period.id, period.name])),
    [periods],
  );

  const runs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (data?.results ?? []).filter((run) => {
      const period = periodNames.get(run.payroll_period) ?? "";
      return !query || period.toLowerCase().includes(query) || String(run.run_number).includes(query);
    });
  }, [data, periodNames, search]);

  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Payroll Runs"
        description="Review payroll calculations, approvals and finalised runs."
        actions={<Link href="/payroll/periods" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><PlayCircle size={17} />Start From Period</Link>}
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <section className="rounded-xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
          <div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by period or run number..." className="w-full rounded-lg border px-10 py-2.5 text-sm" /></div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border px-3 py-2.5 text-sm">
            <option value={ALL}>All Statuses</option>
            {['DRAFT', 'CALCULATING', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'FINALIZED', 'CANCELLED'].map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Period</th><th className="px-4 py-3">Run Number</th><th className="px-4 py-3">Started</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y">{runs.map((run) => <tr key={run.id} className="hover:bg-slate-50"><td className="px-4 py-4 font-semibold">{periodNames.get(run.payroll_period) ?? EM_DASH}</td><td className="px-4 py-4">#{run.run_number}</td><td className="px-4 py-4">{formatDateTime(run.started_at)}</td><td className="px-4 py-4"><StatusBadge status={run.status} /></td><td className="px-4 py-4 text-right"><Link href={`/payroll/runs/${run.id}`} className="inline-flex rounded-lg border p-2 hover:bg-slate-100"><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div>

        <div className="divide-y md:hidden">{runs.map((run) => <Link key={run.id} href={`/payroll/runs/${run.id}`} className="block space-y-2 p-4 hover:bg-slate-50"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{periodNames.get(run.payroll_period) ?? EM_DASH}</p><p className="mt-1 text-xs text-slate-500">Run #{run.run_number} · {formatDateTime(run.started_at)}</p></div><StatusBadge status={run.status} /></div></Link>)}</div>

        {!loading && runs.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No payroll runs found.</div>}
        {loading && <div className="p-10 text-center text-sm text-slate-500">Loading payroll runs...</div>}
      </section>
    </main>
  );
}
