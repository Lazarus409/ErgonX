"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Edit3,
  MapPin,
  Users,
  CalendarDays,
  Building2,
  ShieldCheck,
  MoreHorizontal,
  CheckCircle2,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type Employee = {
  id: string;
  name: string;
  employeeNumber: string;
  department: string;
  location: string;
  status: string;
};

const shift = {
  id: "shift-001",
  name: "Morning Shift",
  code: "MS-001",
  type: "DAY",
  status: "ACTIVE",
  startTime: "08:00",
  endTime: "17:00",
  breakDuration: 60,
  department: "Information Technology",
  location: "Head Office",
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  description:
    "Standard daytime shift for employees assigned to the Information Technology department.",
  gracePeriod: 15,
  overtimeEnabled: true,
  autoAttendance: true,
  lateAfter: "08:15",
  earlyDepartureBefore: "16:45",
};

const employees: Employee[] = [
  {
    id: "EMP-001",
    name: "Kwame Mensah",
    employeeNumber: "EMP-1001",
    department: "Information Technology",
    location: "Head Office",
    status: "ACTIVE",
  },
  {
    id: "EMP-002",
    name: "Ama Boateng",
    employeeNumber: "EMP-1002",
    department: "Information Technology",
    location: "Head Office",
    status: "ACTIVE",
  },
  {
    id: "EMP-003",
    name: "Daniel Owusu",
    employeeNumber: "EMP-1003",
    department: "Information Technology",
    location: "Head Office",
    status: "ACTIVE",
  },
  {
    id: "EMP-004",
    name: "Abena Asante",
    employeeNumber: "EMP-1004",
    department: "Information Technology",
    location: "Head Office",
    status: "ACTIVE",
  },
];

const activity = [
  {
    action: "Shift updated",
    description: "Working hours were updated from 08:00–16:00 to 08:00–17:00.",
    user: "ErgonX Administrator",
    date: "08 Sep 2026, 10:42",
  },
  {
    action: "Employee assigned",
    description: "Ama Boateng was assigned to this shift.",
    user: "HR Administrator",
    date: "05 Sep 2026, 14:18",
  },
  {
    action: "Shift created",
    description: "Morning Shift was created.",
    user: "ErgonX Administrator",
    date: "01 Sep 2026, 09:00",
  },
];

export default function ShiftDetailPage() {
  const [showMenu, setShowMenu] = useState(false);

  const workingHours = useMemo(() => {
    const start = Number(shift.startTime.split(":")[0]) * 60;
    const startMinutes = start + Number(shift.startTime.split(":")[1]);

    const end = Number(shift.endTime.split(":")[0]) * 60;
    const endMinutes = end + Number(shift.endTime.split(":")[1]);

    const totalMinutes = endMinutes - startMinutes - shift.breakDuration;

    return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  }, []);

  return (
    <main className="space-y-6">
      <PageHeader
        title={shift.name}
        description="View shift configuration, attendance rules and assigned employees."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/attendance/shifts"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Shifts
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((value) => !value)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-12 z-20 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setShowMenu(false)}
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit Shift
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* Shift summary */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Working Hours"
          value={workingHours}
          detail={`${shift.startTime} – ${shift.endTime}`}
        />

        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="Assigned Employees"
          value={String(employees.length)}
          detail="Active employees"
        />

        <SummaryCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Working Days"
          value={String(shift.workingDays.length)}
          detail="Monday to Friday"
        />

        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Status"
          value="Active"
          detail="Currently in use"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 xl:col-span-2">
          {/* Overview */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Shift Overview
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Core configuration for this shift.
                </p>
              </div>

              <StatusBadge status={shift.status} />
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              <InfoItem label="Shift Name" value={shift.name} />
              <InfoItem label="Shift Code" value={shift.code} />
              <InfoItem label="Shift Type" value="Day Shift" />
              <InfoItem label="Start Time" value={shift.startTime} />
              <InfoItem label="End Time" value={shift.endTime} />
              <InfoItem
                label="Break Duration"
                value={`${shift.breakDuration} minutes`}
              />
              <InfoItem label="Working Duration" value={workingHours} />
              <InfoItem label="Status" value="Active" />
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <p className="text-sm font-medium text-slate-700">
                Description
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {shift.description}
              </p>
            </div>
          </section>

          {/* Assignment */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Assignment
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Organisational context for this shift.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Building2 className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Department
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {shift.department}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <MapPin className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Location
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {shift.location}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Working days */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Working Days
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Days on which this shift is scheduled.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 p-5">
              {shift.workingDays.map((day) => (
                <span
                  key={day}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  {day}
                </span>
              ))}
            </div>
          </section>

          {/* Attendance rules */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Attendance Rules
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Rules applied when attendance is recorded against this shift.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              <RuleRow
                label="Grace Period"
                value={`${shift.gracePeriod} minutes`}
              />
              <RuleRow label="Late After" value={shift.lateAfter} />
              <RuleRow
                label="Early Departure Before"
                value={shift.earlyDepartureBefore}
              />
              <RuleRow
                label="Automatic Attendance"
                value={shift.autoAttendance ? "Enabled" : "Disabled"}
              />
              <RuleRow
                label="Overtime"
                value={shift.overtimeEnabled ? "Enabled" : "Disabled"}
              />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Quick edit */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Shift Actions
            </h2>

            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Edit3 className="h-4 w-4" />
              Edit Shift
            </button>
          </section>

          {/* Assigned employees */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Assigned Employees
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {employees.length} employees assigned.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {employees.map((employee) => (
                <div key={employee.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {employee.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {employee.employeeNumber}
                      </p>
                    </div>

                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {employee.department} · {employee.location}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Recent activity */}
          <section className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Recent Activity
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {activity.map((item) => (
                <div key={`${item.action}-${item.date}`} className="px-5 py-4">
                  <p className="text-sm font-medium text-slate-900">
                    {item.action}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {item.description}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {item.user} · {item.date}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Attendance and historical integrity
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Changes to this shift should not alter historical attendance
              records that were already recorded against previous shift
              configurations.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
          {icon}
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>

      <p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function RuleRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}