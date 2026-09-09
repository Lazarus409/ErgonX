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

type Adjustment = {
  id: string;
  employee: string;
  employeeNumber: string;
  department: string;
  date: string;
  originalCheckIn: string;
  originalCheckOut: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
  submittedBy: string;
  submittedDate: string;
  status: string;
};

const initialAdjustments: Adjustment[] = [
  {
    id: "ADJ-001",
    employee: "Kwame Mensah",
    employeeNumber: "EMP-1001",
    department: "Information Technology",
    date: "11 Sep 2026",
    originalCheckIn: "08:42",
    originalCheckOut: "17:02",
    requestedCheckIn: "08:05",
    requestedCheckOut: "17:02",
    reason: "Biometric device did not capture the initial check-in.",
    submittedBy: "Kwame Mensah",
    submittedDate: "11 Sep 2026, 10:14",
    status: "PENDING",
  },
  {
    id: "ADJ-002",
    employee: "Ama Boateng",
    employeeNumber: "EMP-1002",
    department: "Human Resources",
    date: "10 Sep 2026",
    originalCheckIn: "08:11",
    originalCheckOut: "-",
    requestedCheckIn: "08:09",
    requestedCheckOut: "17:04",
    reason: "Check-out was not recorded by the attendance device.",
    submittedBy: "Ama Boateng",
    submittedDate: "10 Sep 2026, 18:21",
    status: "PENDING",
  },
  {
    id: "ADJ-003",
    employee: "Daniel Owusu",
    employeeNumber: "EMP-1003",
    department: "Finance",
    date: "09 Sep 2026",
    originalCheckIn: "09:24",
    originalCheckOut: "17:15",
    requestedCheckIn: "08:56",
    requestedCheckOut: "17:15",
    reason: "Device recorded the attendance several minutes after arrival.",
    submittedBy: "Daniel Owusu",
    submittedDate: "09 Sep 2026, 18:02",
    status: "APPROVED",
  },
  {
    id: "ADJ-004",
    employee: "Abena Asante",
    employeeNumber: "EMP-1004",
    department: "Administration",
    date: "08 Sep 2026",
    originalCheckIn: "08:03",
    originalCheckOut: "16:20",
    requestedCheckIn: "08:03",
    requestedCheckOut: "17:00",
    reason: "Attendance record did not capture the full working period.",
    submittedBy: "Abena Asante",
    submittedDate: "08 Sep 2026, 17:40",
    status: "REJECTED",
  },
  {
    id: "ADJ-005",
    employee: "Michael Osei",
    employeeNumber: "EMP-1005",
    department: "Operations",
    date: "07 Sep 2026",
    originalCheckIn: "08:15",
    originalCheckOut: "17:00",
    requestedCheckIn: "08:00",
    requestedCheckOut: "17:00",
    reason: "Network interruption affected attendance capture.",
    submittedBy: "Michael Osei",
    submittedDate: "07 Sep 2026, 17:30",
    status: "APPROVED",
  },
];

