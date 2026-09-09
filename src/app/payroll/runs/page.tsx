"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, PlayCircle, Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

const runs = [
  {
    id: "run-2026-09",
    period: "September 2026",
    employees: 100,
    gross: "GHS 691,800.00",
    deductions: "GHS 127,080.00",
    net: "GHS 564,720.00",
    created: "13 Sep 2026",
    status: "UNDER_REVIEW",
  },
  {
    id: "run-2026-09-draft",
    period: "September 2026 - Adjustment",
    employees: 12,
    gross: "GHS 42,600.00",
    deductions: "GHS 7,800.00",
    net: "GHS 34,800.00",
    created: "12 Sep 2026",
    status: "DRAFT",
  },
  {
    id: "run-2026-08",
    period: "August 2026",
    employees: 100,
    gross: "GHS 684,250.00",
    deductions: "GHS 125,820.00",
    net: "GHS 558,430.00",
    created: "31 Aug 2026",
    status: "FINALIZED",
  },
  {
    id: "run-2026-07",
    period: "July 2026",
    employees: 98,
    gross: "GHS 671,400.00",
    deductions: "GHS 122,900.00",
    net: "GHS 548,500.00",
    created: "31 Jul 2026",
    status: "FINALIZED",
  },
];

export default function PayrollRunsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return runs.filter((run) => {
      const matchesSearch =
        !query || run.period.toLowerCase().includes(query);

      const matchesStatus =
        status === "ALL" || run.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [search, status]);

  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Payroll Runs"
        description="Review payroll calculations, approvals and finalised runs."
        actions={
          <Link
            href="/payroll/periods"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <PlayCircle size={17} />
            Start From Period
          </Link>
        }
      />

      <section className="rounded-xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payroll runs..."
              className="w-full rounded-lg border px-10 py-2.5 text-sm"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="CALCULATING">Calculating</option>
            <option value="CALCULATED">Calculated</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="FINALIZED">Finalized</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Employees</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Deductions</th>
                <th className="px-4 py-3">Net</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold">{run.period}</td>
                  <td className="px-4 py-4">{run.employees}</td>
                  <td className="px-4 py-4">{run.gross}</td>
                  <td className="px-4 py-4">{run.deductions}</td>
                  <td className="px-4 py-4 font-medium">{run.net}</td>
                  <td className="px-4 py-4">{run.created}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/payroll/runs/${run.id}`}
                      className="inline-flex rounded-lg border p-2 hover:bg-slate-100"
                    >
                      <ArrowRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y md:hidden">
          {filtered.map((run) => (
            <Link
              key={run.id}
              href={`/payroll/runs/${run.id}`}
              className="block space-y-3 p-4 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{run.period}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {run.employees} employees · {run.created}
                  </p>
                </div>
                <StatusBadge status={run.status} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <span>Gross: {run.gross}</span>
                <span>Deductions: {run.deductions}</span>
                <span>Net: {run.net}</span>
              </div>
            </Link>
          ))}
        </div>

        {!filtered.length && (
          <div className="p-10 text-center text-sm text-slate-500">
            No payroll runs found.
          </div>
        )}
      </section>
    </main>
  );
}