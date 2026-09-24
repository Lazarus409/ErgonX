"use client";

import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  FileCog,
  FileText,
  GitPullRequest,
  IdCard,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

const payrollPages = [
  {
    title: "Payroll Dashboard",
    description: "View payroll KPIs, current runs, workflow status and recent activity.",
    href: "/payroll/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Pay Components",
    description: "Manage earnings, deductions and employer contribution components.",
    href: "/payroll/components",
    icon: Banknote,
  },
  {
    title: "Salary Structures",
    description: "Create salary structures and associate approved pay components.",
    href: "/payroll/salary-structures",
    icon: WalletCards,
  },
  {
    title: "Payroll Periods",
    description: "Manage payroll periods, dates and processing status.",
    href: "/payroll/periods",
    icon: CalendarDays,
  },
  {
    title: "Payroll Runs",
    description: "Review payroll calculations, approvals and finalised runs.",
    href: "/payroll/runs",
    icon: GitPullRequest,
  },
  {
    title: "Payroll Adjustments",
    description: "Create, review and approve payroll adjustments.",
    href: "/payroll/adjustments",
    icon: FileCog,
  },
  {
    title: "Payslips",
    description: "View and access employee payslips generated from payroll runs.",
    href: "/payroll/payslips",
    icon: FileText,
  },
  {
    title: "Payroll Configuration",
    description: "Configure institution-level payroll settings and mappings.",
    href: "/payroll/configuration",
    icon: Settings,
  },
  {
    title: "Employee Payroll Profiles",
    description: "Maintain employee tax residency and tax identifiers used by payroll policy.",
    href: "/payroll/employee-profiles",
    icon: IdCard,
  },
  {
    title: "Ghana Payroll Setup",
    description: "Configure the institution's Ghana payroll preset or custom setup.",
    href: "/payroll/ghana-setup",
    icon: ShieldCheck,
  },
];

export default function PayrollPage() {
  return (
    <main className="space-y-8 p-4 md:p-6">
      <section>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">ERgonX Module</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Payroll
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 md:text-base">
              Manage payroll configuration, salary structures, payroll
              periods, payroll runs, adjustments and payslips.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Payroll Navigation
          </h2>
          <p className="text-sm text-slate-500">
            Select an area below to continue.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {payrollPages.map((page) => {
            const Icon = page.icon;

            return (
              <Link
                key={page.href}
                href={page.href}
                className="group rounded-xl border bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-lg bg-slate-100 p-3">
                    <Icon
                      size={21}
                      className="text-slate-700"
                    />
                  </div>

                  <ArrowRight
                    size={18}
                    className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-700"
                  />
                </div>

                <h3 className="mt-5 font-semibold text-slate-900">
                  {page.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {page.description}
                </p>

                <div className="mt-4 text-sm font-medium text-slate-700">
                  Open {page.title}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border bg-slate-50 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Current Payroll Workflow
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Payroll follows the controlled processing lifecycle.
            </p>
          </div>

          <Link
            href="/payroll/runs"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            View Payroll Runs
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-medium">
          {[
            "DRAFT",
            "CALCULATING",
            "CALCULATED",
            "UNDER_REVIEW",
            "APPROVED",
            "FINALIZED",
          ].map((status, index, items) => (
            <div key={status} className="flex items-center gap-2">
              <span className="rounded-full border bg-white px-3 py-1.5">
                {status}
              </span>

              {index < items.length - 1 && (
                <ArrowRight size={14} className="text-slate-400" />
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
