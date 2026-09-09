"use client";

import { useState } from "react";
import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";

import PageHeader from "@/components/ui/PageHeader";

const leaveTypes = [
  "Annual Leave",
  "Sick Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Study Leave",
  "Unpaid Leave",
];

export default function RequestLeavePage() {
  const [leaveType, setLeaveType] =
    useState("Annual Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] =
    useState(false);

  function calculateDays() {
    if (!startDate || !endDate) {
      return 0;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    const difference =
      end.getTime() - start.getTime();

    if (difference < 0) {
      return 0;
    }

    return (
      Math.floor(
        difference / (1000 * 60 * 60 * 24)
      ) + 1
    );
  }

  function submitRequest() {
    setError("");

    if (!leaveType || !startDate || !endDate) {
      setError(
        "Please complete all required fields."
      );
      return;
    }

    if (calculateDays() <= 0) {
      setError(
        "The end date must be on or after the start date."
      );
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <>
        <PageHeader
          title="Leave Request Submitted"
          description="Your leave request has been submitted for review."
        />

        <div className="mt-6 max-w-2xl rounded-xl border border-green-200 bg-green-50 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
            ✓
          </div>

          <h2 className="mt-4 text-lg font-semibold text-green-900">
            Request submitted successfully
          </h2>

          <p className="mt-2 text-sm text-green-800">
            Your request is now pending approval. You can
            monitor its status from your My Leave page.
          </p>

          <Link
            href="/me/leave"
            className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            View My Leave
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Request Leave"
        description="Submit a leave request for your own employment record."
        actions={
          <Link
            href="/me/leave"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to My Leave
          </Link>
        }
      />

      <div className="mt-6 max-w-3xl">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-base font-semibold text-slate-900">
              Leave Details
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select the type and period of leave you are requesting.
            </p>
          </div>

          <div className="space-y-6 p-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Leave Type
              </label>

              <select
                value={leaveType}
                onChange={(event) =>
                  setLeaveType(event.target.value)
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 sm:max-w-md"
              >
                {leaveTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Start Date
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    setStartDate(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  End Date
                </label>

                <input
                  type="date"
                  value={endDate}
                  onChange={(event) =>
                    setEndDate(event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>
            </div>

            {startDate && endDate && (
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-4">
                <CalendarDays
                  size={19}
                  className="text-slate-500"
                />

                <p className="text-sm text-slate-700">
                  Requested duration:{" "}
                  <span className="font-semibold text-slate-950">
                    {calculateDays()} day
                    {calculateDays() === 1
                      ? ""
                      : "s"}
                  </span>
                </p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Reason
              </label>

              <textarea
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                rows={5}
                placeholder="Provide a reason for your leave request..."
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={submitRequest}
              className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Submit Leave Request
            </button>
          </div>
        </section>

        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            Development mode: submission is currently local
            mock behaviour. The backend request endpoint will
            be connected when the API contract is available.
          </p>
        </div>
      </div>
    </>
  );
}