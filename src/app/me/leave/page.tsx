"use client";

import Link from "next/link";
import { useCallback } from "react";
import { CalendarCheck, CalendarClock, CalendarDays, Clock3, Plus } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { employeesApi, leaveApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { Employee } from "@/types/hr";
import type { LeaveBalance, LeaveRequest, LeaveType } from "@/types/leave";
import { EM_DASH, formatDate, formatNumber, toISODate } from "@/lib/format";

interface MyLeave {
  employee: Employee | null;
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  leaveTypes: Map<string, LeaveType>;
}

export default function MyLeavePage() {
  const load = useCallback(async (): Promise<MyLeave> => {
    const types = await leaveApi
      .listLeaveTypes({ page_size: MAX_PAGE_SIZE })
      .then((page) => page.results)
      .catch(() => [] as LeaveType[]);

    const leaveTypes = new Map(types.map((type) => [type.id, type]));

    const employee = await employeesApi.getCurrentEmployee();

    if (!employee) {
      return { employee: null, balances: [], requests: [], leaveTypes };
    }

    const [balances, requests] = await Promise.all([
      leaveApi
        .listLeaveBalances({
          employee: employee.id,
          year: new Date().getFullYear(),
          page_size: MAX_PAGE_SIZE,
        })
        .then((page) => page.results)
        .catch(() => [] as LeaveBalance[]),
      leaveApi
        .listLeaveRequests({
          employee: employee.id,
          page_size: MAX_PAGE_SIZE,
          ordering: "-start_date",
        })
        .then((page) => page.results)
        .catch(() => [] as LeaveRequest[]),
    ]);

    return { employee, balances, requests, leaveTypes };
  }, []);

  const { data, loading, error, reload } = useApiResource(load);

  // Totals below sum values the backend already computed per row; no
  // entitlement or accrual logic is re-derived here.
  const available = data?.balances.reduce(
    (total, balance) => total + Number(balance.available),
    0,
  );

  const used = data?.balances.reduce(
    (total, balance) => total + Number(balance.used),
    0,
  );

  const pendingDays = data?.requests
    .filter((request) => request.status === "PENDING")
    .reduce((total, request) => total + Number(request.requested_days), 0);

  const today = toISODate(new Date());

  const nextLeave = data?.requests
    .filter(
      (request) =>
        request.start_date >= today &&
        (request.status === "PENDING" || request.status === "APPROVED"),
    )
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const requests = data?.requests ?? [];
  const initial = loading && !data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="My leave"
        description="View your leave balance and manage your leave requests."
        icon={CalendarDays}
        accent="leave"
        actions={<ButtonLink href="/me/leave/request" leadingIcon={<Plus className="h-4 w-4" />}>Request leave</ButtonLink>}
      />

      {error && <ErrorState variant="inline" message={error} onRetry={reload} />}

      {!loading && !error && data && !data.employee && (
        <EmptyState
          icon={CalendarDays}
          accent="leave"
          title="No employee record linked"
          description="Your account is not linked to an employee record in this institution, so personal leave balances and requests are unavailable."
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Leave summary">
        <MetricCard size="sm" label="Leave balance" value={available === undefined ? EM_DASH : `${formatNumber(available)} days`} description="Available across all leave types" icon={CalendarDays} accent="leave" loading={initial} />
        <MetricCard size="sm" label="Pending" value={pendingDays === undefined ? EM_DASH : `${formatNumber(pendingDays)} days`} description="Awaiting approval" icon={Clock3} accent="payroll" loading={initial} />
        <MetricCard size="sm" label="Used" value={used === undefined ? EM_DASH : `${formatNumber(used)} days`} description="This leave year" icon={CalendarCheck} accent="hr" loading={initial} />
        <MetricCard size="sm" label="Upcoming" value={nextLeave ? formatDate(nextLeave.start_date) : EM_DASH} description="Next approved/requested leave" icon={CalendarClock} accent="attendance" loading={initial} />
      </section>

      <DataTable
        caption="My leave requests"
        rows={requests}
        rowKey={(request) => request.id}
        loading={initial}
        minWidth={620}
        toolbar={<div><h2 className="text-card-title font-semibold text-ink-strong">My leave requests</h2><p className="text-support text-ink-muted">Your submitted leave requests and their current status.</p></div>}
        empty={{ title: "No leave requests yet", description: "Requests you submit will appear here with their approval status.", icon: CalendarDays, action: <ButtonLink href="/me/leave/request" size="sm" leadingIcon={<Plus className="h-4 w-4" />}>Request leave</ButtonLink> }}
        columns={[
          { key: "requested", header: "Requested", sortValue: (request) => request.created_at, cell: (request) => <Link href={`/leave/requests/${request.id}`} className="font-semibold text-ink-strong hover:text-primary-ink">{formatDate(request.created_at)}</Link> },
          { key: "type", header: "Leave type", cell: (request) => data?.leaveTypes.get(request.leave_type)?.name ?? EM_DASH },
          { key: "period", header: "Period", sortValue: (request) => request.start_date, cell: (request) => `${formatDate(request.start_date)} – ${formatDate(request.end_date)}` },
          { key: "days", header: "Days", numeric: true, sortValue: (request) => Number(request.requested_days), cell: (request) => formatNumber(request.requested_days) },
          { key: "status", header: "Status", cell: (request) => <StatusBadge status={request.status} size="sm" /> },
        ]}
      />
    </div>
  );
}
