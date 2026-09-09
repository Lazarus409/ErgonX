"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  CreditCard,
  FileBarChart,
  Landmark,
  Receipt,
  Settings,
  WalletCards,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const items = [
  {
    title: "Accounting Dashboard",
    description: "Monitor cash, receivables, payables, journals, profit and tax liabilities.",
    href: "/accounting/dashboard",
    icon: BarChart3,
  },
  {
    title: "Chart of Accounts",
    description: "Manage the institution's accounting structure and account hierarchy.",
    href: "/accounting/chart-of-accounts",
    icon: BookOpen,
  },
  {
    title: "Journals",
    description: "Create, review, approve and post accounting journals.",
    href: "/accounting/journals",
    icon: Receipt,
  },
  {
    title: "Accounting Periods",
    description: "Manage fiscal years and accounting period status.",
    href: "/accounting/periods",
    icon: Calculator,
  },
  {
    title: "Accounts Payable",
    description: "Manage vendors, bills and supplier payments.",
    href: "/accounting/payables",
    icon: CreditCard,
  },
  {
    title: "Accounts Receivable",
    description: "Manage customers, invoices and receipts.",
    href: "/accounting/receivables",
    icon: WalletCards,
  },
  {
    title: "Banking & Cash",
    description: "Manage bank accounts and payment or receipt references.",
    href: "/accounting/banking",
    icon: Landmark,
  },
  {
    title: "Expenses",
    description: "Create, approve and post institutional expenses.",
    href: "/accounting/expenses",
    icon: Building2,
  },
  {
    title: "Financial Reports",
    description: "View the General Ledger, Trial Balance, P&L, Balance Sheet and aging reports.",
    href: "/accounting/reports",
    icon: FileBarChart,
  },
  {
    title: "Ghana Accounting Setup",
    description: "Configure Ghana accounting presets, taxes and compliance settings.",
    href: "/accounting/ghana-setup",
    icon: Settings,
  },
];

export default function AccountingPage() {
  return (
    <main className="space-y-6">
      <PageHeader
        title="Accounting"
        description="Manage the institution's financial records, journals, payables, receivables and reports."
      />

      <div className="rounded-2xl border bg-gradient-to-r from-slate-50 to-white p-5">
        <p className="text-sm font-semibold text-slate-900">Accounting workflow</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          {["Chart of Accounts", "Journals", "Approval", "Posting", "Reports"].map(
            (step, index) => (
              <div key={step} className="flex items-center gap-2">
                <span className="rounded-lg border bg-white px-3 py-2 font-medium">
                  {step}
                </span>
                {index < 4 && <ArrowRight className="h-4 w-4" />}
              </div>
            )
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-slate-100 p-3">
                  <Icon className="h-5 w-5 text-slate-700" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-700" />
              </div>

              <h2 className="mt-5 text-base font-semibold text-slate-900">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {item.description}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}