export default function AttendanceAdjustmentsPage() {
  const [adjustments, setAdjustments] =
    useState<Adjustment[]>(initialAdjustments);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  const [selectedAdjustment, setSelectedAdjustment] =
    useState<Adjustment | null>(null);

  const [reviewAction, setReviewAction] =
    useState<"APPROVE" | "REJECT" | null>(null);

  const [reviewReason, setReviewReason] = useState("");

  const departments = useMemo(() => {
    return Array.from(
      new Set(adjustments.map((item) => item.department))
    );
  }, [adjustments]);

  const filteredAdjustments = useMemo(() => {
    const query = search.toLowerCase().trim();

    return adjustments.filter((item) => {
      const matchesSearch =
        !query ||
        item.employee.toLowerCase().includes(query) ||
        item.employeeNumber.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        item.status === statusFilter;

      const matchesDepartment =
        departmentFilter === "ALL" ||
        item.department === departmentFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDepartment
      );
    });
  }, [
    adjustments,
    search,
    statusFilter,
    departmentFilter,
  ]);

  const pendingCount = adjustments.filter(
    (item) => item.status === "PENDING"
  ).length;

  const approvedCount = adjustments.filter(
    (item) => item.status === "APPROVED"
  ).length;

  const rejectedCount = adjustments.filter(
    (item) => item.status === "REJECTED"
  ).length;

  function openReview(item: Adjustment) {
    setSelectedAdjustment(item);
    setReviewAction(null);
    setReviewReason("");
  }

  function closeReview() {
    setSelectedAdjustment(null);
    setReviewAction(null);
    setReviewReason("");
  }

  function submitReview() {
    if (!selectedAdjustment || !reviewAction) {
      return;
    }

    if (reviewAction === "REJECT" && !reviewReason.trim()) {
      return;
    }

    const newStatus =
      reviewAction === "APPROVE"
        ? "APPROVED"
        : "REJECTED";

    setAdjustments((current) =>
      current.map((item) =>
        item.id === selectedAdjustment.id
          ? {
              ...item,
              status: newStatus,
            }
          : item
      )
    );

    closeReview();
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Attendance Adjustments"
        description="Review and manage requests to correct attendance records."
      />

      {/* Summary */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Total Requests"
          value={String(adjustments.length)}
          detail="Attendance adjustments"
        />

        <SummaryCard
          icon={<AlertCircle className="h-5 w-5" />}
          label="Pending"
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
          icon={<XCircle className="h-5 w-5" />}
          label="Rejected"
          value={String(rejectedCount)}
          detail="Rejected requests"
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
                  Original
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Requested
                </th>

                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reason
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
              {filteredAdjustments.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {item.employee}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {item.employeeNumber} · {item.department}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      {item.date}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm text-slate-700">
                      In: {item.originalCheckIn}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Out: {item.originalCheckOut}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-slate-700">
                      In: {item.requestedCheckIn}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Out: {item.requestedCheckOut}
                    </p>
                  </td>

                  <td className="max-w-xs px-5 py-4">
                    <p className="truncate text-sm text-slate-600">
                      {item.reason}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={item.status} />
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => openReview(item)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Eye className="h-4 w-4" />
                        Review
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredAdjustments.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center"
                  >
                    <Clock3 className="mx-auto h-8 w-8 text-slate-400" />

                    <p className="mt-3 font-medium text-slate-900">
                      No adjustments found
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

      {/* Mobile */}
      <section className="space-y-3 lg:hidden">
        {filteredAdjustments.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {item.employee}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {item.employeeNumber}
                </p>
              </div>

              <StatusBadge status={item.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Info
                label="Date"
                value={item.date}
              />

              <Info
                label="Department"
                value={item.department}
              />

              <Info
                label="Original"
                value={`${item.originalCheckIn} – ${item.originalCheckOut}`}
              />

              <Info
                label="Requested"
                value={`${item.requestedCheckIn} – ${item.requestedCheckOut}`}
              />
            </div>

            <p className="mt-4 text-sm leading-5 text-slate-600">
              {item.reason}
            </p>

            <button
              type="button"
              onClick={() => openReview(item)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700"
            >
              <Eye className="h-4 w-4" />
              Review Adjustment
            </button>
          </div>
        ))}

        {filteredAdjustments.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <Clock3 className="mx-auto h-8 w-8 text-slate-400" />

            <p className="mt-3 font-medium text-slate-900">
              No adjustments found
            </p>
          </div>
        )}
      </section>

      {/* Review modal */}
      {selectedAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {selectedAdjustment.id}
                </p>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  Review Attendance Adjustment
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review the requested change before taking action.
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
                      {selectedAdjustment.employee}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {selectedAdjustment.employeeNumber} ·{" "}
                      {selectedAdjustment.department}
                    </p>
                  </div>
                </div>
              </section>

              {/* Comparison */}
              <section>
                <h3 className="text-sm font-semibold text-slate-900">
                  Attendance Comparison
                </h3>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ComparisonCard
                    title="Original Record"
                    checkIn={selectedAdjustment.originalCheckIn}
                    checkOut={selectedAdjustment.originalCheckOut}
                  />

                  <ComparisonCard
                    title="Requested Record"
                    checkIn={selectedAdjustment.requestedCheckIn}
                    checkOut={selectedAdjustment.requestedCheckOut}
                    highlight
                  />
                </div>
              </section>

              {/* Reason */}
              <section className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Reason
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {selectedAdjustment.reason}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  Submitted by {selectedAdjustment.submittedBy} on{" "}
                  {selectedAdjustment.submittedDate}
                </p>
              </section>

              {/* Current status */}
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <span className="text-sm text-slate-600">
                  Current status
                </span>

                <StatusBadge
                  status={selectedAdjustment.status}
                />
              </div>

              {/* Review controls */}
              {selectedAdjustment.status === "PENDING" && (
                <section className="space-y-4 border-t border-slate-200 pt-5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewAction("APPROVE");
                        setReviewReason("");
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
                        placeholder="Provide a reason for rejecting this adjustment..."
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
              )}

              {selectedAdjustment.status !== "PENDING" && (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  This adjustment has already been processed and is
                  read-only.
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
              Historical attendance integrity
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              An approved adjustment represents a controlled correction
              to an attendance record. Historical records should remain
              auditable rather than being silently overwritten.
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

function ComparisonCard({
  title,
  checkIn,
  checkOut,
  highlight = false,
}: {
  title: string;
  checkIn: string;
  checkOut: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-slate-300 bg-slate-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500">Check-in</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {checkIn}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Check-out</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {checkOut}
          </p>
        </div>
      </div>
    </div>
  );
}