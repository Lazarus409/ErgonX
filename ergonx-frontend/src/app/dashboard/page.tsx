"use client";

import { CalendarDays, Users, UserCheck, WalletCards } from "lucide-react";
import { useCallback } from "react";

import ErrorState from "@/components/ui/ErrorState";
import { dashboardsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import { useAuth } from "@/components/guards/AuthProvider";
import { EM_DASH, formatAmount, formatNumber } from "@/lib/format";

/**
 * Executive dashboard.
 *
 * Reads `GET /api/v1/dashboards/executive/`, which requires the
 * `dashboard.executive.view` permission. Every figure shown here comes from
 * that single response; nothing is derived in the browser.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const load = useCallback(() => dashboardsApi.getExecutiveDashboard(), []);
  const { data, loading, error, reload } = useApiResource(load);

  const placeholder = loading ? "…" : EM_DASH;

  const stats = [
    {
      title: "Workforce",
      value: data ? formatNumber(data.total_employees) : placeholder,
      description: "Total employee records",
      icon: Users,
    },
    {
      title: "Active Employees",
      value: data ? formatNumber(data.active_employees) : placeholder,
      description: "Currently active",
      icon: UserCheck,
    },
    {
      title: "Leave",
      value: data ? formatNumber(data.pending_leave_requests) : placeholder,
      description: "Pending requests",
      icon: CalendarDays,
    },
    {
      title: "Payroll",
      value: data ? formatAmount(data.payroll_cost) : placeholder,
      description: "Finalized gross pay",
      icon: WalletCards,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-slate-950 p-6 text-white sm:p-8"><p className="text-sm font-medium text-slate-300">Executive dashboard</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.firstName ?? "there"}.</h2><p className="mt-2 text-sm text-slate-300">Monitor workforce, attendance, leave, payroll, and financial activity across your institution.</p></section>

      {error && <ErrorState message={error} onRetry={reload} />}

      {/* KPI cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  <Icon size={19} className="text-slate-700" />
                </div>

                <span className="text-xs text-slate-400">
                  {loading ? "Loading" : "Live data"}
                </span>
              </div>

              <p className="mt-5 text-sm text-slate-500">{stat.title}</p>

              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {stat.value}
              </p>

              <p className="mt-1 text-xs text-slate-400">{stat.description}</p>
            </div>
          );
        })}
      </div>

      {/* Dashboard sections */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-950">
            Approvals Requiring Attention
          </h3>

          {data ? (
            <dl className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <dt className="text-sm text-slate-600">
                  Leave requests pending approval
                </dt>
                <dd className="text-sm font-semibold text-slate-900">
                  {formatNumber(data.pending_leave_requests)}
                </dd>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <dt className="text-sm text-slate-600">
                  Journals pending approval
                </dt>
                <dd className="text-sm font-semibold text-slate-900">
                  {formatNumber(data.pending_journals)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              {loading
                ? "Loading approval counts..."
                : "Approval data is unavailable."}
            </p>
          )}
        </section>

        {/*
          Compliance alerts have no executive-dashboard endpoint. Ghana
          compliance reminders are exposed under the Accounting module and are
          connected in a later phase, so this stays a placeholder.
        */}
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-950">Compliance Alerts</h3>

          <p className="mt-2 text-sm text-slate-500">
            Compliance alerts will appear here when available.
          </p>
        </section>
      </div>
    </div>
  );
}
