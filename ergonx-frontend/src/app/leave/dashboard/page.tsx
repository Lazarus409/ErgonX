"use client";

import Link from "next/link";
import { useCallback } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Users,
  ArrowRight,
  ClipboardList,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import KPIStatCard from "@/components/ui/KPIStatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import { useAuth } from "@/components/guards/AuthProvider";
import {
  dashboardsApi,
  employeesApi,
  isUuid,
  leaveApi,
} from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { LeaveDashboard } from "@/types/dashboards";
import type { LeaveRequest, LeaveType } from "@/types/leave";
import type { Employee } from "@/types/hr";
import { EM_DASH, formatDate, formatNumber } from "@/lib/format";

const UPCOMING_LIMIT = 5;

interface LeaveOverview {
  rollup: LeaveDashboard;
  /** Null when the signed-in user has no resolvable approval queue. */
  awaitingMyApproval: number | null;
  upcoming: LeaveRequest[];
  employees: Map<string, Employee>;
  leaveTypes: Map<string, LeaveType>;
}

export default function LeaveDashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const load = useCallback(async (): Promise<LeaveOverview> => {
    const today = new Date().toISOString().slice(0, 10);

    const [rollup, awaitingMyApproval, calendar, employeeIndex, types] =
      await Promise.all([
        dashboardsApi.getLeaveDashboard(),
        // The approval queue is filtered by approver id, which only resolves
        // for a real backend session; the development bypass user has none.
        isUuid(userId)
          ? leaveApi
              .listLeaveApprovals({
                approver: userId,
                status: "PENDING",
                page_size: 1,
              })
              .then((page) => page.count)
              .catch(() => null)
          : Promise.resolve(null),
        leaveApi
          .getLeaveCalendar({
            date_from: today,
            page_size: UPCOMING_LIMIT,
            ordering: "start_date",
          })
          .catch(() => null),
        employeesApi.loadEmployeeIndex().catch(() => null),
        leaveApi
          .listLeaveTypes({ page_size: 100 })
          .then((page) => page.results)
          .catch(() => []),
      ]);

    return {
      rollup,
      awaitingMyApproval,
      upcoming: calendar?.results ?? [],
      employees: employeeIndex?.byId ?? new Map(),
      leaveTypes: new Map(types.map((type) => [type.id, type])),
    };
  }, [userId]);

  const { data, loading, error, reload } = useApiResource(load);

  const placeholder = loading ? "…" : EM_DASH;

  const value = (count: number | null | undefined): string =>
    count === null || count === undefined ? placeholder : formatNumber(count);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Leave Dashboard"
        description="Monitor leave requests, approvals, balances and upcoming leave."
        actions={
          <Link
            href="/leave/requests"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ClipboardList className="h-4 w-4" />
            View Requests
          </Link>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPIStatCard
          title="Pending Requests"
          value={value(data?.rollup.pending)}
          icon={<Clock3 className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Awaiting My Approval"
          value={value(data?.awaitingMyApproval)}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Currently on Leave"
          value={value(data?.rollup.currently_on_leave)}
          icon={<Users className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Upcoming Leave"
          value={value(data?.rollup.upcoming)}
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Monthly leave activity</h2>
          <p className="mt-1 text-sm text-slate-500">Approved leave starting in each of the last six calendar months.</p>
          <MonthlyLeaveTrend points={data?.rollup.monthly_approved_leave ?? []} loading={loading} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Approved leave by type</h2>
          <p className="mt-1 text-sm text-slate-500">Approved request volume and requested days by leave type.</p>
          <LeaveTypeDistribution items={data?.rollup.by_leave_type ?? []} loading={loading} />
        </section>

      </div>

      <LeaveBalanceUtilisation summary={data?.rollup.balance_utilisation} loading={loading} />

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Upcoming Leave</h2>

            <p className="mt-1 text-sm text-slate-500">
              Recent and upcoming employee leave activity.
            </p>
          </div>

          <Link
            href="/leave/calendar"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            View Calendar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-slate-500">
            Loading upcoming leave...
          </div>
        ) : !data || data.upcoming.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            No pending or approved leave is scheduled from today onwards.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.upcoming.map((request) => {
              const employee = data.employees.get(request.employee);

              return (
                <div
                  key={request.id}
                  className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {employee
                        ? employeesApi.employeeDisplayName(employee)
                        : EM_DASH}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {data.leaveTypes.get(request.leave_type)?.name ?? EM_DASH}{" "}
                      · {formatDate(request.start_date)} –{" "}
                      {formatDate(request.end_date)}
                    </p>
                  </div>

                  <StatusBadge status={request.status} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Leave Management</h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage requests, policies and leave calendar from the Leave
              module.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/leave/requests"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Requests
            </Link>

            <Link
              href="/leave/policies"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Policies
            </Link>

            <Link
              href="/leave/calendar"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Calendar
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function MonthlyLeaveTrend({ points, loading }: { points: LeaveDashboard["monthly_approved_leave"]; loading: boolean }) { if (loading) return <p className="flex h-48 items-center justify-center text-sm text-slate-500">Loading leave activity…</p>; const maximum = Math.max(...points.map((point) => Number(point.requested_days)), 1); return <div className="mt-6 flex h-48 items-end gap-3" aria-label="Approved leave days by month">{points.map((point) => <div key={point.month} className="flex min-w-0 flex-1 flex-col justify-end gap-2"><span className="text-center text-xs font-medium text-slate-600">{formatNumber(Number(point.requested_days))}</span><div className="rounded-t-lg bg-gradient-to-t from-teal-600 to-cyan-300" style={{ height: `${Math.max((Number(point.requested_days) / maximum) * 100, Number(point.requested_days) ? 4 : 2)}%` }} title={`${point.request_count} approved requests, ${point.requested_days} requested days`} /><span className="text-center text-[10px] text-slate-500">{new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(`${point.month}T00:00:00`))}</span></div>)}</div>; }
function LeaveTypeDistribution({ items, loading }: { items: LeaveDashboard["by_leave_type"]; loading: boolean }) { if (loading) return <p className="flex h-48 items-center justify-center text-sm text-slate-500">Loading leave distribution…</p>; if (!items.length) return <p className="flex h-48 items-center justify-center text-center text-sm text-slate-500">No approved leave is available yet.</p>; const maximum = Math.max(...items.map((item) => Number(item.requested_days)), 1); return <div className="mt-6 space-y-4">{items.map((item) => <div key={item.leave_type__name}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate text-slate-600">{item.leave_type__name}</span><span className="font-semibold text-slate-950">{formatNumber(Number(item.requested_days))} days</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max((Number(item.requested_days) / maximum) * 100, 3)}%` }} /></div><p className="mt-1 text-xs text-slate-500">{formatNumber(item.request_count)} approved requests</p></div>)}</div>; }
function LeaveBalanceUtilisation({ summary, loading }: { summary: LeaveDashboard["balance_utilisation"] | undefined; loading: boolean }) { if (loading) return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Leave balance utilisation</h2><p className="mt-5 text-sm text-slate-500">Loading current-year balances…</p></section>; if (!summary || Number(summary.entitlement_days) <= 0) return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Leave balance utilisation</h2><p className="mt-1 text-sm text-slate-500">Current-year granted balance used across employee leave balances.</p><p className="mt-5 text-sm text-slate-500">No positive current-year leave entitlement is available to calculate utilisation.</p></section>; const percentage = Number(summary.utilisation_percent); return <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h2 className="font-semibold text-slate-900">Leave balance utilisation</h2><p className="mt-1 text-sm text-slate-500">Current-year granted balance used across employee leave balances.</p></div><span className="text-xs text-slate-500">{summary.year}</span></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><div><p className="text-xs uppercase tracking-wide text-slate-500">Entitlement</p><p className="mt-1 text-2xl font-semibold text-slate-950">{formatNumber(Number(summary.entitlement_days))} days</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Used</p><p className="mt-1 text-2xl font-semibold text-teal-700">{formatNumber(Number(summary.used_days))} days</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Available</p><p className="mt-1 text-2xl font-semibold text-slate-950">{formatNumber(Number(summary.available_days))} days</p></div></div><div className="mt-5"><div className="mb-2 flex justify-between gap-3 text-sm"><span className="text-slate-600">Utilisation</span><span className="font-semibold text-slate-950">{formatNumber(percentage)}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-cyan-400" style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }} /></div></div></section>; }
