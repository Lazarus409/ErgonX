"use client";

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Clock3,
  Grid3X3,
  Timer,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { useCallback } from "react";

import ChartCard from "@/components/charts/ChartCard";
import { BarsChart, TrendChart } from "@/components/charts/Charts";
import { HeatmapGrid, ProgressMeter } from "@/components/charts/Visuals";
import { hasValues } from "@/components/charts/format";
import { ButtonLink } from "@/components/ui/Button";
import { Sparkline } from "@/components/charts/Visuals";
import { AttentionItem, Avatar, Card, MetricCard } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import ErrorState from "@/components/ui/ErrorState";
import {
  attendanceApi,
  dashboardsApi,
  schedulingApi,
} from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { AttendanceDashboard } from "@/types/dashboards";
import { EM_DASH, formatNumber, formatCount } from "@/lib/format";

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

type LatenessRow = AttendanceDashboard["repeated_lateness"][number];

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
  const initial = loading && !data;

  const value = (count: number | null | undefined): string =>
    count === null || count === undefined ? EM_DASH : formatNumber(count);

  const weekly = data?.today.weekly_attendance ?? [];
  const departments = data?.today.by_department ?? [];
  const lateness = data?.today.repeated_lateness ?? [];
  const maxLate = Math.max(...lateness.map((item) => item.late_occurrences), 1);
  const heatColumns = ["Present", "Late", "Absent", "On leave"];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Attendance"
        title="Attendance Dashboard"
        description="Monitor workforce attendance, schedules, shifts and attendance exceptions."
        icon={Clock3}
        accent="attendance"
        meta={<span className="inline-flex items-center gap-1.5 text-caption text-ink-muted"><span className={loading ? "h-2 w-2 animate-pulse rounded-full bg-warning" : "h-2 w-2 rounded-full bg-success"} aria-hidden="true" />{loading ? "Refreshing…" : "Institution-wide snapshot for today"}</span>}
        actions={
          <>
            <ButtonLink href="/attendance/schedules" variant="secondary" leadingIcon={<CalendarDays className="h-4 w-4" />}>Schedules</ButtonLink>
            <ButtonLink href="/attendance/live" leadingIcon={<Activity className="h-4 w-4" />}>Live attendance</ButtonLink>
          </>
        }
      />

      {error && <ErrorState variant="inline" title="Unable to load attendance dashboard" message={error} onRetry={reload} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Today's attendance">
        <MetricCard label="Present today" value={value(data?.today.present)} icon={UserCheck} accent="accounting" loading={initial} chart={<Sparkline values={weekly.map((day) => day.present)} color="var(--mod-accounting)" height={32} label="Present this week" />} />
        <MetricCard label="Late today" value={value(data?.today.late)} icon={Clock3} accent="payroll" loading={initial} chart={<Sparkline values={weekly.map((day) => day.late)} color="var(--mod-payroll)" height={32} label="Late arrivals this week" />} />
        <MetricCard label="Absent today" value={value(data?.today.absent)} icon={UserX} accent="audit" loading={initial} />
        <MetricCard label="Currently on leave" value={value(data?.onLeave)} icon={CalendarDays} accent="leave" loading={initial} />
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Scheduling and exceptions">
        <MetricCard size="sm" label="Scheduled today" value={value(data?.scheduledToday)} description="Current schedule assignments" icon={Users} accent="attendance" loading={initial} />
        <MetricCard size="sm" label="Active shifts" value={value(data?.activeShifts)} icon={Activity} accent="attendance" loading={initial} href="/attendance/shifts" />
        <MetricCard size="sm" label="Overtime pending" value={value(data?.overtimePending)} icon={Timer} accent="attendance" loading={initial} href="/attendance/overtime" />
        <MetricCard size="sm" label="Adjustments pending" value={value(data?.adjustmentsPending)} icon={AlertTriangle} accent="attendance" loading={initial} href="/attendance/adjustments" />
      </section>

      <div className="grid gap-5 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-3"
          title="Seven-day attendance"
          description="Daily attendance outcomes across the last week."
          accent="attendance"
          loading={initial}
          error={!data && error ? "This data is unavailable right now." : null}
          empty={!hasValues(weekly, ["present", "late", "absent", "on_leave"])}
          emptyTitle="No attendance this week"
          emptyDescription="No clock-ins, absences or leave were recorded in the last seven days."
          legend={[{ label: "Present", color: "var(--success)", shape: "square" }, { label: "Late", color: "var(--warning)", shape: "square" }, { label: "Absent", color: "var(--danger)", shape: "square" }, { label: "On leave", color: "var(--mod-leave)", shape: "square" }]}
          data={{ columns: ["Date", "Present", "Late", "Absent", "On leave"], rows: weekly.map((day) => [day.date, day.present, day.late, day.absent, day.on_leave]) }}
        >
          <BarsChart data={weekly} xKey="date" xFormat="weekday" mode="stacked" height={250} series={[
            { key: "present", label: "Present", color: "var(--success)" },
            { key: "late", label: "Late", color: "var(--warning)" },
            { key: "absent", label: "Absent", color: "var(--danger)" },
            { key: "on_leave", label: "On leave", color: "var(--mod-leave)" },
          ]} />
        </ChartCard>
        <ChartCard
          className="xl:col-span-2"
          title="Overtime this week"
          description="Recorded overtime minutes per day. Only approved overtime is consumed by Payroll."
          accent="attendance"
          icon={Timer}
          loading={initial}
          error={!data && error ? "This data is unavailable right now." : null}
          empty={!hasValues(weekly, ["overtime_minutes"])}
          emptyTitle="No overtime this week"
          emptyDescription="No overtime minutes were recorded in the last seven days."
          footer={data ? <span>Recorded today: <strong className="text-ink-strong">{attendanceApi.formatMinutes(data.today.overtime_minutes)}</strong></span> : undefined}
          data={{ columns: ["Date", "Overtime minutes"], rows: weekly.map((day) => [day.date, day.overtime_minutes]) }}
        >
          <TrendChart variant="area" data={weekly} xKey="date" xFormat="weekday" format="minutes" height={210} series={[{ key: "overtime_minutes", label: "Overtime", color: "var(--chart-3)" }]} />
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Department attendance heatmap" description="Today's outcomes by department. Darker cells mean more employees." icon={Grid3X3} accent="attendance">
          {initial ? <div className="skeleton h-48 rounded-xl" /> : departments.length ? (
            <HeatmapGrid
              rows={departments.map((item) => item.employee__employments__department__name || "Unassigned")}
              columns={heatColumns}
              cells={departments.map((item) => [item.present, item.late, item.absent, item.on_leave].map((count) => ({ value: count })))}
            />
          ) : <p className="text-support text-ink-muted">No department-linked attendance has been recorded today.</p>}
        </Card>
        <Card className="xl:col-span-2" title="Action required" description="Attendance items awaiting operational attention." icon={AlertTriangle} accent="attendance">
          {data && data.scheduledToday ? (
            <div className="mb-4 border-b border-line-soft pb-4">
              <ProgressMeter
                label="Shift coverage today"
                value={Math.min(data.today.present + data.today.late, data.scheduledToday)}
                max={data.scheduledToday}
                color="var(--mod-attendance)"
                detail={`${formatNumber(data.today.present + data.today.late)} clocked in (present or late) against ${formatCount(data.scheduledToday, "current schedule assignment")}.`}
              />
            </div>
          ) : null}
          <div className="-mx-3 -mb-2 space-y-1">
            <AttentionItem title="Overtime awaiting approval" description={`${formatCount(data?.overtimePending, "overtime record")} awaiting review.`} severity={data?.overtimePending ? "warning" : "info"} href="/attendance/overtime" />
            <AttentionItem title="Attendance adjustments" description={`${formatCount(data?.adjustmentsPending, "correction request")} awaiting review.`} severity={data?.adjustmentsPending ? "warning" : "info"} href="/attendance/adjustments" />
            <AttentionItem title="Attendance exceptions" description="Review today's late and absent employees." severity={data && data.today.absent > 0 ? "high" : "info"} href="/attendance/live" />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <DataTable<LatenessRow>
          className="xl:col-span-3"
          caption="Repeated lateness"
          rows={lateness}
          rowKey={(item) => item.employee_id}
          loading={initial}
          error={!data && error ? "This data is unavailable right now." : null}
          minWidth={620}
          toolbar={
            <div>
              <h2 className="text-card-title font-semibold text-ink-strong">Repeated lateness</h2>
              <p className="text-support text-ink-muted">Employees with repeated late arrivals in the last 90 days.</p>
            </div>
          }
          empty={{ title: "No repeated lateness", description: "No repeated late arrivals have been recorded in the selected period.", icon: Clock3 }}
          columns={[
            {
              key: "employee",
              header: "Employee",
              cell: (item) => {
                const name = `${item.employee__first_name} ${item.employee__last_name}`;
                return <span className="flex min-w-0 items-center gap-3"><Avatar name={name} size="sm" /><span className="min-w-0"><span className="block max-w-[14rem] truncate font-semibold text-ink-strong" title={name}>{name}</span><span className="block font-mono text-caption text-ink-muted">{item.employee__employee_number}</span></span></span>;
              },
            },
            { key: "department", header: "Department", hideBelow: "md", cell: (item) => <span className="block max-w-[12rem] truncate" title={item.employee__employments__department__name}>{item.employee__employments__department__name || "Unassigned"}</span> },
            {
              key: "late",
              header: "Late arrivals",
              numeric: true,
              sortValue: (item) => item.late_occurrences,
              cell: (item) => (
                <span className="inline-flex items-center justify-end gap-2">
                  <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted sm:block" aria-hidden="true"><span className="block h-full rounded-full bg-warning" style={{ width: `${(item.late_occurrences / maxLate) * 100}%` }} /></span>
                  <span className="font-semibold text-warning-ink">{formatNumber(item.late_occurrences)}</span>
                </span>
              ),
            },
            { key: "minutes", header: "Minutes late", numeric: true, sortValue: (item) => item.total_minutes_late, cell: (item) => formatNumber(item.total_minutes_late) },
          ]}
        />
        <ChartCard
          className="xl:col-span-2"
          title="Lateness trend"
          description="Late arrivals per month."
          accent="attendance"
          loading={initial}
          error={!data && error ? "This data is unavailable right now." : null}
          empty={!data?.today.lateness_trend.length}
          emptyDescription="Monthly lateness will appear here."
          data={{ columns: ["Month", "Late arrivals", "Minutes late"], rows: (data?.today.lateness_trend ?? []).map((point) => [point.month, point.late_occurrences, point.total_minutes_late]) }}
        >
          <TrendChart data={data?.today.lateness_trend ?? []} xKey="month" height={230} series={[{ key: "late_occurrences", label: "Late arrivals", color: "var(--warning)" }]} />
        </ChartCard>
      </div>
    </div>
  );
}
