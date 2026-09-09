"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  Search,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type OvertimeRequest = {
  id: string;
  employee: string;
  employeeNumber: string;
  department: string;
  date: string;
  scheduledEnd: string;
  actualEnd: string;
  requestedHours: number;
  approvedHours: number;
  reason: string;
  submittedBy: string;
  submittedDate: string;
  status: string;
};

const initialRequests: OvertimeRequest[] = [
  {
    id: "OT-001",
    employee: "Kwame Mensah",
    employeeNumber: "EMP-1001",
    department: "Information Technology",
    date: "11 Sep 2026",
    scheduledEnd: "17:00",
    actualEnd: "20:15",
    requestedHours: 3.25,
    approvedHours: 0,
    reason: "Critical production system maintenance.",
    submittedBy: "Kwame Mensah",
    submittedDate: "11 Sep 2026, 20:30",
    status: "PENDING",
  },
  {
    id: "OT-002",
    employee: "Ama Boateng",
    employeeNumber: "EMP-1002",
    department: "Human Resources",
    date: "10 Sep 2026",
    scheduledEnd: "17:00",
    actualEnd: "19:00",
    requestedHours: 2,
    approvedHours: 2,
    reason: "Employee records migration and verification.",
    submittedBy: "Ama Boateng",
    submittedDate: "10 Sep 2026, 19:15",
    status: "APPROVED",
  },
  {
    id: "OT-003",
    employee: "Daniel Owusu",
    employeeNumber: "EMP-1003",
    department: "Finance",
    date: "09 Sep 2026",
    scheduledEnd: "17:00",
    actualEnd: "18:45",
    requestedHours: 1.75,
    approvedHours: 1.5,
    reason: "Month-end reconciliation activities.",
    submittedBy: "Finance Manager",
    submittedDate: "09 Sep 2026, 19:02",
    status: "APPROVED",
  },
  {
    id: "OT-004",
    employee: "Abena Asante",
    employeeNumber: "EMP-1004",
    department: "Administration",
    date: "08 Sep 2026",
    scheduledEnd: "17:00",
    actualEnd: "18:30",
    requestedHours: 1.5,
    approvedHours: 0,
    reason: "Administrative support for an institutional event.",
    submittedBy: "Abena Asante",
    submittedDate: "08 Sep 2026, 18:45",
    status: "REJECTED",
  },
  {
    id: "OT-005",
    employee: "Michael Osei",
    employeeNumber: "EMP-1005",
    department: "Operations",
    date: "07 Sep 2026",
    scheduledEnd: "17:00",
    actualEnd: "21:00",
    requestedHours: 4,
    approvedHours: 0,
    reason: "Operational incident response.",
    submittedBy: "Operations Manager",
    submittedDate: "07 Sep 2026, 21:15",
    status: "PENDING",
  },
];

