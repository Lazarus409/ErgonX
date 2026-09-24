"use client";

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Clock3,
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

          <WeeklyAttendanceTrend points={data?.today.weekly_attendance ?? []} loading={loading} />
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

          <DepartmentAttendance items={data?.today.by_department ?? []} loading={loading} />
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Repeated Lateness</h2>
            <p className="mt-1 text-xs text-slate-500">Employees with repeated late arrivals in the last 90 days, including total minutes late.</p>
          </div>
          <span className="text-xs text-slate-500">Attendance and HR permissions apply</span>
        </div>
        {!data && loading ? <p className="py-8 text-sm text-slate-500">Loading lateness analytics…</p> : !data?.today.repeated_lateness.length ? <p className="py-8 text-sm text-slate-500">No repeated late arrivals have been recorded in the selected period.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-3 font-semibold">Employee</th><th className="px-3 py-3 font-semibold">Employee number</th><th className="px-3 py-3 font-semibold">Department</th><th className="px-3 py-3 text-right font-semibold">Late arrivals</th><th className="px-3 py-3 text-right font-semibold">Minutes late</th></tr></thead><tbody className="divide-y divide-slate-100">{data.today.repeated_lateness.map((item) => <tr key={item.employee_id}><td className="max-w-[220px] px-3 py-3 font-medium text-slate-900"><span className="block truncate" title={`${item.employee__first_name} ${item.employee__last_name}`}>{item.employee__first_name} {item.employee__last_name}</span></td><td className="px-3 py-3 font-mono text-xs text-slate-600">{item.employee__employee_number}</td><td className="max-w-[180px] px-3 py-3 text-slate-600"><span className="block truncate" title={item.employee__employments__department__name}>{item.employee__employments__department__name || "Unassigned"}</span></td><td className="px-3 py-3 text-right font-semibold text-amber-700">{formatNumber(item.late_occurrences)}</td><td className="px-3 py-3 text-right text-slate-700">{formatNumber(item.total_minutes_late)}</td></tr>)}</tbody></table></div>}
      </section>

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

    </div>
  );
}

function WeeklyAttendanceTrend({ points, loading }: { points: AttendanceDashboard["weekly_attendance"]; loading: boolean }) {
  const maximum = Math.max(...points.map((point) => point.present + point.late + point.absent + point.on_leave), 1);
  if (loading) return <p className="flex h-64 items-center justify-center text-sm text-slate-500">Loading weekly attendance…</p>;
  return <div className="mt-6 flex h-64 items-end gap-2" aria-label="Seven-day attendance trend">{points.map((point) => { const total = point.present + point.late + point.absent + point.on_leave; const height = total ? Math.max((total / maximum) * 100, 5) : 2; return <div key={point.date} className="flex min-w-0 flex-1 flex-col justify-end gap-2"><span className="text-center text-xs font-medium text-slate-600">{total}</span><div className="overflow-hidden rounded-t-lg bg-slate-100" style={{ height: `${height}%` }} title={`${point.date}: ${point.present} present, ${point.late} late, ${point.absent} absent, ${point.on_leave} on leave`}><div className="bg-emerald-500" style={{ height: `${total ? (point.present / total) * 100 : 0}%` }} /><div className="bg-amber-400" style={{ height: `${total ? (point.late / total) * 100 : 0}%` }} /><div className="bg-rose-500" style={{ height: `${total ? (point.absent / total) * 100 : 0}%` }} /><div className="bg-sky-500" style={{ height: `${total ? (point.on_leave / total) * 100 : 0}%` }} /></div><span className="text-center text-[10px] text-slate-500">{new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${point.date}T00:00:00`))}</span></div>; })}</div>;
}

function DepartmentAttendance({ items, loading }: { items: AttendanceDashboard["by_department"]; loading: boolean }) {
  if (loading) return <p className="flex h-64 items-center justify-center text-sm text-slate-500">Loading department attendance…</p>;
  if (!items.length) return <p className="flex h-64 items-center justify-center px-4 text-center text-sm text-slate-500">No department-linked attendance has been recorded today.</p>;
  return <div className="mt-6 space-y-4">{items.map((item) => { const rate = item.total ? Math.round(((item.present + item.late) / item.total) * 100) : 0; return <div key={item.employee__employments__department__name}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate text-slate-600">{item.employee__employments__department__name}</span><span className="font-semibold text-slate-950">{rate}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${rate}%` }} /></div><p className="mt-1 text-xs text-slate-500">{item.present + item.late} present or late of {item.total} records</p></div>; })}</div>;
}
