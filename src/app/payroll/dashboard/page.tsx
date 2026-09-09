"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Lock,
  PlayCircle,
  WalletCards,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import KPIStatCard from "@/components/ui/KPIStatCard";
import StatusBadge from "@/components/ui/StatusBadge";

const recentRuns = [
  {
    id: "run-2026-08",
    period: "August 2026",
    employees: 100,
    gross: "GHS 684,250.00",
    net: "GHS 558,430.00",
    status: "FINALIZED",
  },
  {
    id: "run-2026-09",
    period: "September 2026",
    employees: 100,
    gross: "GHS 691,800.00",
    net: "GHS 564,720.00",
    status: "UNDER_REVIEW",
  },
  {
    id: "run-2026-09-draft",
    period: "September 2026 - Adjustment",
    employees: 12,
    gross: "GHS 42,600.00",
    net: "GHS 34,800.00",
    status: "DRAFT",
  },
];

const actions = [
  {
    title: "Review payroll run",
    description: "Review the current payroll before approval.",
    href: "/payroll/runs/run-2026-09",
    icon: FileText,
  },
  {
    title: "Manage periods",
    description: "Open, close and review payroll periods.",
    href: "/payroll/periods",
    icon: CalendarDays,
  },
  {
    title: "Payroll runs",
    description: "View payroll calculation and approval history.",
    href: "/payroll/runs",
    icon: PlayCircle,
  },
];

export default function PayrollDashboardPage() {
  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Payroll Dashboard"
        description="Monitor payroll periods, runs, approvals and finalisation."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard
          title="Current Period"
          value="September 2026"
          icon={<CalendarDays size={20} />}
        />
        <KPIStatCard
          title="Employees"
          value="100"
          icon={<WalletCards size={20} />}
        />
        <KPIStatCard
          title="Awaiting Review"
          value="1"
          icon={<Clock3 size={20} />}
        />
        <KPIStatCard
          title="Finalised Runs"
          value="8"
          icon={<Lock size={20} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border bg-white p-5 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Current Payroll</h2>
              <p className="text-sm text-slate-500">
                September 2026 payroll run
              </p>
            </div>
            <StatusBadge status="UNDER_REVIEW" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Gross Pay</p>
              <p className="mt-1 text-xl font-bold">GHS 691,800</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Deductions</p>
              <p className="mt-1 text-xl font-bold">GHS 127,080</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Net Pay</p>
              <p className="mt-1 text-xl font-bold">GHS 564,720</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              100 employees
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              3 approved overtime requests
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">
              2 adjustments
            </span>
          </div>

          <Link
            href="/payroll/runs/run-2026-09"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:underline"
          >
            Open payroll run
            <ArrowRight size={16} />
          </Link>
        </section>

        <section className="rounded-xl border bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <CheckCircle2 size={19} />
            <h2 className="font-semibold">Payroll Workflow</h2>
          </div>

          <div className="space-y-3">
            {[
              ["DRAFT", true],
              ["CALCULATING", true],
              ["CALCULATED", true],
              ["UNDER_REVIEW", true],
              ["APPROVED", false],
              ["FINALIZED", false],
            ].map(([label, done]) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    done ? "bg-slate-900" : "bg-slate-300"
                  }`}
                />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="font-semibold">Recent Payroll Runs</h2>
            <p className="text-sm text-slate-500">
              Recent calculation and approval activity
            </p>
          </div>
          <Link
            href="/payroll/runs"
            className="text-sm font-semibold hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="divide-y">
          {recentRuns.map((run) => (
            <Link
              key={run.id}
              href={`/payroll/runs/${run.id}`}
              className="flex flex-col gap-3 p-5 transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold">{run.period}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {run.employees} employees · Gross {run.gross} · Net {run.net}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={run.status} />
                <ArrowRight size={16} className="text-slate-400" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <Icon size={20} />
                <h3 className="mt-4 font-semibold">{action.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {action.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}