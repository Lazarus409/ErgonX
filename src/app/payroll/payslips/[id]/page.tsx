"use client";

import Link from "next/link";
import { ArrowLeft, Download, FileText, Lock } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function PayslipDetailPage() {
  return (
    <main className="space-y-6 p-4 md:p-6">
      <Link
        href="/payroll/payslips"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back to Payslips
      </Link>

      <PageHeader
        title="Payslip — August 2026"
        description="Employee payroll statement generated from a finalised payroll run."
        actions={
          <button
            onClick={() =>
              window.alert(
                "The backend document reference will provide the actual payslip document.",
              )
            }
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Download size={16} />
            Download
          </button>
        }
      />

      <section className="mx-auto max-w-4xl rounded-xl border bg-white">
        <div className="border-b p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row">
            <div>
              <div className="flex items-center gap-2">
                <FileText size={20} />
                <h2 className="text-lg font-bold">ErgonX</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">Employee Payslip</p>
            </div>

            <div className="text-left text-sm sm:text-right">
              <p className="font-semibold">August 2026</p>
              <p className="text-slate-500">Pay Date: 31 Aug 2026</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 border-b p-6 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Employee</p>
            <p className="mt-1 font-semibold">Kwame Mensah</p>
            <p className="text-sm text-slate-500">EMP-001</p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Department</p>
            <p className="mt-1 font-semibold">Information Technology</p>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <div>
            <h3 className="mb-3 font-semibold">Earnings</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Basic Salary</span>
                <span>GHS 7,000.00</span>
              </div>
              <div className="flex justify-between">
                <span>Housing Allowance</span>
                <span>GHS 1,000.00</span>
              </div>
              <div className="flex justify-between">
                <span>Transport Allowance</span>
                <span>GHS 500.00</span>
              </div>
            </div>

            <div className="mt-4 flex justify-between border-t pt-3 font-bold">
              <span>Gross Pay</span>
              <span>GHS 8,500.00</span>
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Deductions</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>PAYE</span>
                <span>GHS 1,120.00</span>
              </div>
              <div className="flex justify-between">
                <span>SSNIT / Tier 1</span>
                <span>GHS 500.00</span>
              </div>
            </div>

            <div className="mt-4 flex justify-between border-t pt-3 font-bold">
              <span>Total Deductions</span>
              <span>GHS 1,620.00</span>
            </div>
          </div>
        </div>

        <div className="m-6 rounded-xl bg-slate-900 p-5 text-white">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Net Pay</span>
            <span className="text-2xl font-bold">GHS 6,880.00</span>
          </div>
        </div>

        <div className="border-t p-5">
          <div className="flex gap-3 text-sm text-slate-500">
            <Lock size={17} className="shrink-0" />
            <p>
              This payslip is generated from a finalised payroll record.
              Historical payroll data is immutable.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}