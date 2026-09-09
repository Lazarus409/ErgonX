"use client";

import { Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const accounts = [
  ["BANK-001", "Main Bank Account", "GHS", "GHS 710,200", "ACTIVE"],
  ["BANK-002", "Payroll Account", "GHS", "GHS 94,500", "ACTIVE"],
  ["BANK-003", "Petty Cash", "GHS", "GHS 37,800", "ACTIVE"],
];

export default function BankingPage() {
  return (
    <main className="space-y-6">
      <PageHeader
        title="Banking & Cash"
        description="Manage bank accounts and payment or receipt references."
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" />
            Add Bank Account
          </button>
        }
      />

      <section className="rounded-2xl border bg-white p-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="pb-3">Code</th>
                <th className="pb-3">Account</th>
                <th className="pb-3">Currency</th>
                <th className="pb-3">Balance</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account[0]} className="border-b last:border-0">
                  <td className="py-4 font-medium">{account[0]}</td>
                  <td className="py-4">{account[1]}</td>
                  <td className="py-4">{account[2]}</td>
                  <td className="py-4 font-semibold">{account[3]}</td>
                  <td className="py-4">{account[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}