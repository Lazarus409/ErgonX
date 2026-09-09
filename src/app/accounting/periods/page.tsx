"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";

const periods = [
  ["January 2026", "01 Jan 2026", "31 Jan 2026", "CLOSED"],
  ["February 2026", "01 Feb 2026", "28 Feb 2026", "CLOSED"],
  ["March 2026", "01 Mar 2026", "31 Mar 2026", "CLOSED"],
  ["April 2026", "01 Apr 2026", "30 Apr 2026", "CLOSED"],
  ["May 2026", "01 May 2026", "31 May 2026", "CLOSED"],
  ["June 2026", "01 Jun 2026", "30 Jun 2026", "CLOSED"],
  ["July 2026", "01 Jul 2026", "31 Jul 2026", "CLOSED"],
  ["August 2026", "01 Aug 2026", "31 Aug 2026", "OPEN"],
  ["September 2026", "01 Sep 2026", "30 Sep 2026", "OPEN"],
];

export default function AccountingPeriodsPage() {
  const [rows, setRows] = useState(periods);

  const toggle = (name: string) => {
    setRows((current) =>
      current.map((row) =>
        row[0] === name
          ? [row[0], row[1], row[2], row[3] === "OPEN" ? "CLOSED" : "OPEN"]
          : row
      )
    );
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="Accounting Periods"
        description="Manage fiscal periods and control when accounting entries can be posted."
      />

      <section className="rounded-2xl border bg-white p-5">
        <div className="mb-5 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold">Current Period</p>
          <p className="mt-1 text-lg font-bold">September 2026</p>
          <p className="text-sm text-slate-500">Status: OPEN</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="pb-3">Period</th>
                <th className="pb-3">Start</th>
                <th className="pb-3">End</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]} className="border-b last:border-0">
                  <td className="py-4 font-medium">{row[0]}</td>
                  <td className="py-4">{row[1]}</td>
                  <td className="py-4">{row[2]}</td>
                  <td className="py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                      {row[3]}
                    </span>
                  </td>
                  <td className="py-4">
                    <button
                      onClick={() => toggle(row[0])}
                      className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    >
                      {row[3] === "OPEN" ? "Close" : "Reopen"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-xs text-slate-500">
          Closed or locked periods must prevent posting. Reopening requires appropriate permission.
        </p>
      </section>
    </main>
  );
}