"use client";

import Link from "next/link";
import { ArrowLeft, Lock, RotateCcw } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

const lines = [
  ["5000 - Expenses", "Office equipment", "GHS 18,500", "—"],
  ["1110 - Main Bank Account", "Office equipment", "—", "GHS 18,500"],
];

export default function JournalDetailPage() {
  const posted = true;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Journal JV-2026-0090"
        description="Journal detail, approval and posting status."
        actions={
          <Link
            href="/accounting/journals"
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

      {posted && (
        <div className="flex items-center gap-3 rounded-2xl border bg-slate-50 p-4 text-sm">
          <Lock className="h-5 w-5" />
          <div>
            <p className="font-semibold">Posted journal is read-only</p>
            <p className="text-slate-500">
              Corrections should use a reversal or correcting journal.
            </p>
          </div>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Date", "29 Aug 2026"],
          ["Period", "August 2026"],
          ["Reference", "JV-2026-0090"],
          ["Status", "POSTED"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <div className="mt-2 font-semibold">
              {label === "Status" ? <StatusBadge status={value} /> : value}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Journal Lines</h2>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="pb-3">Account</th>
                <th className="pb-3">Description</th>
                <th className="pb-3">Debit</th>
                <th className="pb-3">Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line[0]} className="border-b last:border-0">
                  <td className="py-4 font-medium">{line[0]}</td>
                  <td className="py-4">{line[1]}</td>
                  <td className="py-4">{line[2]}</td>
                  <td className="py-4">{line[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Debit Total</p>
            <p className="mt-1 font-bold">GHS 18,500</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Credit Total</p>
            <p className="mt-1 font-bold">GHS 18,500</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Difference</p>
            <p className="mt-1 font-bold">GHS 0</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            disabled
            title="Posted journals cannot be edited"
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reverse Journal
          </button>
        </div>
      </section>
    </main>
  );
}