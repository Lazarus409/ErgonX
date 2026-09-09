"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Download,
  RefreshCw,
  Clock3,
  UserCheck,
  UserX,
  AlertTriangle,
  ChevronDown,
  Eye,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type AttendanceRecord = {
  id: string;
  employeeNumber: string;
  employee: string;
  department: string;
  location: string;
  shift: string;
  scheduledIn: string;
  checkIn: string | null;
  scheduledOut: string;
  checkOut: string | null;
  status: "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE" | "NOT_STARTED";
  workedHours: string;
};

const initialRecords: AttendanceRecord[] = [
  {
    id: "ATT-001",
    employeeNumber: "EMP-0001",
    employee: "Ama Mensah",
    department: "Finance",
    location: "Head Office",
    shift: "Morning Shift",
    scheduledIn: "08:00",
    checkIn: "07:54",
    scheduledOut: "17:00",
    checkOut: "17:12",
    status: "PRESENT",
    workedHours: "9h 18m",
  },
  {
    id: "ATT-002",
    employeeNumber: "EMP-0002",
    employee: "Kwame Asante",
    department: "Human Resources",
    location: "Head Office",
    shift: "Morning Shift",
    scheduledIn: "08:00",
    checkIn: "08:17",
    scheduledOut: "17:00",
    checkOut: null,
    status: "LATE",
    workedHours: "8h 31m",
  },
  {
    id: "ATT-003",
    employeeNumber: "EMP-0003",
    employee: "Akosua Boateng",
    department: "IT",
    location: "Head Office",
    shift: "Morning Shift",
    scheduledIn: "08:00",
    checkIn: "07:58",
    scheduledOut: "17:00",
    checkOut: null,
    status: "PRESENT",
    workedHours: "8h 32m",
  },
  {
    id: "ATT-004",
    employeeNumber: "EMP-0004",
    employee: "Daniel Owusu",
    department: "Operations",
    location: "Regional Office",
    shift: "Morning Shift",
    scheduledIn: "08:00",
    checkIn: null,
    scheduledOut: "17:00",
    checkOut: null,
    status: "ABSENT",
    workedHours: "0h",
  },
  {
    id: "ATT-005",
    employeeNumber: "EMP-0005",
    employee: "Michael Osei",
    department: "Finance",
    location: "Head Office",
    shift: "Flexible",
    scheduledIn: "09:00",
    checkIn: "08:51",
    scheduledOut: "17:00",
    checkOut: null,
    status: "PRESENT",
    workedHours: "7h 41m",
  },
  {
    id: "ATT-006",
    employeeNumber: "EMP-0006",
    employee: "Esi Adjei",
    department: "Administration",
    location: "Head Office",
    shift: "Morning Shift",
    scheduledIn: "08:00",
    checkIn: null,
    scheduledOut: "17:00",
    checkOut: null,
    status: "ON_LEAVE",
    workedHours: "0h",
  },
  {
    id: "ATT-007",
    employeeNumber: "EMP-0007",
    employee: "Yaw Mensah",
    department: "IT",
    location: "Remote",
    shift: "Flexible",
    scheduledIn: "09:00",
    checkIn: null,
    scheduledOut: "17:00",
    checkOut: null,
    status: "NOT_STARTED",
    workedHours: "0h",
  },
];


