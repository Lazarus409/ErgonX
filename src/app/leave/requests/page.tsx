"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";

type LeaveStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

type LeaveRequest = {
  id: string;
  employee: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  reason: string;
  submittedAt: string;
};

const requests: LeaveRequest[] = [
  {
    id: "LR-0001",
    employee: "Kwame Mensah",
    employeeId: "EMP-001",
    leaveType: "Annual Leave",
    startDate: "2026-09-21",
    endDate: "2026-09-25",
    days: 5,
    status: "PENDING",
    reason: "Annual vacation",
    submittedAt: "2026-09-10",
  },
  {
    id: "LR-0002",
    employee: "Ama Boateng",
    employeeId: "EMP-002",
    leaveType: "Sick Leave",
    startDate: "2026-09-14",
    endDate: "2026-09-15",
    days: 2,
    status: "APPROVED",
    reason: "Medical appointment",
    submittedAt: "2026-09-12",
  },
  {
    id: "LR-0003",
    employee: "Daniel Owusu",
    employeeId: "EMP-003",
    leaveType: "Annual Leave",
    startDate: "2026-10-05",
    endDate: "2026-10-09",
    days: 5,
    status: "PENDING",
    reason: "Personal vacation",
    submittedAt: "2026-09-11",
  },
  {
    id: "LR-0004",
    employee: "Akosua Asante",
    employeeId: "EMP-004",
    leaveType: "Maternity Leave",
    startDate: "2026-10-12",
    endDate: "2026-12-04",
    days: 40,
    status: "APPROVED",
    reason: "Maternity leave",
    submittedAt: "2026-09-05",
  },
  {
    id: "LR-0005",
    employee: "Kofi Addo",
    employeeId: "EMP-005",
    leaveType: "Annual Leave",
    startDate: "2026-08-17",
    endDate: "2026-08-21",
    days: 5,
    status: "REJECTED",
    reason: "Department staffing constraints",
    submittedAt: "2026-08-08",
  },
];

