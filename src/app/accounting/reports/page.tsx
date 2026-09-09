"use client";

import { FileBarChart } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const reports = [
  ["General Ledger", "Detailed posted transactions by account."],
  ["Trial Balance", "Debit and credit balances across the chart of accounts."],
  ["Income Statement", "Revenue, expenses and profit or loss."],
  ["Balance Sheet", "Assets, liabilities and equity."],
  ["AP Aging", "Outstanding vendor balances by age."],
  ["AR Aging", "Outstanding customer balances by age."],
];

export default function AccountingReportsPage() {
  return (
    <main className="space-y-6">
      <PageHeader
        title="Financial Reports"
        description="Filterable and permission-aware accounting reports for the active institution."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map(([title, description]) => (
          <button
            key={title}
            className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="rounded-xl bg-slate-100 p-3 w-fit">
              <FileBarChart className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </button>
        ))}
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Report Filters</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input type="date" className="rounded-xl border p-2.5 text-sm" />
          <input type="date" className="rounded-xl border p-2.5 text-sm" />
          <select className="rounded-xl border p-2.5 text-sm">
            <option>All Departments</option>
          </select>
          <select className="rounded-xl border p-2.5 text-sm">
            <option>All Locations</option>
          </select>
        </div>
      </section>
    </main>
  );
}