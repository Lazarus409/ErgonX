"use client";

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Clock3,
  Moon,
  Settings2,
  Timer,
  UserCheck,
  UserMinus,
  Users,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import KPIStatCard from "@/components/ui/KPIStatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import {
  attendanceApi,
  dashboardsApi,
  schedulingApi,
} from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { AttendanceDashboard } from "@/types/dashboards";
import { EM_DASH, formatNumber } from "@/lib/format";

/** Only the envelope `count` is needed for these reads. */
const COUNT_ONLY = { page_size: 1 } as const;

interface AttendanceOverview {
  today: AttendanceDashboard;
  onLeave: number | null;
  scheduledToday: number | null;
  activeShifts: number | null;
  overtimePending: number | null;
  adjustmentsPending: number | null;
}

export default function AttendanceDashboardPage() {
  const load = useCallback(async (): Promise<AttendanceOverview> => {
    const [
      today,
      leave,
      assignments,
      shifts,
      overtime,
      adjustments,
    ] = await Promise.all([
      dashboardsApi.getAttendanceDashboard(),
      dashboardsApi
        .getLeaveDashboard()
        .then((rollup) => rollup.currently_on_leave)
        .catch(() => null),
      schedulingApi
        .listScheduleAssignments({ is_current: true, ...COUNT_ONLY })
        .then((page) => page.count)
        .catch(() => null),
      // Shifts expose no `is_active` filter, so active ones are counted from
      // a single page of results.
      schedulingApi
        .listShifts({ page_size: MAX_PAGE_SIZE })
        .then(
          (page) => page.results.filter((shift) => shift.is_active).length,
        )
        .catch(() => null),
      attendanceApi
        .listOvertimeRecords({ status: "PENDING", ...COUNT_ONLY })
        .then((page) => page.count)
        .catch(() => null),
      attendanceApi
        .listAttendanceAdjustments({ status: "PENDING", ...COUNT_ONLY })
        .then((page) => page.count)
        .catch(() => null),
    ]);

    return {
      today,
      onLeave: leave,
      scheduledToday: assignments,
      activeShifts: shifts,
      overtimePending: overtime,
      adjustmentsPending: adjustments,
    };
  }, []);

  const { data, loading, error, reload } = useApiResource(load);

  const placeholder = loading ? "…" : EM_DASH;

  const value = (count: number | null | undefined): string =>
    count === null || count === undefined ? placeholder : formatNumber(count);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Dashboard"
        description="Monitor workforce attendance, schedules, shifts and attendance exceptions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/attendance/live"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Activity className="h-4 w-4" />
              Live Attendance
            </Link>

            <Link
              href="/attendance/schedules"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <CalendarDays className="h-4 w-4" />
              Schedules
            </Link>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Today&apos;s Attendance
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Current institution-wide attendance snapshot.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock3 className="h-4 w-4" />
            {loading ? "Refreshing..." : "Updated today"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KPIStatCard
          title="Present Today"
          value={value(data?.today.present)}
          icon={<UserCheck className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Absent Today"
          value={value(data?.today.absent)}
          icon={<UserX className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Late Today"
          value={value(data?.today.late)}
          icon={<Clock3 className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Currently on Leave"
          value={value(data?.onLeave)}
          icon={<CalendarDays className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Scheduled Today"
          value={value(data?.scheduledToday)}
          subtitle="Current schedule assignments"
          icon={<Users className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Active Shifts"
          value={value(data?.activeShifts)}
          icon={<Activity className="h-5 w-5" />}
        />

        {/*
          Night-shift and flexible-work headcounts have no backing endpoint.
          Substituting a different metric under these labels would misreport
          them, so they stay blank.
        */}
        <KPIStatCard
          title="Night Shift"
          value={EM_DASH}
          subtitle="Not reported by the API"
          icon={<Moon className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Flexible Work"
          value={EM_DASH}
          subtitle="Not reported by the API"
          icon={<Settings2 className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Overtime Pending"
          value={value(data?.overtimePending)}
          icon={<Timer className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Adjustments Pending"
          value={value(data?.adjustmentsPending)}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {/*
        The attendance rollup is a single-day snapshot. Multi-day trends and
        per-department rates are not exposed, and deriving them in the browser
        would mean paging raw attendance records and reporting figures that
        silently truncate. These three panels stay as placeholders.
      */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-900">
              Attendance Trend
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Seven-day attendance pattern.
            </p>
          </div>

          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
            Multi-day attendance trends are not yet reported by the API.
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-900">
              Department Attendance
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Current attendance rate by department.
            </p>
          </div>

          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
            Per-department attendance rates are not yet reported by the API.
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Overtime Today
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Overtime minutes recorded across today&apos;s attendance.
              </p>
            </div>

            <Link
              href="/attendance/overtime"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Review overtime
            </Link>
          </div>

          <div className="rounded-lg bg-slate-50 p-5">
            <p className="text-xs text-slate-500">Recorded today</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {data
                ? attendanceApi.formatMinutes(data.today.overtime_minutes)
                : placeholder}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Only approved overtime is consumed by Payroll.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Action Required
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Attendance items awaiting operational attention.
              </p>
            </div>

            <AlertTriangle className="h-5 w-5 text-slate-500" />
          </div>

          <div className="space-y-3">
            <Link
              href="/attendance/overtime"
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Overtime awaiting approval
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {value(data?.overtimePending)} overtime records require
                  review.
                </p>
              </div>
              <StatusBadge status="PENDING" />
            </Link>

            <Link
              href="/attendance/adjustments"
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Attendance adjustments
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {value(data?.adjustmentsPending)} correction requests require
                  review.
                </p>
              </div>
              <StatusBadge status="PENDING" />
            </Link>

            <Link
              href="/attendance/live"
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Attendance exceptions
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Review today&apos;s late and absent employees.
                </p>
              </div>
              <UserMinus className="h-5 w-5 text-slate-400" />
            </Link>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Quick Actions
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Manage attendance operations.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/attendance/live"
            icon={<Activity className="h-5 w-5" />}
            title="View Live Attendance"
          />

          <QuickAction
            href="/attendance/schedules"
            icon={<CalendarDays className="h-5 w-5" />}
            title="Manage Schedules"
          />

          <QuickAction
            href="/attendance/shifts"
            icon={<Clock3 className="h-5 w-5" />}
            title="Manage Shifts"
          />

          <QuickAction
            href="/attendance/adjustments"
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Review Adjustments"
          />
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        {icon}
      </span>
      <span className="text-sm font-medium text-slate-800">{title}</span>
    </Link>
  );
}
