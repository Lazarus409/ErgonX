"use client";

import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  Plus,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

const myRequests = [
  {
    id: "LR-0001",
    type: "Annual Leave",
    startDate: "2026-09-21",
    endDate: "2026-09-25",
    days: 5,
    status: "PENDING",
  },
  {
    id: "LR-0002",
    type: "Sick Leave",
    startDate: "2026-07-14",
    endDate: "2026-07-15",
    days: 2,
    status: "APPROVED",
  },
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default function MyLeavePage() {
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <CalendarDays
              size={20}
              className="text-slate-500"
            />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              Annual Leave
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              15 days
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Remaining balance
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <Clock3
              size={20}
              className="text-slate-500"
            />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              Pending
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              5 days
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Awaiting approval
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <CalendarDays
              size={20}
              className="text-slate-500"
            />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              Used
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              7 days
            </p>
            <p className="mt-1 text-xs text-slate-500">
              This leave year
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <CalendarDays
              size={20}
              className="text-slate-500"
            />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              Upcoming
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              21 Sep
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
                {myRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-5 py-4 text-sm font-medium text-slate-900">
                      {request.id}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {request.type}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatDate(request.startDate)} -{" "}
                      {formatDate(request.endDate)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {request.days}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge
                        status={request.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {myRequests.map((request) => (
              <div
                key={request.id}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {request.type}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {request.id}
                    </p>
                  </div>

                  <StatusBadge
                    status={request.status}
                  />
                </div>

                <p className="mt-4 text-sm text-slate-600">
                  {formatDate(request.startDate)} -{" "}
                  {formatDate(request.endDate)}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {request.days} day
                  {request.days === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            Development mode: Leave balances and requests are
            currently mocked pending backend integration.
          </p>
        </div>
      </div>
    </>
  );
}