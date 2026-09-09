"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

const journals = [
  ["JV-2026-0091", "Payroll Journal - August", "2026-08-31", "GHS 486,200", "UNDER_REVIEW"],
  ["JV-2026-0090", "Office Equipment", "2026-08-29", "GHS 18,500", "APPROVED"],
  ["JV-2026-0089", "Utility Expense", "2026-08-28", "GHS 9,840", "DRAFT"],
  ["JV-2026-0088", "Bank Charges", "2026-08-27", "GHS 1,240", "POSTED"],
];

export default function JournalsPage() {
  return (
    <main className="space-y-6">
      <PageHeader
        title="Journals"
        description="Create, review, approve, post and reverse accounting journals."
        actions={
          <Link
            href="/accounting/journals/new"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            New Journal
          </Link>
        }
      />

      <section className="rounded-2xl border bg-white p-5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            placeholder="Search reference or description..."
            className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm"
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[750px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="pb-3">Reference</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {journals.map(([ref, description, date, amount, status]) => (
                <tr key={ref} className="border-b last:border-0">
                  <td className="py-4">
                    <Link
                      href={`/accounting/journals/${ref}`}
                      className="font-semibold hover:underline"
                    >
                      {ref}
                    </Link>
                  </td>
                  <td className="py-4">{description}</td>
                  <td className="py-4">{date}</td>
                  <td className="py-4 font-medium">{amount}</td>
                  <td className="py-4">
                    <StatusBadge status={status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}