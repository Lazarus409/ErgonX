"use client";

import { Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const invoices = [
  ["INV-2026-110", "ABC University", "GHS 85,000", "PAID"],
  ["INV-2026-111", "North Campus Services", "GHS 42,500", "ISSUED"],
  ["INV-2026-112", "Student Services Unit", "GHS 18,200", "OVERDUE"],
];

export default function ReceivablesPage() {
  return (
    <main className="space-y-6">
      <PageHeader
        title="Accounts Receivable"
        description="Manage customers, invoices, receipts and payment status."
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" />
            Create Invoice
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Outstanding", "GHS 218,400"],
          ["Collected This Month", "GHS 132,500"],
          ["Overdue", "GHS 31,200"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Invoices</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="pb-3">Invoice</th>
                <th className="pb-3">Customer</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(([invoice, customer, amount, status]) => (
                <tr key={invoice} className="border-b last:border-0">
                  <td className="py-4 font-medium">{invoice}</td>
                  <td className="py-4">{customer}</td>
                  <td className="py-4 font-semibold">{amount}</td>
                  <td className="py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                      {status}
                    </span>
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