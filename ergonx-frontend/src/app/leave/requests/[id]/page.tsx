"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
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
import BackNavigation from "@/components/ui/BackNavigation";
import {
  employeesApi,
  getApiErrorMessage,
  isApiRequestError,
  leaveApi,
  operationsApi,
} from "@/lib/api";
import type { Employee } from "@/types/hr";
import type {
  LeaveApproval,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
} from "@/types/leave";
import type { DocumentRecord } from "@/types/operations";
import { EM_DASH, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { buttonClasses } from "@/components/ui/Button";
import { PrintButton, PrintFooter, PrintMasthead } from "@/components/brand/PrintDocument";

type PendingAction = "submit" | "approve" | "reject" | "cancel" | null;

interface RequestDetail {
  request: LeaveRequest;
  employee: Employee | null;
  leaveType: LeaveType | null;
  balance: LeaveBalance | null;
  approvals: LeaveApproval[];
  attachment: DocumentRecord | null;
}

/**
 * Loads the request plus the related records the screen displays. The related
 * reads are tolerated individually: a missing balance or an approval trail the
 * role cannot see must not blank out the request itself.
 */
async function loadDetail(id: string): Promise<RequestDetail> {
  const request = await leaveApi.getLeaveRequest(id);

  const [employee, leaveType, balance, approvals, attachment] = await Promise.all([
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
    request.attachment ? operationsApi.getDocument(request.attachment).catch(() => null) : Promise.resolve(null),
  ]);

  return { request, employee, leaveType, balance, approvals, attachment };
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
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-primary" />
          <p className="mt-4 text-sm text-ink-muted">
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
          actions={<BackNavigation fallback="/leave/requests" label="Back to Requests" />}
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

  const { request, employee, leaveType, balance, approvals, attachment } = detail;

  const downloadAttachment = async () => {
    if (!attachment) return;
    const blob = await operationsApi.downloadDocument(attachment.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.original_filename;
    link.click();
    URL.revokeObjectURL(url);
  };

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
      <PrintMasthead documentTitle="Leave request form" />
      <PageHeader
        title="Leave Request"
        description="Review the employee leave request and take the appropriate authorised action."
        actions={<div className="flex flex-wrap items-center gap-2 print:hidden"><PrintButton /><BackNavigation fallback="/leave/requests" label="Back to Requests" /></div>}
      />

      <div className="mt-6 space-y-6">
        {actionError && (
          <div className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
            {actionError}
          </div>
        )}

        {/* Request header */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-sunken">
                <CalendarDays size={23} className="text-ink-muted" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-ink-strong">
                    {leaveType?.name ?? EM_DASH}
                  </h2>

                  <StatusBadge status={status} />
                </div>

                <p className="mt-1 text-sm text-ink-muted">
                  {request.submitted_at
                    ? `Submitted on ${formatDate(request.submitted_at)}`
                    : "Not yet submitted"}
                </p>
              </div>
            </div>

            <div className="text-left lg:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                Requested Duration
              </p>

              <p className="mt-1 text-xl font-semibold text-ink-strong">
                {requestedDays} days
              </p>
            </div>
          </div>
        </section>

        {/* Workflow action bar */}
        {(canApprove || canCancel) && (
          <section className="rounded-xl border border-warning/30 bg-warning-soft p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-warning-ink">
                  {isDraft ? "Submission Required" : "Approval Required"}
                </p>

                <p className="mt-1 text-sm text-warning-ink">
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
                    className={buttonClasses({ variant: "secondary" })}
                  >
                    <XCircle size={17} />
                    Cancel Request
                  </button>
                )}

                {isDraft && (
                  <button
                    type="button"
                    onClick={() => setPendingAction("submit")}
                    className={buttonClasses({ variant: "primary" })}
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
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-danger/25 bg-surface px-4 py-2.5 text-sm font-medium text-danger-ink hover:bg-danger-soft"
                    >
                      <XCircle size={17} />
                      Decline
                    </button>

                    <button
                      type="button"
                      onClick={() => setPendingAction("approve")}
                      className={buttonClasses({ variant: "primary" })}
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
          <section className="rounded-xl border border-line bg-surface shadow-sm lg:col-span-2">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-ink-strong">
                Request Summary
              </h2>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Employee
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <User size={16} className="text-ink-subtle" />

                  <div>
                    <p className="text-sm font-medium text-ink-strong">
                      {employeeName}
                    </p>

                    <p className="text-xs text-ink-subtle">
                      {employee?.employee_number ?? EM_DASH}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Leave Type
                </p>

                <p className="mt-2 text-sm text-ink">
                  {leaveType?.name ?? EM_DASH}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Start Date
                </p>

                <p className="mt-2 text-sm text-ink">
                  {formatDate(request.start_date)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  End Date
                </p>

                <p className="mt-2 text-sm text-ink">
                  {formatDate(request.end_date)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Duration
                </p>

                <p className="mt-2 text-sm font-medium text-ink-strong">
                  {requestedDays} days
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Submitted
                </p>

                <p className="mt-2 text-sm text-ink">
                  {request.submitted_at
                    ? formatDateTime(request.submitted_at)
                    : EM_DASH}
                </p>
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  Reason
                </p>

                <p className="mt-2 text-sm leading-6 text-ink">
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
          <section className="rounded-xl border border-line bg-surface shadow-sm">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-ink-strong">
                Policy Eligibility
              </h2>
            </div>

            <div className="p-5">
              {leaveType ? (
                <>
                  <dl className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-ink-muted">Paid leave</dt>
                      <dd className="font-medium text-ink-strong">
                        {leaveType.is_paid ? "Yes" : "No"}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between">
                      <dt className="text-ink-muted">Requires approval</dt>
                      <dd className="font-medium text-ink-strong">
                        {leaveType.requires_approval ? "Yes" : "No"}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between">
                      <dt className="text-ink-muted">Requires attachment</dt>
                      <dd className="font-medium text-ink-strong">
                        {leaveType.requires_attachment ? "Yes" : "No"}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 text-xs leading-5 text-ink-muted">
                    Policy eligibility is validated by the backend when the
                    request is submitted and approved.
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-muted">
                  Leave type configuration is unavailable.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Balance impact */}
        <section className="rounded-xl border border-line bg-surface shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-strong">
              Leave Balance Impact
            </h2>

            <p className="mt-1 text-xs text-ink-muted">
              {showsProjection
                ? "Projected balance if this request is approved."
                : "The reported balance already reflects this decision."}
            </p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-muted p-4">
              <p className="text-xs text-ink-subtle">
                {showsProjection ? "Balance Before" : "Current Balance"}
              </p>

              <p className="mt-2 text-xl font-semibold text-ink-strong">
                {available === null
                  ? EM_DASH
                  : `${formatNumber(available)} days`}
              </p>
            </div>

            <div className="rounded-lg bg-warning-soft p-4">
              <p className="text-xs text-warning-ink">Requested</p>

              <p className="mt-2 text-xl font-semibold text-warning-ink">
                -{requestedDays} days
              </p>
            </div>

            <div className="rounded-lg bg-success-soft p-4">
              <p className="text-xs text-success-ink">
                {showsProjection ? "Projected Balance" : "Balance Source"}
              </p>

              <p className="mt-2 text-xl font-semibold text-success-ink">
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
        <section className="rounded-xl border border-line bg-surface shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-strong">
              Approval History
            </h2>

            <p className="mt-1 text-xs text-ink-muted">
              Timeline of actions taken on this request.
            </p>
          </div>

          <div className="p-5">
            <div className="relative pl-8">
              <div className="absolute bottom-0 left-2 top-0 w-px bg-line" />

              <div className="relative pb-6">
                <div className="absolute -left-8 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                  <Clock3 size={11} className="text-white" />
                </div>

                <p className="text-sm font-medium text-ink-strong">
                  {request.submitted_at
                    ? "Leave request submitted"
                    : "Leave request created"}
                </p>

                <p className="mt-1 text-xs text-ink-muted">
                  {formatDateTime(request.submitted_at ?? request.created_at)}
                </p>

                <p className="mt-2 text-xs text-ink-muted">
                  Raised for {employeeName}.
                </p>
              </div>

              {approvals.map((approval) => (
                <div key={approval.id} className="relative pb-6">
                  <div className="absolute -left-8 flex h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-surface">
                    <Clock3 size={11} className="text-ink-subtle" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink-strong">
                      Approval step {approval.sequence}
                    </p>

                    <StatusBadge status={approval.status} />
                  </div>

                  <p className="mt-1 text-xs text-ink-muted">
                    {approval.acted_at
                      ? formatDateTime(approval.acted_at)
                      : "Awaiting action"}
                  </p>

                  {approval.comment && (
                    <p className="mt-2 text-xs leading-5 text-ink-muted">
                      {approval.comment}
                    </p>
                  )}
                </div>
              ))}

              {request.cancelled_at && (
                <div className="relative">
                  <div className="absolute -left-8 flex h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-surface">
                    <XCircle size={11} className="text-ink-subtle" />
                  </div>

                  <p className="text-sm font-medium text-ink-strong">
                    Request cancelled
                  </p>

                  <p className="mt-1 text-xs text-ink-muted">
                    {formatDateTime(request.cancelled_at)}
                  </p>
                </div>
              )}

              {approvals.length === 0 && !request.cancelled_at && (
                <div className="relative">
                  <div className="absolute -left-8 flex h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-surface">
                    <Clock3 size={11} className="text-ink-subtle" />
                  </div>

                  <p className="text-sm font-medium text-ink-muted">
                    {isPending ? "Awaiting approval" : "No approval steps"}
                  </p>

                  <p className="mt-1 text-xs text-ink-subtle">
                    Current workflow state
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Attachments */}
        <section className="rounded-xl border border-line bg-surface shadow-sm">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-strong">
              Attachments
            </h2>

            <p className="mt-1 text-xs text-ink-muted">
              Supporting documents submitted with the request.
            </p>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line p-4">
              <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken">
                <FileText size={17} className="text-ink-muted" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {request.attachment
                    ? attachment?.original_filename ?? "Supporting document attached"
                    : "No attachments"}
                </p>

                <p className="mt-0.5 text-xs text-ink-subtle">
                  {request.attachment
                    ? "Linked through the shared documents module."
                    : "No supporting documents were submitted."}
                </p>
              </div>
              </div>
              {attachment && <button type="button" onClick={() => void downloadAttachment()} className={buttonClasses({ variant: "secondary", size: "sm", className: "shrink-0" })}>Download</button>}
            </div>
          </div>
        </section>

        {/* Decline form */}
        {showDeclineForm && (
          <section className="rounded-xl border border-danger/25 bg-surface shadow-sm">
            <div className="border-b border-danger/25 px-5 py-4">
              <h2 className="text-sm font-semibold text-danger-ink">
                Decline Leave Request
              </h2>

              <p className="mt-1 text-xs text-danger-ink">
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
                className="w-full resize-none rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-danger focus:ring-2 focus:ring-danger/15"
              />

              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeclineForm(false)}
                  className={buttonClasses({ variant: "secondary" })}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDecline}
                  className={buttonClasses({ variant: "danger" })}
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
      <PrintFooter />
    </>
  );
}
