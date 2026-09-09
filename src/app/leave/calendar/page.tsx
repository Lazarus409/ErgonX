"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

type LeaveEvent = {
  id: string;
  employee: string;
  department: string;
  type: string;
  start: string;
  end: string;
  status: "APPROVED" | "PENDING";
};

const leaveEvents: LeaveEvent[] = [
  {
    id: "LR-001",
    employee: "Ama Mensah",
    department: "Finance",
    type: "Annual Leave",
    start: "2026-09-07",
    end: "2026-09-11",
    status: "APPROVED",
  },
  {
    id: "LR-002",
    employee: "Kwame Asante",
    department: "Human Resources",
    type: "Sick Leave",
    start: "2026-09-09",
    end: "2026-09-10",
    status: "APPROVED",
  },
  {
    id: "LR-003",
    employee: "Akosua Boateng",
    department: "IT",
    type: "Annual Leave",
    start: "2026-09-14",
    end: "2026-09-18",
    status: "APPROVED",
  },
  {
    id: "LR-004",
    employee: "Daniel Owusu",
    department: "Operations",
    type: "Personal Leave",
    start: "2026-09-16",
    end: "2026-09-17",
    status: "PENDING",
  },
  {
    id: "LR-005",
    employee: "Michael Osei",
    department: "Finance",
    type: "Annual Leave",
    start: "2026-09-21",
    end: "2026-09-25",
    status: "APPROVED",
  },
];

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function isDateInRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);

  // Convert JavaScript Sunday-first index to Monday-first.
  const mondayIndex = (firstDay.getDay() + 6) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const previousMonthDays = new Date(year, month, 0).getDate();

  const cells: Array<{
    date: Date;
    currentMonth: boolean;
  }> = [];

  for (let i = mondayIndex - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, previousMonthDays - i),
      currentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: new Date(year, month, day),
      currentMonth: true,
    });
  }

  let nextDay = 1;

  while (cells.length < 42) {
    cells.push({
      date: new Date(year, month + 1, nextDay),
      currentMonth: false,
    });

    nextDay++;
  }

  return cells;
}

export default function LeaveCalendarPage() {
  const today = new Date();

  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [department, setDepartment] = useState("All Departments");
  const [leaveType, setLeaveType] = useState("All Types");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = useMemo(
    () => getMonthDays(year, month),
    [year, month]
  );

  const filteredEvents = useMemo(() => {
    return leaveEvents.filter((event) => {
      const departmentMatch =
        department === "All Departments" ||
        event.department === department;

      const leaveTypeMatch =
        leaveType === "All Types" ||
        event.type === leaveType;

      return departmentMatch && leaveTypeMatch;
    });
  }, [department, leaveType]);

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Calendar"
        description="View approved and pending employee leave across the institution."
      />

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={previousMonth}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            onClick={nextMonth}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <button
            onClick={goToToday}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>

          <div className="ml-1 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">
              {monthNames[month]} {year}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
          >
            <option>All Departments</option>
            <option>Finance</option>
            <option>Human Resources</option>
            <option>IT</option>
            <option>Operations</option>
          </select>

          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
          >
            <option>All Types</option>
            <option>Annual Leave</option>
            <option>Sick Leave</option>
            <option>Personal Leave</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {weekDays.map((day) => (
            <div
              key={day}
              className="border-r border-slate-200 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map(({ date, currentMonth }, index) => {
            const dateString = formatDate(date);

            const dayEvents = filteredEvents.filter((event) =>
              isDateInRange(dateString, event.start, event.end)
            );

            const isToday =
              dateString === formatDate(today);

            return (
              <div
                key={`${dateString}-${index}`}
                className={`min-h-[145px] border-r border-b border-slate-200 p-2 last:border-r-0 ${
                  currentMonth ? "bg-white" : "bg-slate-50/70"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? "bg-slate-900 font-semibold text-white"
                        : currentMonth
                          ? "text-slate-700"
                          : "text-slate-400"
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  {dayEvents.length > 0 && (
                    <span className="text-xs text-slate-400">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {dayEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/leave/requests/${event.id}`}
                      className={`block rounded-md border px-2 py-1.5 text-left transition hover:shadow-sm ${
                        event.status === "APPROVED"
                          ? "border-slate-200 bg-slate-50"
                          : "border-amber-200 bg-amber-50"
                      }`}
                    >
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {event.employee}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {event.type}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="h-3 w-3 rounded-sm bg-slate-200" />
          Approved Leave
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="h-3 w-3 rounded-sm bg-amber-100 ring-1 ring-amber-200" />
          Pending Leave
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
          <Users className="h-4 w-4" />
          {filteredEvents.length} leave request
          {filteredEvents.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
