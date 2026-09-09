"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type PayrollPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  payDate: string;
  status: "OPEN" | "PROCESSING" | "CLOSED";
  runs: number;
};

const initialPeriods: PayrollPeriod[] = [
  {
    id: "period-2026-09",
    name: "September 2026",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    payDate: "2026-09-30",
    status: "PROCESSING",
    runs: 2,
  },
  {
    id: "period-2026-08",
    name: "August 2026",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    payDate: "2026-08-31",
    status: "CLOSED",
    runs: 1,
  },
  {
    id: "period-2026-10",
    name: "October 2026",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    payDate: "2026-10-30",
    status: "OPEN",
    runs: 0,
  },
];

export default function PayrollPeriodsPage() {
  const [periods, setPeriods] = useState(initialPeriods);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return periods.filter((period) => {
      const matchesSearch =
        !query || period.name.toLowerCase().includes(query);

      const matchesStatus =
        status === "ALL" || period.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [periods, search, status]);

  const createPeriod = () => {
    const name = window.prompt("Enter payroll period name");

    if (!name?.trim()) return;

    const newPeriod: PayrollPeriod = {
      id: `period-${Date.now()}`,
      name,
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      payDate: "2026-11-30",
      status: "OPEN",
      runs: 0,
    };

    setPeriods((items) => [newPeriod, ...items]);
  };

  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Payroll Periods"
        description="Manage payroll periods and their processing status."
        actions={
          <button
            onClick={createPeriod}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={17} />
            New Period
          </button>
        }
      />

      <section className="rounded-xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payroll periods..."
              className="w-full rounded-lg border px-10 py-2.5 text-sm"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="PROCESSING">Processing</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Pay Date</th>
                <th className="px-4 py-3">Runs</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((period) => (
                <tr key={period.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-semibold">{period.name}</td>
                  <td className="px-4 py-4">{period.startDate}</td>
                  <td className="px-4 py-4">{period.endDate}</td>
                  <td className="px-4 py-4">{period.payDate}</td>
                  <td className="px-4 py-4">{period.runs}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={period.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y md:hidden">
          {filtered.map((period) => (
            <div key={period.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{period.name}</p>
                  <p className="text-xs text-slate-500">
                    Pay date: {period.payDate}
                  </p>
                </div>
                <StatusBadge status={period.status} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <span>Start: {period.startDate}</span>
                <span>End: {period.endDate}</span>
                <span>Runs: {period.runs}</span>
              </div>
            </div>
          ))}
        </div>

        {!filtered.length && (
          <div className="p-10 text-center text-sm text-slate-500">
            No payroll periods found.
          </div>
        )}
      </section>

      <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
        <div className="flex gap-3">
          <CalendarDays size={18} className="shrink-0" />
          <p>
            Period dates and payroll processing status are controlled by the
            payroll backend when the API is connected.
          </p>
        </div>
      </div>
    </main>
  );
}