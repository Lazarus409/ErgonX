"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  Search,
  X,
  XCircle,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import {
  attendanceApi,
  employeesApi,
  getApiErrorMessage,
  organizationApi,
} from "@/lib/api";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, emptyPage } from "@/types/api";
import type { PaginatedData } from "@/types/api";
import type { AttendanceRecord, OvertimeRecord } from "@/types/attendance";
import type { Department, Employee, Employment } from "@/types/hr";
import { EM_DASH, formatDate, formatNumber } from "@/lib/format";

const ALL = "ALL";
const SEARCH_DEBOUNCE_MS = 350;

type ReviewAction = "approve" | "reject";

interface Reference {
  employees: Map<string, Employee>;
  employments: Map<string, Employment>;
  departments: Department[];
  attendance: Map<string, AttendanceRecord>;
}

const emptyReference: Reference = {
  employees: new Map(),
  employments: new Map(),
  departments: [],
  attendance: new Map(),
};

interface Totals {
  pending: number;
  approved: number;
}

export default function OvertimePage() {
  const [data, setData] = useState<PaginatedData<OvertimeRecord>>(() =>
    emptyPage<OvertimeRecord>(),
  );
  const [reference, setReference] = useState<Reference>(emptyReference);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [departmentFilter, setDepartmentFilter] = useState(ALL);
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<OvertimeRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [approvedMinutes, setApprovedMinutes] = useState("");
  const [reviewRunning, setReviewRunning] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;

    async function loadReference() {
      try {
        const [employeeIndex, employmentIndex, departments, pending, approved] =
          await Promise.all([
            employeesApi.loadEmployeeIndex(),
            employeesApi.loadCurrentEmploymentIndex(),
            organizationApi.listDepartments({
              page_size: MAX_PAGE_SIZE,
              ordering: "name",
            }),
            attendanceApi
              .listOvertimeRecords({ status: "PENDING", page_size: 1 })
              .then((result) => result.count),
            attendanceApi
              .listOvertimeRecords({ status: "APPROVED", page_size: 1 })
              .then((result) => result.count),
          ]);

        if (!active) {
          return;
        }

        setReference((current) => ({
          ...current,
          employees: employeeIndex.byId,
          employments: employmentIndex.byEmployee,
          departments: departments.results,
        }));

        setTotals({ pending, approved });
      } catch {
        if (active) {
          setTotals(null);
        }
      }
    }

    loadReference();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    let active = true;

    async function loadRecords() {
      setLoading(true);
      setError(null);

      try {
        const result = await attendanceApi.listOvertimeRecords({
          page,
          page_size: DEFAULT_PAGE_SIZE,
          ordering: "-created_at",
          status: statusFilter === ALL ? undefined : statusFilter,
        });

        if (!active || requestRef.current !== requestId) {
          return;
        }

        setData(result);

        // Overtime rows reference an attendance record by id; the dates and
        // clock times shown come from those records.
        const attendanceIds = Array.from(
          new Set(result.results.map((record) => record.attendance_record)),
        );

        const attendance = await Promise.all(
          attendanceIds.map((id) =>
            attendanceApi.getAttendanceRecord(id).catch(() => null),
          ),
        );

        if (!active || requestRef.current !== requestId) {
          return;
        }

        setReference((current) => {
          const next = new Map(current.attendance);

          for (const record of attendance) {
            if (record) {
              next.set(record.id, record);
            }
          }

          return { ...current, attendance: next };
        });
      } catch (caught) {
        if (!active || requestRef.current !== requestId) {
          return;
        }

        setError(getApiErrorMessage(caught));
        setData(emptyPage<OvertimeRecord>());
      } finally {
        if (active && requestRef.current === requestId) {
          setLoading(false);
        }
      }
    }

    loadRecords();

    return () => {
      active = false;
    };
  }, [page, statusFilter, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const describe = useCallback(
    (record: OvertimeRecord) => {
      const employee = reference.employees.get(record.employee);
      const employment = reference.employments.get(record.employee);
      const attendance = reference.attendance.get(record.attendance_record);

      const department =
        reference.departments.find((item) => item.id === employment?.department)
          ?.name ?? EM_DASH;

      return {
        name: employee ? employeesApi.employeeDisplayName(employee) : EM_DASH,
        number: employee?.employee_number ?? EM_DASH,
        departmentId: employment?.department ?? null,
        department,
        date: attendance ? formatDate(attendance.attendance_date) : EM_DASH,
        checkOut: attendance?.check_out
          ? new Date(attendance.check_out).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : EM_DASH,
      };
    },
    [reference],
  );

  /**
   * Search and department are filtered client-side: the overtime endpoint
   * filters only on `employee` and `status`.
   */
  const filteredRecords = useMemo(() => {
    return data.results.filter((record) => {
      const info = describe(record);

      const matchesSearch =
        !debouncedSearch ||
        info.name.toLowerCase().includes(debouncedSearch) ||
        info.number.toLowerCase().includes(debouncedSearch);

      const matchesDepartment =
        departmentFilter === ALL || info.departmentId === departmentFilter;

      return matchesSearch && matchesDepartment;
    });
  }, [data.results, debouncedSearch, departmentFilter, describe]);

  const openReview = (record: OvertimeRecord, action: ReviewAction) => {
    setSelected(record);
    setReviewAction(action);
    setReviewError("");
    setApprovedMinutes(
      String(
        record.approved_minutes > 0
          ? record.approved_minutes
          : record.calculated_minutes,
      ),
    );
  };

  const closeReview = () => {
    setSelected(null);
    setReviewAction(null);
    setApprovedMinutes("");
    setReviewError("");
  };

  const submitReview = useCallback(async () => {
    if (!selected || !reviewAction) {
      return;
    }

    setReviewRunning(true);
    setReviewError("");

    try {
      if (reviewAction === "approve") {
        const minutes = Number(approvedMinutes);

        if (!Number.isFinite(minutes) || minutes < 0) {
          setReviewError("Enter the number of minutes to approve.");
          setReviewRunning(false);
          return;
        }

        // The backend rejects approved minutes above the calculated total.
        await attendanceApi.approveOvertime(selected.id, minutes);
      } else {
        await attendanceApi.rejectOvertime(selected.id);
      }

      closeReview();
      reload();
    } catch (caught) {
      setReviewError(getApiErrorMessage(caught));
    } finally {
      setReviewRunning(false);
    }
  }, [selected, reviewAction, approvedMinutes, reload]);

  const totalPages = Math.max(1, Math.ceil(data.count / DEFAULT_PAGE_SIZE));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Overtime"
        description="Review overtime generated from attendance. Only approved overtime is consumed by Payroll."
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      {/* Summary */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Pending Requests"
          value={totals ? formatNumber(totals.pending) : EM_DASH}
          detail="Awaiting review"
        />

        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Approved"
          value={totals ? formatNumber(totals.approved) : EM_DASH}
          detail="Approved records"
        />

        <SummaryCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Calculated (page)"
          value={attendanceApi.formatMinutes(
            filteredRecords.reduce(
              (total, record) => total + record.calculated_minutes,
              0,
            ),
          )}
          detail="On the current page"
        />

        <SummaryCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Approved (page)"
          value={attendanceApi.formatMinutes(
            filteredRecords.reduce(
              (total, record) => total + record.approved_minutes,
              0,
            ),
          )}
          detail="On the current page"
        />
      </section>

      {/* Filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee or employee number..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            aria-label="Filter by department"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value={ALL}>All Departments</option>

            {reference.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value={ALL}>All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter(ALL);
              setDepartmentFilter(ALL);
              setPage(1);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            Clear
          </button>
        </div>
      </section>

      {/* Desktop table */}
      <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Employee
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Clock Out
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Calculated
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Approved
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rate
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => {
                const info = describe(record);
                const isPending = record.status === "PENDING";

                return (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{info.name}</p>

                      <p className="mt-1 text-xs text-slate-500">
                        {info.number} · {info.department}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        {info.date}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {info.checkOut}
                    </td>

                    <td className="px-5 py-4 text-sm font-medium text-slate-700">
                      {attendanceApi.formatMinutes(record.calculated_minutes)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {record.approved_minutes > 0
                        ? attendanceApi.formatMinutes(record.approved_minutes)
                        : EM_DASH}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      ×{formatNumber(record.rate_multiplier)}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={record.status} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {isPending ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openReview(record, "reject")}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </button>

                            <button
                              type="button"
                              onClick={() => openReview(record, "approve")}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Decision recorded
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      {loading
                        ? "Loading overtime records..."
                        : "No overtime records found"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {loading
                        ? "Please wait."
                        : "Overtime is generated from attendance; none matches these filters."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            Page {page} of {totalPages} · {data.count} records
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={loading || !data.previous}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={loading || !data.next}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Mobile cards */}
      <section className="space-y-3 lg:hidden">
        {filteredRecords.map((record) => {
          const info = describe(record);
          const isPending = record.status === "PENDING";

          return (
            <div
              key={record.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{info.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {info.number} · {info.department}
                  </p>
                </div>

                <StatusBadge status={record.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Info label="Date" value={info.date} />
                <Info label="Clock Out" value={info.checkOut} />
                <Info
                  label="Calculated"
                  value={attendanceApi.formatMinutes(record.calculated_minutes)}
                />
                <Info
                  label="Approved"
                  value={
                    record.approved_minutes > 0
                      ? attendanceApi.formatMinutes(record.approved_minutes)
                      : EM_DASH
                  }
                />
              </div>

              {isPending && (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openReview(record, "reject")}
                    className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    Reject
                  </button>

                  <button
                    type="button"
                    onClick={() => openReview(record, "approve")}
                    className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Review modal */}
      {selected && reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {reviewAction === "approve"
                  ? "Approve Overtime"
                  : "Reject Overtime"}
              </h2>

              <button
                onClick={closeReview}
                disabled={reviewRunning}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {reviewError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {reviewError}
                </div>
              )}

              <div className="rounded-lg bg-slate-50 p-4 text-sm">
                <p className="font-medium text-slate-900">
                  {describe(selected).name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {describe(selected).date} · Calculated{" "}
                  {attendanceApi.formatMinutes(selected.calculated_minutes)}
                </p>
              </div>

              {reviewAction === "approve" ? (
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Approved minutes
                  </span>

                  <input
                    type="number"
                    min="0"
                    max={selected.calculated_minutes}
                    value={approvedMinutes}
                    onChange={(event) => setApprovedMinutes(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />

                  <span className="block text-xs text-slate-500">
                    Cannot exceed the calculated{" "}
                    {selected.calculated_minutes} minutes.
                  </span>
                </label>
              ) : (
                <p className="text-sm text-slate-600">
                  Rejecting records the decision against this overtime record.
                  Rejected overtime is not consumed by Payroll.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={closeReview}
                disabled={reviewRunning}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={submitReview}
                disabled={reviewRunning}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
                  reviewAction === "approve"
                    ? "bg-slate-900 hover:bg-slate-800"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {reviewRunning
                  ? "Processing..."
                  : reviewAction === "approve"
                    ? "Approve"
                    : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>

        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          {icon}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
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
