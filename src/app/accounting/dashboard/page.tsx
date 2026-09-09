"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CircleAlert,
  FileText,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import KPIStatCard from "@/components/ui/KPIStatCard";
import StatusBadge from "@/components/ui/StatusBadge";

const kpis = [
  { title: "Bank / Cash", value: "GHS 842,500", icon: Banknote },
  { title: "Accounts Receivable", value: "GHS 218,400", icon: TrendingUp },
  { title: "Accounts Payable", value: "GHS 143,750", icon: TrendingDown },
  { title: "Revenue", value: "GHS 1.84M", icon: Wallet },
  { title: "Expenses", value: "GHS 1.21M", icon: Receipt },
  { title: "Profit / Loss", value: "GHS 630K", icon: TrendingUp },
  { title: "Unposted Journals", value: "8", icon: FileText },
  { title: "Pending Approvals", value: "5", icon: CircleAlert },
];

const recent = [
  ["JV-2026-0091", "Payroll Journal - August", "GHS 486,200", "UNDER_REVIEW"],
  ["JV-2026-0090", "Office Equipment", "GHS 18,500", "APPROVED"],
  ["JV-2026-0089", "Utility Expense", "GHS 9,840", "DRAFT"],
  ["JV-2026-0088", "Bank Charges", "GHS 1,240", "POSTED"],
];

export default function AccountingDashboard() {
  return (
    <main className="space-y-6">
      <PageHeader
        title="Accounting Dashboard"
        description="Financial position, accounting workflow and items requiring attention."
        actions={
          <Link
            href="/accounting/journals/new"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New Journal
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <KPIStatCard
            key={item.title}
            title={item.title}
            value={item.value}
            icon={<item.icon className="h-5 w-5" />}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Recent Journals</h2>
              <p className="text-sm text-slate-500">Latest accounting activity.</p>
            </div>
            <Link href="/accounting/journals" className="text-sm font-semibold text-slate-700">
              View all
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
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
                {recent.map(([ref, description, amount, status]) => (
                  <tr key={ref} className="border-b last:border-0">
                    <td className="py-4 font-medium">{ref}</td>
                    <td className="py-4">{description}</td>
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

        <section className="rounded-2xl border bg-white p-5">
          <h2 className="font-semibold text-slate-900">Quick Actions</h2>
          <div className="mt-4 space-y-2">
            {[
              ["New Journal", "/accounting/journals/new"],
              ["New Vendor Bill", "/accounting/payables"],
              ["Create Invoice", "/accounting/receivables"],
              ["Record Payment", "/accounting/banking"],
              ["Record Receipt", "/accounting/banking"],
              ["Review Payroll Posting", "/accounting/journals"],
              ["View General Ledger", "/accounting/reports"],
              ["Close Period", "/accounting/periods"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium hover:bg-slate-50"
              >
                {label}
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold text-slate-900">Ghana Tax & Compliance</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["VAT Liability", "NHIL Liability", "GETFund Liability", "Withholding Tax"].map(
            (item, index) => (
              <div key={item} className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">{item}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  GHS {[84200, 42100, 42100, 18650][index].toLocaleString()}
                </p>
              </div>
            )
          )}
        </div>
      </section>
    </main>
  );
}