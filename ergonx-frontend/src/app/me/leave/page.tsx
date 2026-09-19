"use client";

import Link from "next/link";
import { useCallback } from "react";
import { CalendarDays, Clock3, Plus } from "lucide-react";

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

  const placeholder = loading ? "…" : EM_DASH;

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

  return (
    <>
      <PageHeader
        title="My Leave"
        description="View your leave balance and manage your leave requests."
        actions={
          <Link
            href="/me/leave/request"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus size={17} />
            Request Leave
          </Link>
        }
      />

      <div className="mt-6 space-y-6">
        {error && <ErrorState message={error} onRetry={reload} />}

        {!loading && !error && data && !data.employee && (
          <EmptyState
            title="No employee record linked"
            description="Your account is not linked to an employee record in this institution, so personal leave balances and requests are unavailable."
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <CalendarDays size={20} className="text-slate-500" />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              Leave Balance
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {available === undefined
                ? placeholder
                : `${formatNumber(available)} days`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Available across all leave types
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <Clock3 size={20} className="text-slate-500" />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              Pending
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {pendingDays === undefined
                ? placeholder
                : `${formatNumber(pendingDays)} days`}
            </p>
            <p className="mt-1 text-xs text-slate-500">Awaiting approval</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <CalendarDays size={20} className="text-slate-500" />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              Used
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {used === undefined ? placeholder : `${formatNumber(used)} days`}
            </p>
            <p className="mt-1 text-xs text-slate-500">This leave year</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <CalendarDays size={20} className="text-slate-500" />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              Upcoming
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {loading
                ? placeholder
                : nextLeave
                  ? formatDate(nextLeave.start_date)
                  : EM_DASH}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Next approved/requested leave
            </p>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              My Leave Requests
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Your submitted leave requests and their current status.
            </p>
          </div>

          {loading ? (
            <div className="p-5 text-sm text-slate-500">
              Loading your leave requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              You have no leave requests.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Request
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Leave Type
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Period
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Days
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {requests.map((request) => (
                      <tr
                        key={request.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-5 py-4 text-sm font-medium text-slate-900">
                          <Link
                            href={`/leave/requests/${request.id}`}
                            className="hover:underline"
                          >
                            {formatDate(request.created_at)}
                          </Link>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {data?.leaveTypes.get(request.leave_type)?.name ??
                            EM_DASH}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(request.start_date)} -{" "}
                          {formatDate(request.end_date)}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {formatNumber(request.requested_days)}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge status={request.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 md:hidden">
                {requests.map((request) => (
                  <div key={request.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {data?.leaveTypes.get(request.leave_type)?.name ??
                            EM_DASH}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(request.created_at)}
                        </p>
                      </div>

                      <StatusBadge status={request.status} />
                    </div>

                    <p className="mt-4 text-sm text-slate-600">
                      {formatDate(request.start_date)} -{" "}
                      {formatDate(request.end_date)}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatNumber(request.requested_days)} days
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
