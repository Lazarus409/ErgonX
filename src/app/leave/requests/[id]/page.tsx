"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  User,
  XCircle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

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
  balanceBefore: number;
  balanceAfter: number;
  policyEligible: boolean;
};

const request: LeaveRequest = {
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
  balanceBefore: 20,
  balanceAfter: 15,
  policyEligible: true,
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default function LeaveRequestDetailPage() {
  const [status, setStatus] =
    useState<LeaveStatus>(request.status);

  const [showDeclineForm, setShowDeclineForm] =
    useState(false);

  const [declineReason, setDeclineReason] =
    useState("");

  const [actionError, setActionError] =
    useState("");

  function approveRequest() {
    const confirmed = window.confirm(
      "Approve this leave request?"
    );

    if (!confirmed) {
      return;
    }

    setActionError("");
    setStatus("APPROVED");
  }

  function openDeclineForm() {
    setActionError("");
    setDeclineReason("");
    setShowDeclineForm(true);
  }

  function declineRequest() {
    if (!declineReason.trim()) {
      setActionError(
        "Please provide a reason for declining the request."
      );
      return;
    }

    const confirmed = window.confirm(
      "Decline this leave request?"
    );

    if (!confirmed) {
      return;
    }

    setStatus("REJECTED");
    setShowDeclineForm(false);
    setActionError("");
  }

  const canTakeAction = status === "PENDING";

  return (
    <>
      <PageHeader
        title={`Leave Request ${request.id}`}
        description="Review the employee leave request and take the appropriate authorised action."
        actions={
          <Link
            href="/leave/requests"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to Requests
          </Link>
        }
      />

      <div className="mt-6 space-y-6">
        {/* Request header */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <CalendarDays
                  size={23}
                  className="text-slate-600"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {request.leaveType}
                  </h2>

                  <StatusBadge status={status} />
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Submitted on{" "}
                  {formatDate(request.submittedAt)}
                </p>
              </div>
            </div>

            <div className="text-left lg:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Requested Duration
              </p>

              <p className="mt-1 text-xl font-semibold text-slate-950">
                {request.days} days
              </p>
            </div>
          </div>
        </section>

        {/* Approval action bar */}
        {canTakeAction && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Approval Required
                </p>

                <p className="mt-1 text-sm text-amber-800">
                  This request is waiting for an authorised
                  approver to review it.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={openDeclineForm}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <XCircle size={17} />
                  Decline
                </button>

                <button
                  type="button"
                  onClick={approveRequest}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <CheckCircle2 size={17} />
                  Approve
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Employee and request summary */}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Request Summary
              </h2>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Employee
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <User
                    size={16}
                    className="text-slate-400"
                  />

                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {request.employee}
                    </p>

                    <p className="text-xs text-slate-400">
                      {request.employeeId}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Leave Type
                </p>

                <p className="mt-2 text-sm text-slate-800">
                  {request.leaveType}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Start Date
                </p>

                <p className="mt-2 text-sm text-slate-800">
                  {formatDate(request.startDate)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  End Date
                </p>

                <p className="mt-2 text-sm text-slate-800">
                  {formatDate(request.endDate)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Duration
                </p>

                <p className="mt-2 text-sm font-medium text-slate-900">
                  {request.days} days
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Submitted
                </p>

                <p className="mt-2 text-sm text-slate-800">
                  {formatDate(request.submittedAt)}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Reason
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {request.reason}
                </p>
              </div>
            </div>
          </section>

          {/* Policy eligibility */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Policy Eligibility
              </h2>
            </div>

            <div className="p-5">
              {request.policyEligible ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      size={18}
                      className="text-green-600"
                    />

                    <p className="text-sm font-semibold text-green-900">
                      Eligible
                    </p>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-green-800">
                    The request currently meets the configured
                    leave policy requirements.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2">
                    <XCircle
                      size={18}
                      className="text-red-600"
                    />

                    <p className="text-sm font-semibold text-red-900">
                      Not eligible
                    </p>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-red-800">
                    The request does not currently meet the
                    configured leave policy requirements.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Balance impact */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Leave Balance Impact
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Projected balance if this request is approved.
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-400">
                Balance Before
              </p>

              <p className="mt-2 text-xl font-semibold text-slate-950">
                {request.balanceBefore} days
              </p>
            </div>

            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-xs text-amber-600">
                Requested
              </p>

              <p className="mt-2 text-xl font-semibold text-amber-900">
                -{request.days} days
              </p>
            </div>

            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-xs text-green-600">
                Projected Balance
              </p>

              <p className="mt-2 text-xl font-semibold text-green-900">
                {request.balanceAfter} days
              </p>
            </div>
          </div>
        </section>

        {/* Approval history */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Approval History
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Timeline of actions taken on this request.
            </p>
          </div>

          <div className="p-5">
            <div className="relative pl-8">
              <div className="absolute bottom-0 left-2 top-0 w-px bg-slate-200" />

              <div className="relative pb-6">
                <div className="absolute -left-8 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950">
                  <Clock3
                    size={11}
                    className="text-white"
                  />
                </div>

                <p className="text-sm font-medium text-slate-900">
                  Leave request submitted
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(request.submittedAt)}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Submitted by {request.employee}.
                </p>
              </div>

              <div className="relative">
                <div className="absolute -left-8 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white">
                  <Clock3
                    size={11}
                    className="text-slate-400"
                  />
                </div>

                <p className="text-sm font-medium text-slate-500">
                  Awaiting approval
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Current workflow state
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Attachments */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Attachments
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Supporting documents submitted with the request.
            </p>
          </div>

          <div className="p-5">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <FileText
                  size={17}
                  className="text-slate-500"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700">
                  No attachments
                </p>

                <p className="mt-0.5 text-xs text-slate-400">
                  No supporting documents were submitted.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Decline form */}
        {showDeclineForm && (
          <section className="rounded-xl border border-red-200 bg-white shadow-sm">
            <div className="border-b border-red-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-red-900">
                Decline Leave Request
              </h2>

              <p className="mt-1 text-xs text-red-700">
                Provide a reason that will be recorded with the
                workflow decision.
              </p>
            </div>

            <div className="p-5">
              {actionError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </div>
              )}

              <textarea
                value={declineReason}
                onChange={(event) =>
                  setDeclineReason(event.target.value)
                }
                rows={4}
                placeholder="Enter reason for declining this request..."
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50"
              />

              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowDeclineForm(false)
                  }
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={declineRequest}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Confirm Decline
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Development notice */}
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            Development mode: request details, approval state,
            policy eligibility and balance information are
            currently mocked. Backend workflow integration will
            replace these values when the Leave API contract is
            available.
          </p>
        </div>
      </div>
    </>
  );
}