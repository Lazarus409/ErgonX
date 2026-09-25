"use client";

import Link from "next/link";
import { useCallback } from "react";
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  ClipboardList,
  FileSliders,
  PieChart as PieChartIcon,
  Users,
} from "lucide-react";

import ChartCard from "@/components/charts/ChartCard";
import { DonutChart, TrendChart, donutLegend } from "@/components/charts/Charts";
import { ProgressMeter } from "@/components/charts/Visuals";
import { ButtonLink } from "@/components/ui/Button";
import { ActionCard, Avatar, Card, MetricCard, SummaryList } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
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
  const initial = loading && !data;

  const value = (count: number | null | undefined): string =>
    count === null || count === undefined ? EM_DASH : formatNumber(count);

  const monthly = data?.rollup.monthly_approved_leave ?? [];
  const byType = (data?.rollup.by_leave_type ?? []).map((item) => ({ label: item.leave_type__name, value: Number(item.requested_days) }));
  const utilisation = data?.rollup.balance_utilisation;
  const hasEntitlement = Boolean(utilisation && Number(utilisation.entitlement_days) > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leave"
        title="Leave Dashboard"
        description="Monitor leave requests, approvals, balances and upcoming leave."
        icon={CalendarDays}
        accent="leave"
        actions={
          <>
            <ButtonLink href="/leave/calendar" variant="secondary" leadingIcon={<CalendarRange className="h-4 w-4" />}>Calendar</ButtonLink>
            <ButtonLink href="/leave/requests" leadingIcon={<ClipboardList className="h-4 w-4" />}>View requests</ButtonLink>
          </>
        }
      />

      {error && <ErrorState variant="inline" title="Unable to load leave dashboard" message={error} onRetry={reload} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Leave indicators">
        <MetricCard label="Pending requests" value={value(data?.rollup.pending)} description="Across the institution" icon={Clock3} accent="payroll" loading={initial} href="/leave/requests?status=PENDING" />
        <MetricCard label="Awaiting my approval" value={value(data?.awaitingMyApproval)} description="In your approval queue" icon={CheckCircle2} accent="leave" loading={initial} />
        <MetricCard label="Currently on leave" value={value(data?.rollup.currently_on_leave)} description="Employees away today" icon={Users} accent="hr" loading={initial} />
        <MetricCard label="Upcoming leave" value={value(data?.rollup.upcoming)} description="Approved, starting soon" icon={CalendarDays} accent="attendance" loading={initial} />
      </section>

      <div className="grid gap-5 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-3"
          title="Monthly leave activity"
          description="Approved leave days starting in each of the last six calendar months."
          accent="leave"
          loading={initial}
          error={!data && error ? "This data is unavailable right now." : null}
          empty={!monthly.length}
          emptyDescription="Approved leave will appear here."
          data={{ columns: ["Month", "Approved requests", "Requested days"], rows: monthly.map((point) => [point.month, point.request_count, Number(point.requested_days)]) }}
        >
          <TrendChart variant="area" data={monthly} xKey="month" format="days" series={[{ key: "requested_days", label: "Leave days", color: "var(--mod-leave)" }]} height={250} />
        </ChartCard>
        <ChartCard
          className="xl:col-span-2"
          title="Approved leave by type"
          description="Share of approved leave days by leave type."
          accent="leave"
          icon={PieChartIcon}
          loading={initial}
          error={!data && error ? "This data is unavailable right now." : null}
          empty={!byType.length}
          emptyDescription="No approved leave is available yet."
          data={{ columns: ["Leave type", "Requested days"], rows: byType.map((item) => [item.label, item.value]) }}
        >
          <DonutChart data={byType} height={180} format="days" centerValue={formatNumber(byType.reduce((sum, item) => sum + item.value, 0))} centerLabel="days" />
          <SummaryList className="mt-4" items={donutLegend(byType, "days").map((item) => ({ label: <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label}</span>, value: item.value }))} />
        </ChartCard>
      </div>

      <Card title="Leave balance utilisation" description={utilisation ? `Current-year granted balance used across employee leave balances (${utilisation.year}).` : "Current-year granted balance used across employee leave balances."} icon={FileSliders} accent="leave">
        {initial ? <div className="skeleton h-24 rounded-xl" /> : hasEntitlement && utilisation ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
            <dl className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-surface-muted/70 p-3"><dt className="text-caption text-ink-muted">Entitlement</dt><dd className="mt-1 text-kpi-sm font-semibold text-ink-strong tabular-nums">{formatNumber(Number(utilisation.entitlement_days))}</dd></div>
              <div className="rounded-xl bg-mod-leave-soft p-3"><dt className="text-caption text-ink-muted">Used</dt><dd className="mt-1 text-kpi-sm font-semibold text-mod-leave tabular-nums">{formatNumber(Number(utilisation.used_days))}</dd></div>
              <div className="rounded-xl bg-surface-muted/70 p-3"><dt className="text-caption text-ink-muted">Available</dt><dd className="mt-1 text-kpi-sm font-semibold text-ink-strong tabular-nums">{formatNumber(Number(utilisation.available_days))}</dd></div>
            </dl>
            <ProgressMeter label="Utilisation of granted leave" value={Number(utilisation.utilisation_percent ?? 0)} color="var(--mod-leave)" detail="All figures are in days; utilisation is calculated by the server." />
          </div>
        ) : <p className="text-support text-ink-muted">No positive current-year leave entitlement is available to calculate utilisation.</p>}
      </Card>

      <DataTable
        caption="Upcoming leave"
        rows={data?.upcoming}
        rowKey={(request) => request.id}
        loading={initial}
        error={!data && error ? "This data is unavailable right now." : null}
        minWidth={620}
        toolbar={
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-card-title font-semibold text-ink-strong">Upcoming leave</h2>
              <p className="text-support text-ink-muted">Pending and approved leave from today onwards.</p>
            </div>
            <Link href="/leave/calendar" className="shrink-0 text-support font-semibold text-primary-ink hover:underline">View calendar</Link>
          </div>
        }
        empty={{ title: "Nothing scheduled", description: "No pending or approved leave is scheduled from today onwards.", icon: CalendarDays }}
        columns={[
          {
            key: "employee",
            header: "Employee",
            cell: (request) => {
              const employee = data?.employees.get(request.employee);
              const name = employee ? employeesApi.employeeDisplayName(employee) : EM_DASH;
              return <span className="flex items-center gap-3"><Avatar name={name} size="sm" /><span className="font-semibold text-ink-strong">{name}</span></span>;
            },
          },
          { key: "type", header: "Leave type", cell: (request) => data?.leaveTypes.get(request.leave_type)?.name ?? EM_DASH },
          { key: "dates", header: "Dates", cell: (request) => `${formatDate(request.start_date)} – ${formatDate(request.end_date)}`, sortValue: (request) => request.start_date },
          { key: "status", header: "Status", cell: (request) => <StatusBadge status={request.status} size="sm" /> },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Leave areas">
        <ActionCard href="/leave/requests" title="Requests" description="Review, approve and track requests" icon={ClipboardList} accent="leave" />
        <ActionCard href="/leave/policies" title="Policies" description="Leave types and eligibility rules" icon={FileSliders} accent="leave" />
        <ActionCard href="/leave/calendar" title="Calendar" description="Who is away, and when" icon={CalendarRange} accent="leave" />
      </section>
    </div>
  );
}