const leaveTypes = [
  "Annual Leave",
  "Sick Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Study Leave",
  "Unpaid Leave",
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default function LeaveRequestsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [leaveType, setLeaveType] = useState("ALL");
  const [employee, setEmployee] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const employees = useMemo(
    () =>
      Array.from(
        new Set(
          requests.map(
            (request) => request.employee
          )
        )
      ),
    []
  );

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesSearch =
        !search ||
        request.employee
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        request.employeeId
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        request.leaveType
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesStatus =
        status === "ALL" ||
        request.status === status;

      const matchesType =
        leaveType === "ALL" ||
        request.leaveType === leaveType;

      const matchesEmployee =
        employee === "ALL" ||
        request.employee === employee;

      const matchesFrom =
        !dateFrom ||
        request.startDate >= dateFrom;

      const matchesTo =
        !dateTo ||
        request.endDate <= dateTo;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesEmployee &&
        matchesFrom &&
        matchesTo
      );
    });
  }, [
    search,
    status,
    leaveType,
    employee,
    dateFrom,
    dateTo,
  ]);

  function resetFilters() {
    setSearch("");
    setStatus("ALL");
    setLeaveType("ALL");
    setEmployee("ALL");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <>
      <PageHeader
        title="Leave Requests"
        description="Review and manage employee leave requests."
      />

      <div className="mt-6 space-y-6">
        {/* Management summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Total Requests
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {requests.length}
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-600">
              Pending
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-900">
              {
                requests.filter(
                  (request) =>
                    request.status === "PENDING"
                ).length
              }
            </p>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-green-600">
              Approved
            </p>
            <p className="mt-2 text-2xl font-semibold text-green-900">
              {
                requests.filter(
                  (request) =>
                    request.status === "APPROVED"
                ).length
              }
            </p>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-red-600">
              Rejected
            </p>
            <p className="mt-2 text-2xl font-semibold text-red-900">
              {
                requests.filter(
                  (request) =>
                    request.status === "REJECTED"
                ).length
              }
            </p>
          </div>
        </div>

        {/* Filters */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search employee or request..."
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
            >
              <option value="ALL">
                All statuses
              </option>
              <option value="PENDING">
                Pending
              </option>
              <option value="APPROVED">
                Approved
              </option>
              <option value="REJECTED">
                Rejected
              </option>
              <option value="CANCELLED">
                Cancelled
              </option>
            </select>

            <select
              value={leaveType}
              onChange={(event) =>
                setLeaveType(event.target.value)
              }
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
            >
              <option value="ALL">
                All leave types
              </option>

              {leaveTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={employee}
              onChange={(event) =>
                setEmployee(event.target.value)
              }
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
            >
              <option value="ALL">
                All employees
              </option>

              {employees.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <X size={16} />
              Clear
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                From date
              </label>

              <input
                type="date"
                value={dateFrom}
                onChange={(event) =>
                  setDateFrom(event.target.value)
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                To date
              </label>

              <input
                type="date"
                value={dateTo}
                onChange={(event) =>
                  setDateTo(event.target.value)
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>
        </section>

        {/* Requests */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Employee Leave Requests
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Review submitted requests and take authorised
              workflow actions.
            </p>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No leave requests found"
                description="Try changing your filters."
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Employee
                      </th>

                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Leave Type
                      </th>

                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Period
                      </th>

                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Days
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
                    {filteredRequests.map(
                      (request) => (
                        <tr
                          key={request.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-5 py-4">
                            <Link
                              href={`/leave/requests/${request.id}`}
                              className="font-medium text-slate-900 hover:underline"
                            >
                              {request.employee}
                            </Link>

                            <p className="mt-0.5 text-xs text-slate-400">
                              {request.employeeId}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {request.leaveType}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatDate(
                              request.startDate
                            )}{" "}
                            -{" "}
                            {formatDate(
                              request.endDate
                            )}
                          </td>

                          <td className="px-5 py-4 text-sm font-medium text-slate-800">
                            {request.days}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              status={request.status}
                            />
                          </td>

                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/leave/requests/${request.id}`}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Eye size={14} />
                              Review
                            </Link>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="divide-y divide-slate-100 md:hidden">
                {filteredRequests.map(
                  (request) => (
                    <div
                      key={request.id}
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/leave/requests/${request.id}`}
                            className="font-medium text-slate-900"
                          >
                            {request.employee}
                          </Link>

                          <p className="mt-0.5 text-xs text-slate-400">
                            {request.employeeId}
                          </p>
                        </div>

                        <StatusBadge
                          status={request.status}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-400">
                            Leave Type
                          </p>
                          <p className="mt-1 text-slate-700">
                            {request.leaveType}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">
                            Days
                          </p>
                          <p className="mt-1 text-slate-700">
                            {request.days}
                          </p>
                        </div>

                        <div className="col-span-2">
                          <p className="text-xs text-slate-400">
                            Period
                          </p>
                          <p className="mt-1 text-slate-700">
                            {formatDate(
                              request.startDate
                            )}{" "}
                            -{" "}
                            {formatDate(
                              request.endDate
                            )}
                          </p>
                        </div>
                      </div>

                      <Link
                        href={`/leave/requests/${request.id}`}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-800"
                      >
                        <Eye size={15} />
                        Review request
                      </Link>
                    </div>
                  )
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
                <p className="text-xs text-slate-500">
                  Showing {filteredRequests.length} of{" "}
                  {requests.length}
                </p>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled
                    className="rounded-md border border-slate-200 p-1.5 text-slate-300"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="px-2 text-xs font-medium text-slate-600">
                    1
                  </span>

                  <button
                    type="button"
                    disabled
                    className="rounded-md border border-slate-200 p-1.5 text-slate-300"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            Development mode: Leave request data is currently
            mocked. Backend integration will connect this
            management screen to the approved Leave APIs.
          </p>
        </div>
      </div>
    </>
  );
}