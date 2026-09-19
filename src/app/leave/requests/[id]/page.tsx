"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Send,
  User,
  XCircle,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  employeesApi,
  getApiErrorMessage,
  isApiRequestError,
  leaveApi,
} from "@/lib/api";
import type { Employee } from "@/types/hr";
import type {
  LeaveApproval,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
} from "@/types/leave";
import { EM_DASH, formatDate, formatDateTime, formatNumber } from "@/lib/format";

type PendingAction = "submit" | "approve" | "reject" | "cancel" | null;

interface RequestDetail {
  request: LeaveRequest;
  employee: Employee | null;
  leaveType: LeaveType | null;
  balance: LeaveBalance | null;
  approvals: LeaveApproval[];
}

/**
 * Loads the request plus the related records the screen displays. The related
 * reads are tolerated individually: a missing balance or an approval trail the
 * role cannot see must not blank out the request itself.
 */
async function loadDetail(id: string): Promise<RequestDetail> {
  const request = await leaveApi.getLeaveRequest(id);

  const [employee, leaveType, balance, approvals] = await Promise.all([
    employeesApi.getEmployee(request.employee).catch(() => null),
    leaveApi.getLeaveType(request.leave_type).catch(() => null),
    leaveApi
      .listLeaveBalances({
        employee: request.employee,
        leave_type: request.leave_type,
        year: Number(request.start_date.slice(0, 4)),
        page_size: 1,
      })
      .then((page) => page.results[0] ?? null)
      .catch(() => null),
    leaveApi
      .listLeaveApprovals({
        leave_request: id,
        ordering: "sequence",
        page_size: 100,
      })
      .then((page) => page.results)
      .catch(() => []),
  ]);

  return { request, employee, leaveType, balance, approvals };
}

