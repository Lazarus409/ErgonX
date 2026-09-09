"use client";

import Link from "next/link";
import { Download, FileText } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const payslips = [
  {
    id: "ps-001",
    period: "August 2026",
    payDate: "31 Aug 2026",
    net: "GHS 6,880.00",
  },
  {
    id: "ps-000",
    period: "July 2026",
    payDate: "31 Jul 2026",
    net: "GHS 6,740.00",
  },
];

export default function MyPayslipsPage() {
  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="My Payslips"
        description="View your available payroll statements."
      />

      <section className="rounded-xl border bg-white">
        <div className="divide-y">
          {payslips.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-3">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="font-semibold">{item.period}</p>
                  <p className="text-sm text-slate-500">
                    Pay date: {item.payDate} · Net: {item.net}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/payroll/payslips/${item.id}`}
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                >
                  View
                </Link>
                <button
                  onClick={() =>
                    window.alert(
                      "The backend document reference will provide the actual payslip document.",
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
                >
                  <Download size={15} />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}