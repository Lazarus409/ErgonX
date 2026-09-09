"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  MapPin,
  PencilLine,
  Timer,
} from "lucide-react";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE";

type AttendanceRecord = {
  date: string;
  day: string;
  scheduled: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: AttendanceStatus;
};

const attendanceHistory: AttendanceRecord[] = [
  {
    date: "12 Sep 2026",
    day: "Saturday",
    scheduled: "08:00 - 17:00",
    checkIn: "07:56",
    checkOut: "17:04",
    hours: "8h 38m",
    status: "PRESENT",
  },
  {
    date: "11 Sep 2026",
    day: "Friday",
    scheduled: "08:00 - 17:00",
    checkIn: "08:12",
    checkOut: "17:01",
    hours: "8h 34m",
    status: "LATE",
  },
  {
    date: "10 Sep 2026",
    day: "Thursday",
    scheduled: "08:00 - 17:00",
    checkIn: "07:59",
    checkOut: "17:00",
    hours: "8h 31m",
    status: "PRESENT",
  },
  {
    date: "09 Sep 2026",
    day: "Wednesday",
    scheduled: "08:00 - 17:00",
    checkIn: "08:03",
    checkOut: "17:08",
    hours: "8h 41m",
    status: "PRESENT",
  },
];

const statusClasses: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LATE: "bg-amber-50 text-amber-700 border-amber-200",
  ABSENT: "bg-red-50 text-red-700 border-red-200",
  ON_LEAVE: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function MyAttendancePage() {
  const [clockedIn, setClockedIn] = useState(true);
  const [checkIn, setCheckIn] = useState("07:56");
  const [checkOut, setCheckOut] = useState("--");
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState("");

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date()),
    []
  );

  const handleClockAction = () => {
    const now = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (clockedIn) {
      setCheckOut(now);
      setClockedIn(false);
    } else {
      setCheckIn(now);
      setCheckOut("--");
      setClockedIn(true);
    }
  };

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Employee Self-Service
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            My Attendance
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            View your attendance, schedule, clock in or out, and request
            adjustments.
          </p>
        </div>

        <button
          type="button"
          onClick={handleClockAction}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 md:w-auto"
        >
          {clockedIn ? <LogOut size={17} /> : <LogIn size={17} />}
          {clockedIn ? "Clock Out" : "Clock In"}
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Today</span>
            <CheckCircle2 size={19} className="text-emerald-600" />
          </div>

          <p className="mt-3 text-xl font-semibold text-slate-900">
            Present
          </p>

          <p className="mt-1 text-xs text-slate-500">{todayLabel}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Check In</span>
            <LogIn size={19} className="text-slate-600" />
          </div>

          <p className="mt-3 text-xl font-semibold text-slate-900">
            {checkIn}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Today&apos;s recorded time
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Check Out</span>
            <LogOut size={19} className="text-slate-600" />
          </div>

          <p className="mt-3 text-xl font-semibold text-slate-900">
            {checkOut}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Today&apos;s recorded time
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Schedule</span>
            <CalendarDays size={19} className="text-slate-600" />
          </div>

          <p className="mt-3 text-xl font-semibold text-slate-900">
            08:00 - 17:00
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Standard work schedule
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Today&apos;s Schedule
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your assigned work schedule for today.
                </p>
              </div>

              <Clock3 size={20} className="text-slate-500" />
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Schedule
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                Standard Workday
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Fixed schedule
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Working Hours
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                08:00 - 17:00
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Monday - Friday
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Break
              </p>

              <p className="mt-2 font-semibold text-slate-900">
                1 hour
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Scheduled break period
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Work Location
              </p>

              <p className="mt-2 flex items-center gap-2 font-semibold text-slate-900">
                <MapPin size={16} />
                Main Office
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Assigned work location
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Attendance Actions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage your own attendance records.
            </p>
          </div>

          <div className="space-y-3 p-5">
            <button
              type="button"
              onClick={handleClockAction}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  {clockedIn ? "Clock out" : "Clock in"}
                </span>

                <span className="mt-1 block text-xs text-slate-500">
                  {clockedIn
                    ? "End your current attendance session."
                    : "Start your attendance session."}
                </span>
              </span>

              {clockedIn ? <LogOut size={18} /> : <LogIn size={18} />}
            </button>

            <button
              type="button"
              onClick={() => setShowAdjustment(true)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  Request adjustment
                </span>

                <span className="mt-1 block text-xs text-slate-500">
                  Request a correction to your attendance record.
                </span>
              </span>

              <PencilLine size={18} />
            </button>

            <Link
              href="/me/leave"
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-4 text-left transition hover:bg-slate-50"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  View leave
                </span>

                <span className="mt-1 block text-xs text-slate-500">
                  Review your leave requests and balances.
                </span>
              </span>

              <CalendarDays size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">
                Recent Attendance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Your recent attendance records.
              </p>
            </div>

            <Timer size={20} className="text-slate-500" />
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Schedule</th>
                <th className="px-5 py-3 font-medium">Check In</th>
                <th className="px-5 py-3 font-medium">Check Out</th>
                <th className="px-5 py-3 font-medium">Hours</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {attendanceHistory.map((record) => (
                <tr key={record.date} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {record.date}
                    </p>
                    <p className="text-xs text-slate-500">{record.day}</p>
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {record.scheduled}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {record.checkIn}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {record.checkOut}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {record.hours}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses[record.status]}`}
                    >
                      {record.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {attendanceHistory.map((record) => (
            <div key={record.date} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {record.date}
                  </p>

                  <p className="text-xs text-slate-500">
                    {record.day}
                  </p>
                </div>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses[record.status]}`}
                >
                  {record.status.replace("_", " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Schedule</p>
                  <p className="mt-1 text-slate-700">
                    {record.scheduled}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Hours</p>
                  <p className="mt-1 text-slate-700">
                    {record.hours}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Check In</p>
                  <p className="mt-1 text-slate-700">
                    {record.checkIn}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Check Out</p>
                  <p className="mt-1 text-slate-700">
                    {record.checkOut}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {showAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900">
                Request Attendance Adjustment
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Submit a reason for the requested correction. Approval remains
                with the authorised reviewer.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Date
                  </label>

                  <input
                    value="13 Sep 2026"
                    readOnly
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600">
                    Current Check In
                  </label>

                  <input
                    value={checkIn}
                    readOnly
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Reason
                </label>

                <textarea
                  value={adjustmentReason}
                  onChange={(event) =>
                    setAdjustmentReason(event.target.value)
                  }
                  rows={4}
                  placeholder="Explain why an adjustment is required..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAdjustment(false);
                  setAdjustmentReason("");
                }}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!adjustmentReason.trim()}
                onClick={() => {
                  setShowAdjustment(false);
                  setAdjustmentReason("");
                  window.alert(
                    "Demo: attendance adjustment request submitted."
                  );
                }}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Development mode</p>

        <p className="mt-1">
          Clock in/out and attendance values on this screen are local demo
          interactions. In the final integration, attendance records and
          calculations will be controlled by the backend.
        </p>
      </div>
    </main>
  );
}