export default function LeaveRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionRunning, setActionRunning] = useState(false);
  const [actionError, setActionError] = useState("");

  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    if (!id) {
      return;
    }

    let active = true;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const result = await loadDetail(id);

        if (active) {
          setDetail(result);
        }
      } catch (caught) {
        if (active) {
          setError(getApiErrorMessage(caught));
          setDetail(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [id, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  /**
   * Runs a workflow transition and re-reads the record. The backend owns the
   * resulting state, so nothing is applied optimistically.
   */
  const runAction = useCallback(async () => {
    if (!pendingAction || !id) {
      return;
    }

    setActionRunning(true);
    setActionError("");

    try {
      switch (pendingAction) {
        case "submit":
          await leaveApi.submitLeaveRequest(id);
          break;
        case "approve":
          await leaveApi.approveLeaveRequest(id);
          break;
        case "reject":
          await leaveApi.rejectLeaveRequest(id, declineReason.trim());
          break;
        case "cancel":
          await leaveApi.cancelLeaveRequest(id);
          break;
      }

      setPendingAction(null);
      setShowDeclineForm(false);
      setDeclineReason("");
      reload();
    } catch (caught) {
      setPendingAction(null);

      // Surface the backend's stable error message: insufficient balance,
      // an invalid transition or a permission failure all land here.
      setActionError(
        isApiRequestError(caught)
          ? caught.message
          : getApiErrorMessage(caught),
      );
    } finally {
      setActionRunning(false);
    }
  }, [pendingAction, id, declineReason, reload]);

  const openDeclineForm = useCallback(() => {
    setActionError("");
    setDeclineReason("");
    setShowDeclineForm(true);
  }, []);

  const confirmDecline = useCallback(() => {
    if (!declineReason.trim()) {
      setActionError("Please provide a reason for declining the request.");
      return;
    }

    setActionError("");
    setPendingAction("reject");
  }, [declineReason]);

  if (loading && !detail) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <p className="mt-4 text-sm text-slate-500">
            Loading leave request...
          </p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <>
        <PageHeader
          title="Leave Request"
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

        <div className="mt-6">
          <ErrorState
            message={error ?? "This leave request could not be loaded."}
            onRetry={reload}
          />
        </div>
      </>
    );
  }

  const { request, employee, leaveType, balance, approvals } = detail;

  const status = request.status;
  const isDraft = status === "DRAFT";
  const isPending = status === "PENDING";
  const canApprove = isPending;
  const canCancel = isDraft || isPending;

  const employeeName = employee
    ? employeesApi.employeeDisplayName(employee)
    : EM_DASH;

  const requestedDays = formatNumber(request.requested_days);

  // The balance the backend reports now. For a request that has not been
  // decided yet, the projection below shows the effect of approving it; once
  // approved or rejected the reported balance already reflects the outcome.
  const available = balance ? Number(balance.available) : null;
  const requested = Number(request.requested_days);
  const showsProjection = isDraft || isPending;

  const projected =
    available !== null && showsProjection ? available - requested : null;

  return (
    <>
      <PageHeader
        title="Leave Request"
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
        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* Request header */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <CalendarDays size={23} className="text-slate-600" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-950">
                    {leaveType?.name ?? EM_DASH}
                  </h2>

                  <StatusBadge status={status} />
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {request.submitted_at
                    ? `Submitted on ${formatDate(request.submitted_at)}`
                    : "Not yet submitted"}
                </p>
              </div>
            </div>

            <div className="text-left lg:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Requested Duration
              </p>

              <p className="mt-1 text-xl font-semibold text-slate-950">
                {requestedDays} days
              </p>
            </div>
          </div>
        </section>

        {/* Workflow action bar */}
        {(canApprove || canCancel) && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {isDraft ? "Submission Required" : "Approval Required"}
                </p>

                <p className="mt-1 text-sm text-amber-800">
                  {isDraft
                    ? "This request is still a draft and has not entered the approval workflow."
                    : "This request is waiting for an authorised approver to review it."}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {canCancel && (
                  <button
                    type="button"
                    onClick={() => setPendingAction("cancel")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <XCircle size={17} />
                    Cancel Request
                  </button>
                )}

                {isDraft && (
                  <button
                    type="button"
                    onClick={() => setPendingAction("submit")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    <Send size={17} />
                    Submit
                  </button>
                )}

                {canApprove && (
                  <>
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
                      onClick={() => setPendingAction("approve")}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      <CheckCircle2 size={17} />
                      Approve
                    </button>
                  </>
                )}
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
                  <User size={16} className="text-slate-400" />

                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {employeeName}
                    </p>

                    <p className="text-xs text-slate-400">
                      {employee?.employee_number ?? EM_DASH}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Leave Type
                </p>

                <p className="mt-2 text-sm text-slate-800">
                  {leaveType?.name ?? EM_DASH}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Start Date
                </p>

                <p className="mt-2 text-sm text-slate-800">
                  {formatDate(request.start_date)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  End Date
                </p>

                <p className="mt-2 text-sm text-slate-800">
                  {formatDate(request.end_date)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Duration
                </p>

                <p className="mt-2 text-sm font-medium text-slate-900">
                  {requestedDays} days
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Submitted
                </p>

                <p className="mt-2 text-sm text-slate-800">
                  {request.submitted_at
                    ? formatDateTime(request.submitted_at)
                    : EM_DASH}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Reason
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {request.reason || EM_DASH}
                </p>
              </div>
            </div>
          </section>

          {/*
            Leave policy eligibility is enforced by the backend when a request
            is created and submitted; there is no read-only eligibility-check
            endpoint. The configured leave-type rules are shown instead of a
            derived verdict.
          */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Policy Eligibility
              </h2>
            </div>

            <div className="p-5">
              {leaveType ? (
                <>
                  <dl className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Paid leave</dt>
                      <dd className="font-medium text-slate-900">
                        {leaveType.is_paid ? "Yes" : "No"}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Requires approval</dt>
                      <dd className="font-medium text-slate-900">
                        {leaveType.requires_approval ? "Yes" : "No"}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Requires attachment</dt>
                      <dd className="font-medium text-slate-900">
                        {leaveType.requires_attachment ? "Yes" : "No"}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    Policy eligibility is validated by the backend when the
                    request is submitted and approved.
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Leave type configuration is unavailable.
                </p>
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
              {showsProjection
                ? "Projected balance if this request is approved."
                : "The reported balance already reflects this decision."}
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-400">
                {showsProjection ? "Balance Before" : "Current Balance"}
              </p>

              <p className="mt-2 text-xl font-semibold text-slate-950">
                {available === null
                  ? EM_DASH
                  : `${formatNumber(available)} days`}
              </p>
            </div>

            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-xs text-amber-600">Requested</p>

              <p className="mt-2 text-xl font-semibold text-amber-900">
                -{requestedDays} days
              </p>
            </div>

            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-xs text-green-600">
                {showsProjection ? "Projected Balance" : "Balance Source"}
              </p>

              <p className="mt-2 text-xl font-semibold text-green-900">
                {projected !== null
                  ? `${formatNumber(projected)} days`
                  : available === null
                    ? EM_DASH
                    : "Backend"}
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
                  <Clock3 size={11} className="text-white" />
                </div>

                <p className="text-sm font-medium text-slate-900">
                  {request.submitted_at
                    ? "Leave request submitted"
                    : "Leave request created"}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {formatDateTime(request.submitted_at ?? request.created_at)}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Raised for {employeeName}.
                </p>
              </div>

              {approvals.map((approval) => (
                <div key={approval.id} className="relative pb-6">
                  <div className="absolute -left-8 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white">
                    <Clock3 size={11} className="text-slate-400" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      Approval step {approval.sequence}
                    </p>

                    <StatusBadge status={approval.status} />
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    {approval.acted_at
                      ? formatDateTime(approval.acted_at)
                      : "Awaiting action"}
                  </p>

                  {approval.comment && (
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {approval.comment}
                    </p>
                  )}
                </div>
              ))}

              {request.cancelled_at && (
                <div className="relative">
                  <div className="absolute -left-8 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white">
                    <XCircle size={11} className="text-slate-400" />
                  </div>

                  <p className="text-sm font-medium text-slate-900">
                    Request cancelled
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(request.cancelled_at)}
                  </p>
                </div>
              )}

              {approvals.length === 0 && !request.cancelled_at && (
                <div className="relative">
                  <div className="absolute -left-8 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white">
                    <Clock3 size={11} className="text-slate-400" />
                  </div>

                  <p className="text-sm font-medium text-slate-500">
                    {isPending ? "Awaiting approval" : "No approval steps"}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Current workflow state
                  </p>
                </div>
              )}
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
                <FileText size={17} className="text-slate-500" />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700">
                  {request.attachment
                    ? "Supporting document attached"
                    : "No attachments"}
                </p>

                <p className="mt-0.5 text-xs text-slate-400">
                  {request.attachment
                    ? "Linked through the shared documents module."
                    : "No supporting documents were submitted."}
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
                Provide a reason that will be recorded with the workflow
                decision.
              </p>
            </div>

            <div className="p-5">
              <textarea
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
                rows={4}
                placeholder="Enter reason for declining this request..."
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50"
              />

              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeclineForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDecline}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Confirm Decline
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction === "approve"
            ? "Approve leave request?"
            : pendingAction === "reject"
              ? "Decline leave request?"
              : pendingAction === "submit"
                ? "Submit leave request?"
                : "Cancel leave request?"
        }
        description={
          pendingAction === "approve"
            ? "Approving consumes the employee's leave balance for the requested days."
            : pendingAction === "reject"
              ? "The request will be rejected and the recorded reason kept with the decision."
              : pendingAction === "submit"
                ? "The request enters the approval workflow and can no longer be edited."
                : "Cancelling releases any balance held for this request. This cannot be undone."
        }
        confirmLabel={
          pendingAction === "approve"
            ? "Approve"
            : pendingAction === "reject"
              ? "Decline"
              : pendingAction === "submit"
                ? "Submit"
                : "Cancel request"
        }
        destructive={pendingAction === "reject" || pendingAction === "cancel"}
        loading={actionRunning}
        onConfirm={runAction}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}
