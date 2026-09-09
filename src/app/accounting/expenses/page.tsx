"use client";

import { Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const expenses = [
  ["EXP-001", "Office Equipment", "GHS 18,500", "APPROVED"],
  ["EXP-002", "Internet Services", "GHS 4,200", "PENDING"],
  ["EXP-003", "Transport", "GHS 2,850", "POSTED"],
];

export default function ExpensesPage() {
  return (
    <main className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Create, approve and post institutional expenses."
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" />
            New Expense
          </button>
        }
      />

      <section className="rounded-2xl border bg-white p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="pb-3">Reference</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense[0]} className="border-b last:border-0">
                  <td className="py-4 font-medium">{expense[0]}</td>
                  <td className="py-4">{expense[1]}</td>
                  <td className="py-4 font-semibold">{expense[2]}</td>
                  <td className="py-4">{expense[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}