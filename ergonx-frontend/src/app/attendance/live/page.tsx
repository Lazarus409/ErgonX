"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  Clock3,
  UserCheck,
  UserX,
  AlertTriangle,
  ChevronDown,
  Eye,
  LogOut,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  attendanceApi,
  employeesApi,
  getApiErrorMessage,
  organizationApi,
  schedulingApi,
} from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/types/api";
import { ATTENDANCE_STATUSES } from "@/types/attendance";
import type {
  AttendanceRecord,
  ScheduleAssignment,
  Shift,
  WorkSchedule,
} from "@/types/attendance";
import type { Department, Employee, Employment, Location } from "@/types/hr";
import { EM_DASH, humanizeEnum, toISODate } from "@/lib/format";

const ALL = "ALL";
const SEARCH_DEBOUNCE_MS = 350;

interface Reference {
  employees: Map<string, Employee>;
  employments: Map<string, Employment>;
  assignments: Map<string, ScheduleAssignment>;
  schedules: Map<string, WorkSchedule>;
  shifts: Map<string, Shift>;
  departments: Department[];
  locations: Location[];
}

const emptyReference: Reference = {
  employees: new Map(),
  employments: new Map(),
  assignments: new Map(),
  schedules: new Map(),
  shifts: new Map(),
  departments: [],
  locations: [],
};

