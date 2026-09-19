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

      {/* Institution-wide utilisation and balance totals await dedicated API endpoints. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Leave Utilisation
              </p>

              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {EM_DASH}
              </p>
            </div>

            <div className="rounded-lg bg-slate-100 p-3">
              <CalendarDays className="h-5 w-5 text-slate-600" />
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" />

          <p className="mt-2 text-xs text-slate-500">
            Institution-wide utilisation is not yet reported by the API.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Balance Summary
              </p>

              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {EM_DASH}
              </p>
            </div>

            <div className="rounded-lg bg-slate-100 p-3">
              <ClipboardList className="h-5 w-5 text-slate-600" />
            </div>
          </div>

          <p className="mt-5 text-xs text-slate-500">
            Per-employee balances are available on the employee leave screens.
            An institution-wide total is not yet reported by the API.
          </p>
        </section>

      </div>

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