export default function OvertimePage() {
  const [requests, setRequests] =
    useState<OvertimeRequest[]>(initialRequests);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  const [selectedRequest, setSelectedRequest] =
    useState<OvertimeRequest | null>(null);

  const [reviewAction, setReviewAction] =
    useState<"APPROVE" | "REJECT" | null>(null);

  const [approvedHours, setApprovedHours] = useState("");
  const [reviewReason, setReviewReason] = useState("");

  const departments = useMemo(
    () =>
      Array.from(
        new Set(requests.map((request) => request.department))
      ),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const query = search.toLowerCase().trim();

    return requests.filter((request) => {
      const matchesSearch =
        !query ||
        request.employee.toLowerCase().includes(query) ||
        request.employeeNumber.toLowerCase().includes(query) ||
        request.id.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        request.status === statusFilter;

      const matchesDepartment =
        departmentFilter === "ALL" ||
        request.department === departmentFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDepartment
      );
    });
  }, [
    requests,
    search,
    statusFilter,
    departmentFilter,
  ]);

  const pendingCount = requests.filter(
    (request) => request.status === "PENDING"
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status === "APPROVED"
  ).length;

  const totalRequested = requests.reduce(
    (total, request) => total + request.requestedHours,
    0
  );

  const totalApproved = requests.reduce(
    (total, request) => total + request.approvedHours,
    0
  );

  function openReview(request: OvertimeRequest) {
    setSelectedRequest(request);
    setReviewAction(null);
    setApprovedHours(
      request.approvedHours > 0
        ? String(request.approvedHours)
        : String(request.requestedHours)
    );
    setReviewReason("");
  }

  function closeReview() {
    setSelectedRequest(null);
    setReviewAction(null);
    setApprovedHours("");
    setReviewReason("");
  }

  function submitReview() {
    if (!selectedRequest || !reviewAction) {
      return;
    }

    if (reviewAction === "REJECT" && !reviewReason.trim()) {
      return;
    }

    const hours = Number(approvedHours);

    if (
      reviewAction === "APPROVE" &&
      (!Number.isFinite(hours) ||
        hours < 0 ||
        hours > selectedRequest.requestedHours)
    ) {
      return;
    }

    setRequests((current) =>
      current.map((request) =>
        request.id === selectedRequest.id
          ? {
              ...request,
              status:
                reviewAction === "APPROVE"
                  ? "APPROVED"
                  : "REJECTED",
              approvedHours:
                reviewAction === "APPROVE" ? hours : 0,
            }
          : request
      )
    );

    closeReview();
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Overtime"
        description="Review and manage employee overtime requests."
      />

      {/* Summary */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Pending Requests"
          value={String(pendingCount)}
          detail="Awaiting review"
        />

        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Approved"
          value={String(approvedCount)}
          detail="Approved requests"
        />

        <SummaryCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Hours Requested"
          value={`${totalRequested.toFixed(2)}h`}
          detail="Across all requests"
        />

        <SummaryCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Hours Approved"
          value={`${totalApproved.toFixed(2)}h`}
          detail="Approved overtime"
        />
      </section>

      {/* Filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search employee, employee number or request ID..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(event) =>
              setDepartmentFilter(event.target.value)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="ALL">All Departments</option>

            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("ALL");
              setDepartmentFilter("ALL");
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
                  Scheduled / Actual
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Requested
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Approved
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
              {filteredRequests.map((request) => (
                <tr
                  key={request.id}
                  className="hover:bg-slate-50"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {request.employee}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {request.employeeNumber} · {request.department}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      {request.date}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-700">
                      {request.scheduledEnd}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Actual: {request.actualEnd}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm font-medium text-slate-700">
                    {request.requestedHours.toFixed(2)}h
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {request.approvedHours > 0
                      ? `${request.approvedHours.toFixed(2)}h`
                      : "—"}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={request.status} />
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => openReview(request)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Eye className="h-4 w-4" />
                        Review
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredRequests.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >
                    <Clock3 className="mx-auto h-8 w-8 text-slate-400" />

                    <p className="mt-3 font-medium text-slate-900">
                      No overtime requests found
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
      </section>

      {/* Mobile cards */}
      <section className="space-y-3 lg:hidden">
        {filteredRequests.map((request) => (
          <div
            key={request.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {request.employee}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {request.employeeNumber}
                </p>
              </div>

              <StatusBadge status={request.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Info label="Date" value={request.date} />

              <Info
                label="Department"
                value={request.department}
              />

              <Info
                label="Requested"
                value={`${request.requestedHours.toFixed(2)}h`}
              />

              <Info
                label="Approved"
                value={
                  request.approvedHours > 0
                    ? `${request.approvedHours.toFixed(2)}h`
                    : "—"
                }
              />

              <Info
                label="Scheduled End"
                value={request.scheduledEnd}
              />

              <Info
                label="Actual End"
                value={request.actualEnd}
              />
            </div>

            <button
              type="button"
              onClick={() => openReview(request)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700"
            >
              <Eye className="h-4 w-4" />
              Review Overtime
            </button>
          </div>
        ))}

        {filteredRequests.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <Clock3 className="mx-auto h-8 w-8 text-slate-400" />

            <p className="mt-3 font-medium text-slate-900">
              No overtime requests found
            </p>
          </div>
        )}
      </section>

      {/* Review modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {selectedRequest.id}
                </p>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Review Overtime Request
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review the requested overtime before taking action.
                </p>
              </div>

              <button
                type="button"
                onClick={closeReview}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {/* Employee */}
              <section className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <UserCheck className="h-5 w-5 text-slate-600" />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900">
                      {selectedRequest.employee}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedRequest.employeeNumber} ·{" "}
                      {selectedRequest.department}
                    </p>
                  </div>
                </div>
              </section>

              {/* Time summary */}
              <section>
                <h3 className="text-sm font-semibold text-slate-900">
                  Overtime Summary
                </h3>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <TimeCard
                    label="Date"
                    value={selectedRequest.date}
                  />

                  <TimeCard
                    label="Scheduled End"
                    value={selectedRequest.scheduledEnd}
                  />

                  <TimeCard
                    label="Actual End"
                    value={selectedRequest.actualEnd}
                  />

                  <TimeCard
                    label="Requested"
                    value={`${selectedRequest.requestedHours.toFixed(2)}h`}
                  />
                </div>
              </section>

              {/* Reason */}
              <section className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Reason
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {selectedRequest.reason}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  Submitted by {selectedRequest.submittedBy} on{" "}
                  {selectedRequest.submittedDate}
                </p>
              </section>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <span className="text-sm text-slate-600">
                  Current status
                </span>

                <StatusBadge status={selectedRequest.status} />
              </div>

              {/* Actions */}
              {selectedRequest.status === "PENDING" ? (
                <section className="space-y-4 border-t border-slate-200 pt-5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewAction("APPROVE");
                        setReviewReason("");
                        setApprovedHours(
                          String(selectedRequest.requestedHours)
                        );
                      }}
                      className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium ${
                        reviewAction === "APPROVE"
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <CheckCircle2 className="mr-2 inline h-4 w-4" />
                      Approve
                    </button>

                    <button
                      type="button"
                      onClick={() => setReviewAction("REJECT")}
                      className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium ${
                        reviewAction === "REJECT"
                          ? "bg-red-600 text-white"
                          : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <XCircle className="mr-2 inline h-4 w-4" />
                      Reject
                    </button>
                  </div>

                  {reviewAction === "APPROVE" && (
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Approved Overtime Hours
                      </label>

                      <input
                        type="number"
                        min="0"
                        max={selectedRequest.requestedHours}
                        step="0.25"
                        value={approvedHours}
                        onChange={(event) =>
                          setApprovedHours(event.target.value)
                        }
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                      />

                      <p className="mt-1 text-xs text-slate-500">
                        Maximum:{" "}
                        {selectedRequest.requestedHours.toFixed(2)} hours.
                      </p>
                    </div>
                  )}

                  {reviewAction === "REJECT" && (
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Rejection Reason
                      </label>

                      <textarea
                        value={reviewReason}
                        onChange={(event) =>
                          setReviewReason(event.target.value)
                        }
                        rows={3}
                        placeholder="Provide a reason for rejecting this request..."
                        className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                      />
                    </div>
                  )}

                  {reviewAction && (
                    <button
                      type="button"
                      onClick={submitReview}
                      disabled={
                        reviewAction === "REJECT" &&
                        !reviewReason.trim()
                      }
                      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Confirm{" "}
                      {reviewAction === "APPROVE"
                        ? "Approval"
                        : "Rejection"}
                    </button>
                  )}
                </section>
              ) : (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  This overtime request has already been processed and
                  is read-only.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Integrity note */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />

          <div>
            <p className="text-sm font-semibold text-slate-800">
              Overtime and attendance integrity
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              Overtime approval should use the attendance record and
              configured schedule as the basis for review. Approved
              hours remain auditable and should not silently rewrite
              the original attendance record.
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

        <p className="text-sm font-medium text-slate-500">
          {label}
        </p>
      </div>

      <p className="mt-4 text-2xl font-semibold text-slate-900">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function Info({
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

      <p className="mt-1 text-sm font-medium text-slate-900">
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
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}