export default function LiveAttendancePage() {
  const [records, setRecords] = useState(initialRecords);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [department, setDepartment] = useState("All Departments");
  const [location, setLocation] = useState("All Locations");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState("Just now");

  const filteredRecords = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return records.filter((record) => {
      const matchesSearch =
        !searchValue ||
        record.employee.toLowerCase().includes(searchValue) ||
        record.employeeNumber.toLowerCase().includes(searchValue);

      const matchesStatus =
        status === "All Statuses" || record.status === status;

      const matchesDepartment =
        department === "All Departments" ||
        record.department === department;

      const matchesLocation =
        location === "All Locations" ||
        record.location === location;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDepartment &&
        matchesLocation
      );
    });
  }, [records, search, status, department, location]);

  const refreshAttendance = () => {
    setLastUpdated("Just now");
    setRecords([...records]);
  };

  const summary = {
    present: records.filter((record) => record.status === "PRESENT").length,
    late: records.filter((record) => record.status === "LATE").length,
    absent: records.filter((record) => record.status === "ABSENT").length,
    leave: records.filter((record) => record.status === "ON_LEAVE").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Attendance"
        description="Monitor today's employee attendance and attendance exceptions."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={refreshAttendance}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <button
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Today&apos;s Attendance
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Live attendance monitoring for the current institution.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Live
          <span className="ml-2">{lastUpdated}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Present"
          value={summary.present}
          icon={<UserCheck className="h-5 w-5" />}
        />

        <SummaryCard
          title="Late"
          value={summary.late}
          icon={<Clock3 className="h-5 w-5" />}
        />

        <SummaryCard
          title="Absent"
          value={summary.absent}
          icon={<UserX className="h-5 w-5" />}
        />

        <SummaryCard
          title="On Leave"
          value={summary.leave}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee or employee number..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option>All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="ABSENT">Absent</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="NOT_STARTED">Not Started</option>
          </select>

          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option>All Departments</option>
            <option>Human Resources</option>
            <option>Finance</option>
            <option>IT</option>
            <option>Operations</option>
            <option>Administration</option>
          </select>

          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option>All Locations</option>
            <option>Head Office</option>
            <option>Regional Office</option>
            <option>Remote</option>
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Employee
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Department
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shift
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
                  Hours
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredRecords.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {record.employee}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {record.employeeNumber}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    <p>{record.department}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {record.location}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {record.shift}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    <p>{record.scheduledIn}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      to {record.scheduledOut}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {record.checkIn || "—"}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {record.checkOut || "—"}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {record.workedHours}
                  </td>

                  <td className="px-5 py-4">
                    <AttendanceStatus status={record.status} />
                  </td>

                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/attendance/live/${record.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      No attendance records found
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {filteredRecords.map((record) => {
            const expanded = expandedId === record.id;

            return (
              <div key={record.id} className="p-4">
                <button
                  onClick={() =>
                    setExpandedId(expanded ? null : record.id)
                  }
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {record.employee}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {record.employeeNumber} · {record.department}
                    </p>
                  </div>

                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div className="mt-3 flex items-center justify-between">
                  <AttendanceStatus status={record.status} />

                  <Link
                    href={`/attendance/live/${record.id}`}
                    className="text-sm font-medium text-slate-700"
                  >
                    View
                  </Link>
                </div>

                {expanded && (
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                    <Info label="Shift" value={record.shift} />
                    <Info label="Location" value={record.location} />
                    <Info label="Scheduled In" value={record.scheduledIn} />
                    <Info label="Check In" value={record.checkIn || "—"} />
                    <Info label="Check Out" value={record.checkOut || "—"} />
                    <Info label="Worked Hours" value={record.workedHours} />
                  </div>
                )}
              </div>
            );
          })}

          {filteredRecords.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                No attendance records found
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            Showing {filteredRecords.length} of {records.length} records
          </p>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Live monitoring
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>

        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          {icon}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function AttendanceStatus({
  status,
}: {
  status: AttendanceRecord["status"];
}) {
  if (status === "PRESENT") {
    return <StatusBadge status="APPROVED" />;
  }

  if (status === "LATE") {
    return <StatusBadge status="PENDING" />;
  }

  if (status === "ABSENT") {
    return <StatusBadge status="REJECTED" />;
  }

  if (status === "ON_LEAVE") {
    return <StatusBadge status="ACTIVE" />;
  }

  return <StatusBadge status="DRAFT" />;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-800">{value}</p>
    </div>
  );
}
