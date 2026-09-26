"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";

import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import {
  employeesApi,
  getApiErrorMessage,
  leaveApi,
  operationsApi,
} from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { Employee } from "@/types/hr";
import type { LeaveType } from "@/types/leave";
import type { DocumentRecord } from "@/types/operations";
import { buttonClasses } from "@/components/ui/Button";

export default function RequestLeavePage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(true);

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<DocumentRecord | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadReference() {
      setReferenceLoading(true);

      try {
        const [types, linkedEmployee] = await Promise.all([
          leaveApi
            .listLeaveTypes({ page_size: MAX_PAGE_SIZE, ordering: "name" })
            .then((page) => page.results.filter((type) => type.is_active))
            .catch(() => [] as LeaveType[]),
          employeesApi.getCurrentEmployee(),
        ]);

        if (!active) {
          return;
        }

        setLeaveTypes(types);
        setEmployee(linkedEmployee);
        setLeaveType(types[0]?.id ?? "");
      } finally {
        if (active) {
          setReferenceLoading(false);
        }
      }
    }

    loadReference();

    return () => {
      active = false;
    };
  }, []);

  /** Calendar-day span. The backend validates it against the leave policy. */
  const calculateDays = useCallback(() => {
    if (!startDate || !endDate) {
      return 0;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    const difference = end.getTime() - start.getTime();

    if (difference < 0) {
      return 0;
    }

    return Math.floor(difference / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const submitRequest = useCallback(async () => {
    setError("");

    if (!employee) {
      setError(
        "Your account is not linked to an employee record, so leave cannot be requested.",
      );
      return;
    }

    if (!leaveType || !startDate || !endDate) {
      setError("Please complete all required fields.");
      return;
    }

    const selectedLeaveType = leaveTypes.find((type) => type.id === leaveType);
    if (selectedLeaveType?.requires_attachment && !attachment) {
      setError("A supporting document is required for this leave type.");
      return;
    }

    const days = calculateDays();

    if (days <= 0) {
      setError("The end date must be on or after the start date.");
      return;
    }

    setSaving(true);

    try {
      // Creating a request leaves it in DRAFT; submitting moves it into the
      // approval workflow. Both steps are backend transitions.
      const created = await leaveApi.createLeaveRequest({
        employee: employee.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        requested_days: days,
        reason,
        attachment: attachment?.id ?? null,
      });

      await leaveApi.submitLeaveRequest(created.id);

      setSubmitted(true);
    } catch (caught) {
      // Policy eligibility, insufficient balance and the cross-year split
      // rule are all enforced by the backend and reported here.
      setError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }, [employee, leaveType, leaveTypes, startDate, endDate, reason, attachment, calculateDays]);

  const selectedLeaveType = leaveTypes.find((type) => type.id === leaveType);
  const selectAttachment = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (file.size > operationsApi.MAX_DOCUMENT_BYTES) {
      setError("Supporting documents must be 25 MB or smaller.");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await operationsApi.uploadDocument(file, { category: "LEAVE_SUPPORTING", classification: "CONFIDENTIAL" }, setUploadProgress);
      setAttachment(uploaded);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setUploading(false);
    }
  };

  if (submitted) {
    return (
      <>
        <PageHeader
          title="Leave Request Submitted"
          description="Your leave request has been submitted for review."
        />

        <div className="mt-6 max-w-2xl rounded-xl border border-success/25 bg-success-soft p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success-ink">
            ✓
          </div>

          <h2 className="mt-4 text-lg font-semibold text-success-ink">
            Request submitted successfully
          </h2>

          <p className="mt-2 text-sm text-success-ink">
            Your request is now pending approval. You can monitor its status
            from your My Leave page.
          </p>

          <Link
            href="/me/leave"
            className={buttonClasses({ variant: "primary", className: "mt-5" })}
          >
            View My Leave
          </Link>
        </div>
      </>
    );
  }

  const days = calculateDays();

  return (
    <>
      <PageHeader
        title="Request Leave"
        description="Submit a leave request for your own employment record."
        actions={
          <Link
            href="/me/leave"
            className={buttonClasses({ variant: "secondary" })}
          >
            <ArrowLeft size={16} />
            Back to My Leave
          </Link>
        }
      />

      <div className="mt-6 max-w-3xl space-y-4">
        {!referenceLoading && !employee && (
          <EmptyState
            title="No employee record linked"
            description="Your account is not linked to an employee record in this institution, so a leave request cannot be raised for you."
          />
        )}

        <section className="rounded-xl border border-line bg-surface shadow-sm">
          <div className="border-b border-line px-6 py-5">
            <h2 className="text-base font-semibold text-ink-strong">
              Leave Details
            </h2>

            <p className="mt-1 text-sm text-ink-muted">
              Select the type and period of leave you are requesting.
            </p>
          </div>

          <div className="space-y-6 p-6">
            {error && (
              <div className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="leave-type"
                className="mb-1.5 block text-sm font-medium text-ink"
              >
                Leave Type
              </label>

              <select
                id="leave-type"
                value={leaveType}
                onChange={(event) => setLeaveType(event.target.value)}
                disabled={referenceLoading || leaveTypes.length === 0}
                className="w-full h-9 rounded-lg border border-line-strong px-3 text-sm outline-none focus:border-primary disabled:bg-surface-muted sm:max-w-md"
              >
                {referenceLoading && <option value="">Loading...</option>}

                {!referenceLoading && leaveTypes.length === 0 && (
                  <option value="">No leave types configured</option>
                )}

                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="leave-supporting-document" className="mb-1.5 block text-sm font-medium text-ink">
                Supporting Document{selectedLeaveType?.requires_attachment ? " *" : " (optional)"}
              </label>
              <p className="mb-2 text-xs text-ink-muted">Any file type, up to 25 MB. The document is stored in your institution&apos;s protected document area.</p>
              {attachment ? <div className="flex items-center justify-between gap-3 rounded-lg border border-success/25 bg-success-soft px-3 py-2.5 text-sm"><span className="min-w-0 truncate text-success-ink">{attachment.original_filename}</span><button type="button" onClick={() => setAttachment(null)} className="shrink-0 font-medium text-success-ink underline">Remove</button></div> : <input id="leave-supporting-document" type="file" onChange={(event) => void selectAttachment(event.target.files?.[0])} disabled={uploading} className="block w-full rounded-lg border border-line px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-sm" />}
              {uploading && <div className="mt-2" aria-live="polite"><div className="h-2 overflow-hidden rounded-full bg-surface-sunken"><div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} /></div><p className="mt-1 text-xs text-ink-muted">Uploading… {uploadProgress}%</p></div>}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="start-date"
                  className="mb-1.5 block text-sm font-medium text-ink"
                >
                  Start Date
                </label>

                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full h-9 rounded-lg border border-line-strong px-3 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="end-date"
                  className="mb-1.5 block text-sm font-medium text-ink"
                >
                  End Date
                </label>

                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full h-9 rounded-lg border border-line-strong px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            {startDate && endDate && (
              <div className="flex items-center gap-3 rounded-lg bg-surface-muted p-4">
                <CalendarDays size={19} className="text-ink-muted" />

                <p className="text-sm text-ink">
                  Requested duration:{" "}
                  <span className="font-semibold text-ink-strong">
                    {days} day{days === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="leave-reason"
                className="mb-1.5 block text-sm font-medium text-ink"
              >
                Reason
              </label>

              <textarea
                id="leave-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={5}
                placeholder="Provide a reason for your leave request..."
                className="w-full resize-none rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-line px-6 py-4">
            <button
              type="button"
              onClick={submitRequest}
              disabled={saving || referenceLoading || !employee}
              className={buttonClasses({ variant: "primary" })}
            >
              {saving ? "Submitting..." : "Submit Leave Request"}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