/** Times arrive as ISO datetimes; only the clock time is shown. */
function clockTime(value: string | null): string {
  if (!value) {
    return EM_DASH;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LiveAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [reference, setReference] = useState<Reference>(emptyReference);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [department, setDepartment] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [clockOutTarget, setClockOutTarget] = useState<AttendanceRecord | null>(
    null,
  );
  const [actionRunning, setActionRunning] = useState(false);
  const [actionError, setActionError] = useState("");

  const today = useMemo(() => toISODate(new Date()), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;

    async function loadReference() {
      try {
        const [
          employeeIndex,
          employmentIndex,
          assignments,
          schedules,
          shifts,
          departments,
          locations,
        ] = await Promise.all([
          employeesApi.loadEmployeeIndex(),
          employeesApi.loadCurrentEmploymentIndex(),
          schedulingApi.listScheduleAssignments({
            page_size: MAX_PAGE_SIZE,
            is_current: true,
          }),
          schedulingApi.listWorkSchedules({ page_size: MAX_PAGE_SIZE }),
          schedulingApi.listShifts({ page_size: MAX_PAGE_SIZE }),
          organizationApi.listDepartments({
            page_size: MAX_PAGE_SIZE,
            ordering: "name",
          }),
          organizationApi.listLocations({
            page_size: MAX_PAGE_SIZE,
            ordering: "name",
          }),
        ]);

        if (!active) {
          return;
        }

        setReference({
          employees: employeeIndex.byId,
          employments: employmentIndex.byEmployee,
          assignments: new Map(
            assignments.results.map((item) => [item.id, item]),
          ),
          schedules: new Map(schedules.results.map((item) => [item.id, item])),
          shifts: new Map(shifts.results.map((item) => [item.id, item])),
          departments: departments.results,
          locations: locations.results,
        });
      } catch {
        if (active) {
          setReference(emptyReference);
        }
      }
    }

    loadReference();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    let active = true;

    async function loadRecords() {
      setLoading(true);
      setError(null);

      try {
        // The calendar projection carries the derived status and minute
        // fields; there is no separate attendance-alert resource.
        const result = await attendanceApi.getAttendanceCalendar({
          attendance_date: today,
          page_size: MAX_PAGE_SIZE,
          ordering: "-check_in",
          search: debouncedSearch || undefined,
          status: status === ALL ? undefined : status,
        });

        if (active) {
          setRecords(result.results);
          setLastUpdated(new Date().toLocaleTimeString("en-GB"));
        }
      } catch (caught) {
        if (active) {
          setError(getApiErrorMessage(caught));
          setRecords([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRecords();

    return () => {
      active = false;
    };
  }, [today, debouncedSearch, status, reloadToken]);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  /**
   * Department and location live on the employee's current employment, not
   * on the attendance record, so those two filters are applied client-side.
   */
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const employment = reference.employments.get(record.employee);

      const matchesDepartment =
        department === ALL || employment?.department === department;

      const matchesLocation =
        location === ALL || employment?.location === location;

      return matchesDepartment && matchesLocation;
    });
  }, [records, department, location, reference.employments]);

  const summary = useMemo(
    () => ({
      present: records.filter((record) => record.status === "PRESENT").length,
      late: records.filter((record) => record.status === "LATE").length,
      absent: records.filter((record) => record.status === "ABSENT").length,
      leave: records.filter((record) => record.status === "ON_LEAVE").length,
    }),
    [records],
  );

  /** Resolves the scheduled window for FIXED schedules, which are the only
   * ones with a single shift attached to the assignment. */
  const scheduleFor = useCallback(
    (record: AttendanceRecord) => {
      const assignment = record.schedule_assignment
        ? reference.assignments.get(record.schedule_assignment)
        : undefined;

      const schedule = assignment
        ? reference.schedules.get(assignment.work_schedule)
        : undefined;

      const shift = schedule?.fixed_shift
        ? reference.shifts.get(schedule.fixed_shift)
        : undefined;

      return {
        name: schedule?.name ?? EM_DASH,
        start: shift ? shift.start_time.slice(0, 5) : EM_DASH,
        end: shift ? shift.end_time.slice(0, 5) : EM_DASH,
      };
    },
    [reference],
  );

  const confirmClockOut = useCallback(async () => {
    if (!clockOutTarget) {
      return;
    }

    setActionRunning(true);
    setActionError("");

    try {
      await attendanceApi.clockOut(clockOutTarget.id);
      setClockOutTarget(null);
      refresh();
    } catch (caught) {
      setClockOutTarget(null);
      setActionError(getApiErrorMessage(caught));
    } finally {
      setActionRunning(false);
    }
  }, [clockOutTarget, refresh]);

  const employeeLabel = (record: AttendanceRecord) => {
    const employee = reference.employees.get(record.employee);

    return {
      name: employee ? employeesApi.employeeDisplayName(employee) : EM_DASH,
      number: employee?.employee_number ?? EM_DASH,
    };
  };

  const departmentName = (record: AttendanceRecord) => {
    const employment = reference.employments.get(record.employee);

    return (
      reference.departments.find((item) => item.id === employment?.department)
        ?.name ?? EM_DASH
    );
  };

  const locationName = (record: AttendanceRecord) => {
    const employment = reference.employments.get(record.employee);

    return (
      reference.locations.find((item) => item.id === employment?.location)
        ?.name ?? EM_DASH
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Attendance"
        description="Monitor today's employee attendance and attendance exceptions."
        actions={
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={refresh} />}

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
          <span className="ml-2">{lastUpdated ?? "Loading..."}</span>
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
            aria-label="Filter by status"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value={ALL}>All Statuses</option>

            {ATTENDANCE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {humanizeEnum(option)}
              </option>
            ))}
          </select>

          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            aria-label="Filter by department"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value={ALL}>All Departments</option>

            {reference.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            aria-label="Filter by location"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value={ALL}>All Locations</option>

            {reference.locations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
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
                  Schedule
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
              {filteredRecords.map((record) => {
                const employee = employeeLabel(record);
                const schedule = scheduleFor(record);
                const canClockOut =
                  record.check_in !== null && record.check_out === null;

                return (
                  <tr
                    key={record.id}
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

                    <td className="px-5 py-4 text-sm text-slate-700">
                      <p>{departmentName(record)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {locationName(record)}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {schedule.name}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      <p>{schedule.start}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        to {schedule.end}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {clockTime(record.check_in)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {clockTime(record.check_out)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {attendanceApi.formatMinutes(record.worked_minutes)}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={record.status} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {canClockOut && (
                          <button
                            type="button"
                            onClick={() => setClockOutTarget(record)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <LogOut className="h-4 w-4" />
                            Clock out
                          </button>
                        )}

                        <Link
                          href={`/attendance/live/${record.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      {loading
                        ? "Loading attendance..."
                        : "No attendance records found"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {loading
                        ? "Please wait."
                        : "No attendance has been recorded for today with these filters."}
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
            const employee = employeeLabel(record);
            const schedule = scheduleFor(record);

            return (
              <div key={record.id} className="p-4">
                <button
                  onClick={() => setExpandedId(expanded ? null : record.id)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {employee.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {employee.number} · {departmentName(record)}
                    </p>
                  </div>

                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div className="mt-3 flex items-center justify-between">
                  <StatusBadge status={record.status} />

                  <Link
                    href={`/attendance/live/${record.id}`}
                    className="text-sm font-medium text-slate-700"
                  >
                    View
                  </Link>
                </div>

                {expanded && (
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                    <Info label="Schedule" value={schedule.name} />
                    <Info label="Location" value={locationName(record)} />
                    <Info label="Scheduled In" value={schedule.start} />
                    <Info label="Check In" value={clockTime(record.check_in)} />
                    <Info
                      label="Check Out"
                      value={clockTime(record.check_out)}
                    />
                    <Info
                      label="Worked Hours"
                      value={attendanceApi.formatMinutes(record.worked_minutes)}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {filteredRecords.length === 0 && !loading && (
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

      <ConfirmDialog
        open={clockOutTarget !== null}
        title="Clock out this employee?"
        description="The backend records the clock-out time and reclassifies worked, late and overtime minutes for the day."
        confirmLabel="Clock out"
        loading={actionRunning}
        onConfirm={confirmClockOut}
        onCancel={() => setClockOutTarget(null)}
      />
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-800">{value}</p>
    </div>
  );
}
