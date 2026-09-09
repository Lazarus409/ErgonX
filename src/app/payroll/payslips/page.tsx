"use client";

import Link from "next/link";
import { Search, FileText, Download } from "lucide-react";
import { useMemo, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

const payslips = [
  {
    id: "ps-001",
    employee: "Kwame Mensah",
    employeeNumber: "EMP-001",
    period: "August 2026",
    gross: "GHS 8,500.00",
    deductions: "GHS 1,620.00",
    net: "GHS 6,880.00",
    status: "FINALIZED",
  },
  {
    id: "ps-002",
    employee: "Ama Owusu",
    employeeNumber: "EMP-002",
    period: "August 2026",
    gross: "GHS 7,800.00",
    deductions: "GHS 1,430.00",
    net: "GHS 6,370.00",
    status: "FINALIZED",
  },
  {
    id: "ps-003",
    employee: "Daniel Asare",
    employeeNumber: "EMP-003",
    period: "August 2026",
    gross: "GHS 6,400.00",
    deductions: "GHS 1,120.00",
    net: "GHS 5,280.00",
    status: "FINALIZED",
  },
];

export default function PayrollPayslipsPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return payslips.filter(
      (item) =>
        !query ||
        item.employee.toLowerCase().includes(query) ||
        item.employeeNumber.toLowerCase().includes(query) ||
        item.period.toLowerCase().includes(query),
    );
  }, [search]);

  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Payslips"
        description="View employee payslips generated from completed payroll runs."
      />

      <section className="rounded-xl border bg-white">
        <div className="border-b p-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee or payroll period..."
              className="w-full rounded-lg border px-10 py-2.5 text-sm"
            />
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Deductions</th>
                <th className="px-4 py-3">Net Pay</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <p className="font-medium">{item.employee}</p>
                    <p className="text-xs text-slate-500">
                      {item.employeeNumber}
                    </p>
                  </td>
                  <td className="px-4 py-4">{item.period}</td>
                  <td className="px-4 py-4">{item.gross}</td>
                  <td className="px-4 py-4">{item.deductions}</td>
                  <td className="px-4 py-4 font-semibold">{item.net}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/payroll/payslips/${item.id}`}
                        className="rounded-lg border p-2 hover:bg-slate-100"
                        title="View payslip"
                      >
                        <FileText size={16} />
                      </Link>

                      <button
                        className="rounded-lg border p-2 text-slate-500 hover:bg-slate-100"
                        title="Download reference"
                        onClick={() =>
                          window.alert(
                            "Document download will use the backend document reference when connected.",
                          )
                        }
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y md:hidden">
          {filtered.map((item) => (
            <div key={item.id} className="space-y-3 p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.employee}</p>
                  <p className="text-xs text-slate-500">
                    {item.employeeNumber} · {item.period}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <span>Gross: {item.gross}</span>
                <span>Deductions: {item.deductions}</span>
                <span className="font-semibold">Net: {item.net}</span>
              </div>

              <Link
                href={`/payroll/payslips/${item.id}`}
                className="block rounded-lg border px-3 py-2 text-center text-sm font-medium"
              >
                View Payslip
              </Link>
            </div>
          ))}
        </div>

        {!filtered.length && (
          <div className="p-10 text-center text-sm text-slate-500">
            No payslips found.
          </div>
        )}
      </section>
    </main>
  );
}