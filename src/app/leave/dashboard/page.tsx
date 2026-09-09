"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Users,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import KPIStatCard from "@/components/ui/KPIStatCard";
import StatusBadge from "@/components/ui/StatusBadge";

const leaveDashboard = {
  pendingRequests: 12,
  awaitingApproval: 4,
  currentlyOnLeave: 7,
  upcomingLeave: 9,
  utilisation: 68,
  balanceSummary: {
    available: 124,
    used: 83,
  },
  staffingConflicts: 2,
};

const upcomingLeave = [
  {
    id: "LR-001",
    employee: "Ama Mensah",
    leaveType: "Annual Leave",
    dates: "16 Sep 2026 – 20 Sep 2026",
    status: "APPROVED",
  },
  {
    id: "LR-002",
    employee: "Kojo Asante",
    leaveType: "Sick Leave",
    dates: "18 Sep 2026 – 19 Sep 2026",
    status: "PENDING",
  },
  {
    id: "LR-003",
    employee: "Efua Owusu",
    leaveType: "Annual Leave",
    dates: "21 Sep 2026 – 25 Sep 2026",
    status: "APPROVED",
  },
];

export default function LeaveDashboardPage() {
  return (
    <main className="space-y-6">
      <PageHeader
        title="Leave Dashboard"
        description="Monitor leave requests, approvals, balances and staffing impact."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/leave/requests"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ClipboardList className="h-4 w-4" />
              View Requests
            </Link>

            <Link
              href="/me/leave/request"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Request Leave
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPIStatCard
          title="Pending Requests"
          value={leaveDashboard.pendingRequests}
          icon={<Clock3 className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Awaiting My Approval"
          value={leaveDashboard.awaitingApproval}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Currently on Leave"
          value={leaveDashboard.currentlyOnLeave}
          icon={<Users className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Upcoming Leave"
          value={leaveDashboard.upcomingLeave}
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Leave Utilisation
              </p>

              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {leaveDashboard.utilisation}%
              </p>
            </div>

            <div className="rounded-lg bg-slate-100 p-3">
              <CalendarDays className="h-5 w-5 text-slate-600" />
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-700"
              style={{ width: `${leaveDashboard.utilisation}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Current leave utilisation across the institution.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Balance Summary
              </p>

              <p className="mt-2 text-3xl font-semibold text-slate-900">
                {leaveDashboard.balanceSummary.available}
              </p>
            </div>

            <div className="rounded-lg bg-slate-100 p-3">
              <ClipboardList className="h-5 w-5 text-slate-600" />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-slate-500">Available</span>
            <span className="font-medium text-slate-900">
              {leaveDashboard.balanceSummary.available}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-500">Used</span>
            <span className="font-medium text-slate-900">
              {leaveDashboard.balanceSummary.used}
            </span>
          </div>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white p-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>

            <div>
              <p className="text-sm font-medium text-amber-900">
                Staffing Conflicts
              </p>

              <p className="mt-2 text-3xl font-semibold text-amber-950">
                {leaveDashboard.staffingConflicts}
              </p>

              <p className="mt-1 text-xs text-amber-800">
                Leave requests requiring staffing attention.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Upcoming Leave
            </h2>

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

        <div className="divide-y divide-slate-100">
          {upcomingLeave.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {request.employee}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {request.leaveType} · {request.dates}
                </p>
              </div>

              <StatusBadge status={request.status} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Leave Management
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage requests, policies and leave calendar from the Leave module.
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

      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3">
        <p className="text-xs text-slate-500">
          Development mode: dashboard data is currently mocked.
          Production integration will use GET /api/v1/leave/dashboard/.
        </p>
      </div>
    </main>
  );
}