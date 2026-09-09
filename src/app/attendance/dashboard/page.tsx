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
import PageHeader from "@/components/ui/PageHeader";
import KPIStatCard from "@/components/ui/KPIStatCard";
import StatusBadge from "@/components/ui/StatusBadge";

const attendanceTrend = [
  { day: "Mon", present: 91, absent: 5, late: 4 },
  { day: "Tue", present: 94, absent: 3, late: 3 },
  { day: "Wed", present: 89, absent: 7, late: 4 },
  { day: "Thu", present: 96, absent: 2, late: 2 },
  { day: "Fri", present: 92, absent: 4, late: 4 },
  { day: "Sat", present: 78, absent: 15, late: 7 },
  { day: "Sun", present: 64, absent: 27, late: 9 },
];

const departmentAttendance = [
  { department: "Human Resources", rate: 96 },
  { department: "Finance", rate: 93 },
  { department: "IT", rate: 91 },
  { department: "Operations", rate: 87 },
  { department: "Administration", rate: 95 },
];

const overtimeTrend = [
  { day: "Mon", hours: 12 },
  { day: "Tue", hours: 18 },
  { day: "Wed", hours: 15 },
  { day: "Thu", hours: 23 },
  { day: "Fri", hours: 19 },
  { day: "Sat", hours: 31 },
  { day: "Sun", hours: 8 },
];

export default function AttendanceDashboardPage() {
  const maxOvertime = Math.max(...overtimeTrend.map((item) => item.hours));

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
            Updated today
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KPIStatCard
          title="Present Today"
          value="428"
          icon={<UserCheck className="h-5 w-5" />}
          trend="+4.2%"
          trendDirection="up"
        />

        <KPIStatCard
          title="Absent Today"
          value="24"
          icon={<UserX className="h-5 w-5" />}
          trend="-8.1%"
          trendDirection="up"
        />

        <KPIStatCard
          title="Late Today"
          value="17"
          icon={<Clock3 className="h-5 w-5" />}
          trend="-3.4%"
          trendDirection="up"
        />

        <KPIStatCard
          title="Currently on Leave"
          value="31"
          icon={<CalendarDays className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Scheduled Today"
          value="452"
          icon={<Users className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Active Shifts"
          value="12"
          icon={<Activity className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Night Shift"
          value="46"
          icon={<Moon className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Flexible Work"
          value="38"
          icon={<Settings2 className="h-5 w-5" />}
        />

        <KPIStatCard
          title="Overtime Pending"
          value="14"
          icon={<Timer className="h-5 w-5" />}
          trend="+2"
          trendDirection="down"
        />

        <KPIStatCard
          title="Adjustments Pending"
          value="9"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Attendance Trend
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Seven-day attendance pattern.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
                Present
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                Absent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                Late
              </span>
            </div>
          </div>

          <div className="flex h-64 items-end gap-3 border-b border-slate-200 px-2">
            {attendanceTrend.map((item) => (
              <div
                key={item.day}
                className="flex h-full flex-1 flex-col justify-end gap-2"
              >
                <div className="flex h-full items-end justify-center gap-1">
                  <div
                    title={`${item.day}: ${item.present}% present`}
                    className="w-1/3 rounded-t bg-slate-900"
                    style={{ height: `${item.present}%` }}
                  />
                  <div
                    title={`${item.day}: ${item.absent}% absent`}
                    className="w-1/3 rounded-t bg-slate-300"
                    style={{ height: `${item.absent * 3}%` }}
                  />
                  <div
                    title={`${item.day}: ${item.late}% late`}
                    className="w-1/3 rounded-t bg-slate-500"
                    style={{ height: `${item.late * 5}%` }}
                  />
                </div>

                <span className="pb-2 text-center text-xs text-slate-500">
                  {item.day}
                </span>
              </div>
            ))}
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

          <div className="space-y-5">
            {departmentAttendance.map((item) => (
              <div key={item.department}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-slate-700">
                    {item.department}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {item.rate}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Overtime Trend
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Pending and recorded overtime hours.
              </p>
            </div>

            <Link
              href="/attendance/overtime"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Review overtime
            </Link>
          </div>

          <div className="flex h-52 items-end gap-3 border-b border-slate-200 px-2">
            {overtimeTrend.map((item) => (
              <div
                key={item.day}
                className="flex h-full flex-1 flex-col justify-end gap-2"
              >
                <div className="flex h-full items-end">
                  <div
                    title={`${item.hours} overtime hours`}
                    className="w-full rounded-t bg-slate-700"
                    style={{
                      height: `${(item.hours / maxOvertime) * 100}%`,
                    }}
                  />
                </div>

                <span className="pb-2 text-center text-xs text-slate-500">
                  {item.day}
                </span>
              </div>
            ))}
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
                  14 overtime records require review.
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
                  9 correction requests require review.
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
