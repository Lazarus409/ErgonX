"use client";

import Link from "next/link";
import { ArrowLeft, Calculator, CheckCircle2, Lock, XCircle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import PayrollAccountingPosting from "@/components/payroll/PayrollAccountingPosting";

const employees = [
  ["EMP-0001", "Kwame Mensah", "GHS 12,500", "GHS 1,840", "GHS 10,660"],
  ["EMP-0002", "Ama Boateng", "GHS 9,800", "GHS 1,240", "GHS 8,560"],
  ["EMP-0003", "Daniel Owusu", "GHS 8,500", "GHS 1,020", "GHS 7,480"],
];

export default function PayrollRunDetailPage() {
  const status = "UNDER_REVIEW";
  const finalized = status === "FINALIZED";

  return (
    <main className="space-y-6">
      <PageHeader
        title="Payroll Run PR-2026-008"
        description="Review payroll results, workflow status and accounting posting."
        actions={
          <Link
            href="/payroll/runs"
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ["Period", "August 2026"],
          ["Employees", "142"],
          ["Gross Pay", "GHS 1.42M"],
          ["Deductions", "GHS 248,400"],
          ["Net Pay", "GHS 1.17M"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 font-bold">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Payroll Workflow</h2>
            <p className="mt-1 text-sm text-slate-500">
              Payroll lifecycle status for this run.
            </p>
          </div>

          <StatusBadge status={status} />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-7">
          {[
            "DRAFT",
            "CALCULATING",
            "CALCULATED",
            "UNDER_REVIEW",
            "APPROVED",
            "FINALIZED",
          ].map((step) => (
            <div
              key={step}
              className={`rounded-xl border p-3 text-center text-xs font-semibold ${
                step === status ? "bg-slate-900 text-white" : "bg-slate-50"
              }`}
            >
              {step.replace("_", " ")}
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            disabled={finalized}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            <Calculator className="h-4 w-4" />
            Recalculate
          </button>

          <button
            disabled={finalized}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </button>

          <button
            disabled={finalized}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            <XCircle className="h-4 w-4" />
            Cancel Run
          </button>
        </div>
      </section>

      <PayrollAccountingPosting />

      <section className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Employee Payroll Results</h2>
            <p className="mt-1 text-sm text-slate-500">
              Payroll results for employees included in this run.
            </p>
          </div>

          {finalized && (
            <span className="inline-flex items-center gap-2 text-xs font-semibold">
              <Lock className="h-4 w-4" />
              Read-only
            </span>
          )}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="pb-3">Employee</th>
                <th className="pb-3">Name</th>
                <th className="pb-3">Gross</th>
                <th className="pb-3">Deductions</th>
                <th className="pb-3">Net Pay</th>
              </tr>
            </thead>

            <tbody>
              {employees.map((employee) => (
                <tr key={employee[0]} className="border-b last:border-0">
                  <td className="py-4 font-medium">{employee[0]}</td>
                  <td className="py-4">{employee[1]}</td>
                  <td className="py-4">{employee[2]}</td>
                  <td className="py-4">{employee[3]}</td>
                  <td className="py-4 font-semibold">{employee[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}