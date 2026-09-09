"use client";

import { Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const bills = [
  ["VND-001", "Ghana Office Supplies Ltd", "INV-4401", "GHS 18,500", "PENDING"],
  ["VND-002", "Accra Utilities", "UTL-0826", "GHS 9,840", "APPROVED"],
  ["VND-003", "Tech Solutions Ghana", "TS-2210", "GHS 42,300", "POSTED"],
];

export default function PayablesPage() {
  return (
    <main className="space-y-6">
      <PageHeader
        title="Accounts Payable"
        description="Manage vendors, vendor bills, approvals, posting and payments."
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" />
            New Vendor Bill
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Outstanding", "GHS 143,750"],
          ["Pending Approval", "GHS 28,400"],
          ["Due This Month", "GHS 61,200"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Vendor Bills</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="pb-3">Vendor</th>
                <th className="pb-3">Bill Number</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(([id, vendor, number, amount, status]) => (
                <tr key={id} className="border-b last:border-0">
                  <td className="py-4 font-medium">{vendor}</td>
                  <td className="py-4">{number}</td>
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