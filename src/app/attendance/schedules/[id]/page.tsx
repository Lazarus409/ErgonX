"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Users,
  MapPin,
  Pencil,
  CheckCircle2,
  UserCheck,
  Building2,
  History,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

const schedule = {
  id: "SCH-001",
  name: "Standard Morning Schedule",
  type: "FIXED",
  status: "ACTIVE" as const,
  startTime: "08:00",
  endTime: "17:00",
  breakDuration: "1 hour",
  workingHours: "8 hours",
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  department: "All Departments",
  location: "Head Office",
  assignedEmployees: 286,
  effectiveFrom: "01 January 2026",
  effectiveTo: "31 December 2026",
  gracePeriod: "10 minutes",
  overtimeAfter: "17:00",
};

const employees = [
  {
    number: "EMP-0001",
    name: "Ama Mensah",
    department: "Finance",
    position: "Senior Finance Officer",
    status: "ACTIVE",
  },
  {
    number: "EMP-0002",
    name: "Kwame Asante",
    department: "Human Resources",
    position: "HR Officer",
    status: "ACTIVE",
  },
  {
    number: "EMP-0003",
    name: "Akosua Boateng",
    department: "IT",
    position: "Systems Administrator",
    status: "ACTIVE",
  },
  {
    number: "EMP-0005",
    name: "Michael Osei",
    department: "Finance",
    position: "Accountant",
    status: "ACTIVE",
  },
  {
    number: "EMP-0011",
    name: "Esi Adjei",
    department: "Administration",
    position: "Administrative Officer",
    status: "ACTIVE",
  },
];

const recentActivity = [
  {
    date: "12 Sep 2026",
    action: "Schedule applied",
    detail: "286 employees evaluated against today's schedule.",
  },
  {
    date: "11 Sep 2026",
    action: "Attendance processed",
    detail: "Attendance records processed for the scheduled workforce.",
  },
  {
    date: "10 Sep 2026",
    action: "Schedule applied",
    detail: "Schedule remained active with no configuration changes.",
  },
];

export default function ScheduleDetailPage() {
  const [editMode, setEditMode] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6">
      <Link
        href="/attendance/schedules"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Schedules
      </Link>

      <PageHeader
        title={schedule.name}
        description={`${schedule.id} · ${schedule.type.toLowerCase()} schedule`}
        actions={
          <button
            onClick={() => {
              setEditMode(!editMode);
              setSaved(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" />
            {editMode ? "Cancel Edit" : "Edit Schedule"}
          </button>
        }
      />

      {saved && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-slate-700" />

          <div>
            <p className="text-sm font-semibold text-slate-900">
              Schedule changes saved
            </p>
            <p className="mt-1 text-sm text-slate-600">
              The schedule configuration has been updated in this frontend
              prototype.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Schedule Overview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Core configuration for this working schedule.
              </p>
            </div>

            <StatusBadge status={schedule.status} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail
              icon={<Clock3 className="h-4 w-4" />}
              label="Start Time"
              value={schedule.startTime}
            />

            <Detail
              icon={<Clock3 className="h-4 w-4" />}
              label="End Time"
              value={schedule.endTime}
            />

            <Detail
              label="Working Hours"
              value={schedule.workingHours}
            />

            <Detail
              label="Break Duration"
              value={schedule.breakDuration}
            />

            <Detail
              icon={<Users className="h-4 w-4" />}
              label="Assigned Employees"
              value={String(schedule.assignedEmployees)}
            />

            <Detail
              label="Schedule Type"
              value="Fixed"
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Assignment
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Where this schedule applies.
            </p>
          </div>

          <div className="space-y-5">
            <Detail
              icon={<Building2 className="h-4 w-4" />}
              label="Department"
              value={schedule.department}
            />

            <Detail
              icon={<MapPin className="h-4 w-4" />}
              label="Location"
              value={schedule.location}
            />

            <Detail
              label="Effective From"
              value={schedule.effectiveFrom}
            />

            <Detail
              label="Effective To"
              value={schedule.effectiveTo}
            />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-slate-600" />

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Working Days
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Days on which employees are expected to work.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ].map((day) => {
            const active = schedule.workingDays.includes(day);

            return (
              <div
                key={day}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-slate-600" />

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Attendance Rules
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Rules applied when attendance is evaluated.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <RuleCard
              label="Grace Period"
              value={schedule.gracePeriod}
            />

            <RuleCard
              label="Overtime After"
              value={schedule.overtimeAfter}
            />

            <RuleCard
              label="Break"
              value={schedule.breakDuration}
            />

            <RuleCard
              label="Expected Hours"
              value={schedule.workingHours}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-slate-600" />

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Assignment Summary
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Current employee assignment.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-5">
            <p className="text-sm text-slate-500">
              Employees assigned
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {schedule.assignedEmployees}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              {schedule.department} · {schedule.location}
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-slate-600" />

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Assigned Employees
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Employees currently associated with this schedule.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Employee
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Department
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Position
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {employees.map((employee) => (
                <tr
                  key={employee.number}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {employee.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {employee.number}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {employee.department}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {employee.position}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status="ACTIVE" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            Showing 5 sample employees of {schedule.assignedEmployees} assigned.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-slate-600" />

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent Activity
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Recent activity associated with this schedule.
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {recentActivity.map((activity) => (
            <div
              key={`${activity.date}-${activity.action}`}
              className="flex gap-4 p-5"
            >
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-700" />

              <div>
                <p className="text-sm font-medium text-slate-900">
                  {activity.action}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {activity.detail}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {activity.date}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editMode && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Schedule Configuration
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Frontend editing preview. Backend validation and persistence will
            be connected when the schedule API is available.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <EditField label="Start Time" value={schedule.startTime} />
            <EditField label="End Time" value={schedule.endTime} />
            <EditField label="Break Duration" value={schedule.breakDuration} />
            <EditField label="Grace Period" value={schedule.gracePeriod} />
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={() => {
                setSaved(true);
                setEditMode(false);
              }}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Save Changes
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>

      <p className="mt-1.5 text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}

function RuleCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function EditField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium text-slate-700">
        {label}
      </span>

      <input
        defaultValue={value}
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
      />
    </label>
  );
}
