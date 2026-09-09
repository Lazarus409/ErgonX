"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  User,
  AlertTriangle,
  FileText,
  History,
  Pencil,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

const attendanceRecord = {
  id: "ATT-001",
  employeeNumber: "EMP-0001",
  employee: "Ama Mensah",
  department: "Finance",
  position: "Senior Finance Officer",
  location: "Head Office",
  shift: "Morning Shift",
  date: "12 September 2026",
  scheduledIn: "08:00",
  scheduledOut: "17:00",
  checkIn: "07:54",
  checkOut: "17:12",
  breakDuration: "1h 00m",
  workedHours: "9h 18m",
  overtimeHours: "0h 12m",
  lateMinutes: 0,
  earlyDepartureMinutes: 0,
  status: "PRESENT",
  source: "Biometric Device",
  device: "Main Entrance Terminal",
};

const attendanceHistory = [
  {
    date: "12 Sep 2026",
    scheduled: "08:00 - 17:00",
    checkIn: "07:54",
    checkOut: "17:12",
    status: "PRESENT",
  },
  {
    date: "11 Sep 2026",
    scheduled: "08:00 - 17:00",
    checkIn: "08:17",
    checkOut: "17:03",
    status: "LATE",
  },
  {
    date: "10 Sep 2026",
    scheduled: "08:00 - 17:00",
    checkIn: "07:58",
    checkOut: "17:01",
    status: "PRESENT",
  },
  {
    date: "09 Sep 2026",
    scheduled: "08:00 - 17:00",
    checkIn: "08:02",
    checkOut: "17:00",
    status: "PRESENT",
  },
];

export default function AttendanceRecordDetailPage() {
  const [adjustmentRequested, setAdjustmentRequested] = useState(false);

  return (
    <div className="space-y-6">
      <Link
        href="/attendance/live"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Live Attendance
      </Link>

      <PageHeader
        title="Attendance Record"
        description={`${attendanceRecord.employeeNumber} · ${attendanceRecord.date}`}
        actions={
          <button
            onClick={() => setAdjustmentRequested(true)}
            disabled={adjustmentRequested}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Pencil className="h-4 w-4" />
            {adjustmentRequested
              ? "Adjustment Requested"
              : "Request Adjustment"}
          </button>
        }
      />

      {adjustmentRequested && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-slate-700" />

          <div>
            <p className="text-sm font-semibold text-slate-900">
              Adjustment request created
            </p>
            <p className="mt-1 text-sm text-slate-600">
              The attendance record has been marked for adjustment review.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Employee Information
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Employee and organisational assignment.
              </p>
            </div>

            <StatusBadge status="APPROVED" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem
              icon={<User className="h-4 w-4" />}
              label="Employee"
              value={attendanceRecord.employee}
            />

            <DetailItem
              label="Employee Number"
              value={attendanceRecord.employeeNumber}
            />

            <DetailItem
              label="Department"
              value={attendanceRecord.department}
            />

            <DetailItem
              label="Position"
              value={attendanceRecord.position}
            />

            <DetailItem
              icon={<MapPin className="h-4 w-4" />}
              label="Location"
              value={attendanceRecord.location}
            />

            <DetailItem
              label="Shift"
              value={attendanceRecord.shift}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">
              Attendance Status
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Current record status.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
            <CheckCircle2 className="h-6 w-6 text-slate-700" />

            <div>
              <p className="text-sm font-semibold text-slate-900">
                Present
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Attendance recorded successfully.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <MiniStat
              label="Late Minutes"
              value={`${attendanceRecord.lateMinutes} min`}
            />

            <MiniStat
              label="Early Departure"
              value={`${attendanceRecord.earlyDepartureMinutes} min`}
            />

            <MiniStat
              label="Overtime"
              value={attendanceRecord.overtimeHours}
            />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-slate-600" />

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Time Details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Scheduled and recorded attendance times.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TimeCard
            label="Scheduled In"
            value={attendanceRecord.scheduledIn}
          />

          <TimeCard
            label="Actual Check In"
            value={attendanceRecord.checkIn}
          />

          <TimeCard
            label="Scheduled Out"
            value={attendanceRecord.scheduledOut}
          />

          <TimeCard
            label="Actual Check Out"
            value={attendanceRecord.checkOut}
          />
        </div>

        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <MiniStat
            label="Break Duration"
            value={attendanceRecord.breakDuration}
          />

          <MiniStat
            label="Worked Hours"
            value={attendanceRecord.workedHours}
          />

          <MiniStat
            label="Overtime Hours"
            value={attendanceRecord.overtimeHours}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <FileText className="h-5 w-5 text-slate-600" />

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Attendance Source
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Source of the recorded attendance event.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <DetailItem
              label="Source"
              value={attendanceRecord.source}
            />

            <DetailItem
              label="Device"
              value={attendanceRecord.device}
            />

            <DetailItem
              label="Record ID"
              value={attendanceRecord.id}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-slate-600" />

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Exceptions
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Attendance exceptions requiring attention.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-slate-600" />

              <div>
                <p className="text-sm font-medium text-slate-900">
                  No attendance exception
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  This record currently requires no corrective action.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-slate-600" />

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent Attendance History
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Recent attendance records for this employee.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Scheduled
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Check In
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Check Out
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {attendanceHistory.map((record) => (
                <tr
                  key={record.date}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-5 py-4 text-sm font-medium text-slate-800">
                    {record.date}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {record.scheduled}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {record.checkIn}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {record.checkOut}
                  </td>

                  <td className="px-5 py-4">
                    {record.status === "PRESENT" ? (
                      <StatusBadge status="APPROVED" />
                    ) : (
                      <StatusBadge status="PENDING" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-5 w-5 text-slate-500" />

          <div>
            <p className="text-sm font-semibold text-slate-900">
              Attendance record integrity
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Attendance records should remain traceable and historical
              changes should be handled through authorised adjustment
              workflows rather than silently overwriting the original record.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
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
        <span>{label}</span>
      </div>

      <p className="mt-1.5 text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}

function TimeCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}
