"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  LogIn,
  LogOut,
  PencilLine,
  Timer,
  X,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { Button, buttonClasses } from "@/components/ui/Button";
import {
  attendanceApi,
  employeesApi,
  getApiErrorMessage,
} from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { AttendanceRecord } from "@/types/attendance";
import type { Employee } from "@/types/hr";
import { EM_DASH, formatDate, toISODate } from "@/lib/format";

const HISTORY_LIMIT = 30;

interface MyAttendance {
  employee: Employee | null;
  today: AttendanceRecord | null;
  history: AttendanceRecord[];
}

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

export default function MyAttendancePage() {
  const [actionRunning, setActionRunning] = useState(false);
  const [actionError, setActionError] = useState("");

  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentSubmitted, setAdjustmentSubmitted] = useState(false);

  const todayIso = useMemo(() => toISODate(new Date()), []);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const load = useCallback(async (): Promise<MyAttendance> => {
    const employee = await employeesApi.getCurrentEmployee();

    if (!employee) {
      return { employee: null, today: null, history: [] };
    }

    const history = await attendanceApi
      .listAttendanceRecords({
        employee: employee.id,
        page_size: HISTORY_LIMIT,
        ordering: "-attendance_date",
      })
      .then((page) => page.results)
      .catch(() => [] as AttendanceRecord[]);

    const today =
      history.find((record) => record.attendance_date === todayIso) ?? null;

    return { employee, today, history };
  }, [todayIso]);

  const { data, loading, error, reload } = useApiResource(load);

  const employee = data?.employee ?? null;
  const today = data?.today ?? null;

  const clockedIn = today?.check_in !== null && today?.check_out === null;
  const clockedOut = Boolean(today?.check_out);

  /**
   * Clock-in and clock-out are backend actions. The backend resolves the
   * effective schedule, classifies lateness and refuses a clock-in during
   * approved leave.
   */
  const handleClockAction = useCallback(async () => {
    if (!employee) {
      return;
    }

    setActionRunning(true);
    setActionError("");

    try {
      if (today && clockedIn) {
        await attendanceApi.clockOut(today.id);
      } else {
        await attendanceApi.clockIn({
          employee: employee.id,
          source: "WEB",
        });
      }

      reload();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
    } finally {
      setActionRunning(false);
    }
  }, [employee, today, clockedIn, reload]);

  const submitAdjustment = useCallback(async () => {
    if (!today) {
      return;
    }

    if (!adjustmentReason.trim()) {
      setActionError("A reason is required for an adjustment request.");
      return;
    }

    setActionRunning(true);
    setActionError("");

    try {
      // A self-service request records the reason against the unchanged
      // times; a reviewer proposes the corrected values.
      await attendanceApi.createAttendanceAdjustment({
        attendance_record: today.id,
        reason: adjustmentReason.trim(),
        proposed_values: { notes: adjustmentReason.trim() },
      });

      setShowAdjustment(false);
      setAdjustmentReason("");
      setAdjustmentSubmitted(true);
      reload();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
    } finally {
      setActionRunning(false);
    }
  }, [today, adjustmentReason, reload]);

  const history = data?.history ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Employee Self-Service"
        title="My Attendance"
        description={todayLabel}
        actions={
          employee && (
            <Button
              size="lg"
              variant={clockedIn ? "danger" : "primary"}
              onClick={handleClockAction}
              disabled={actionRunning || clockedOut}
              leadingIcon={clockedIn ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            >
              {actionRunning
                ? "Working..."
                : clockedOut
                  ? "Clocked out for today"
                  : clockedIn
                    ? "Clock Out"
                    : "Clock In"}
            </Button>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      {actionError && (
        <div className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          {actionError}
        </div>
      )}

      {adjustmentSubmitted && (
        <div className="rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success-ink">
          Your adjustment request has been submitted for approval.
        </div>
      )}

      {!loading && !error && data && !employee && (
        <EmptyState
          title="No employee record linked"
          description="Your account is not linked to an employee record in this institution, so attendance cannot be recorded for you."
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<LogIn className="h-5 w-5" />}
          label="Check In"
          value={loading ? "…" : clockTime(today?.check_in ?? null)}
        />

        <StatCard
          icon={<LogOut className="h-5 w-5" />}
          label="Check Out"
          value={loading ? "…" : clockTime(today?.check_out ?? null)}
        />

        <StatCard
          icon={<Timer className="h-5 w-5" />}
          label="Worked Today"
          value={
            loading
              ? "…"
              : attendanceApi.formatMinutes(today?.worked_minutes ?? 0)
          }
        />

        <StatCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Overtime Today"
          value={
            loading
              ? "…"
              : attendanceApi.formatMinutes(today?.overtime_minutes ?? 0)
          }
        />
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink-strong">Today</h2>

            <p className="mt-1 text-sm text-ink-muted">
              {today
                ? `Status recorded as ${today.status.toLowerCase().replace("_", " ")}.`
                : "No attendance has been recorded for today."}
            </p>
          </div>

          {today && (
            <div className="flex items-center gap-3">
              <StatusBadge status={today.status} />

              <button
                type="button"
                onClick={() => {
                  setActionError("");
                  setAdjustmentSubmitted(false);
                  setShowAdjustment(true);
                }}
                className={buttonClasses({ variant: "secondary" })}
              >
                <PencilLine className="h-4 w-4" />
                Request correction
              </button>
            </div>
          )}
        </div>

        {today && (
          <dl className="grid gap-4 p-5 sm:grid-cols-3">
            <Detail
              label="Late"
              value={attendanceApi.formatMinutes(today.late_minutes)}
            />
            <Detail
              label="Early departure"
              value={attendanceApi.formatMinutes(
                today.early_departure_minutes,
              )}
            />
            <Detail label="Source" value={today.source} />
          </dl>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line p-5">
          <h2 className="font-semibold text-ink-strong">Attendance History</h2>

          <p className="mt-1 text-sm text-ink-muted">
            Your most recent attendance records.
          </p>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-ink-muted">Loading attendance...</p>
        ) : history.length === 0 ? (
          <p className="p-5 text-sm text-ink-muted">
            No attendance records found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Date
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Check In
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Check Out
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Worked
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line-soft">
                {history.map((record) => (
                  <tr key={record.id}>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-ink-strong">
                        {formatDate(record.attendance_date)}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm text-ink">
                      {clockTime(record.check_in)}
                    </td>

                    <td className="px-5 py-4 text-sm text-ink">
                      {clockTime(record.check_out)}
                    </td>

                    <td className="px-5 py-4 text-sm text-ink">
                      {attendanceApi.formatMinutes(record.worked_minutes)}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={record.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="text-lg font-semibold text-ink-strong">
                Request Attendance Correction
              </h2>

              <button
                onClick={() => setShowAdjustment(false)}
                disabled={actionRunning}
                className="rounded-lg p-2 text-ink-subtle hover:bg-surface-hover hover:text-ink-strong"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {actionError && (
                <div className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
                  {actionError}
                </div>
              )}

              <div className="rounded-lg bg-surface-muted p-4 text-sm">
                <p className="flex items-center gap-2 font-medium text-ink-strong">
                  <CalendarDays className="h-4 w-4 text-ink-subtle" />
                  {today ? formatDate(today.attendance_date) : EM_DASH}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {clockTime(today?.check_in ?? null)} –{" "}
                  {clockTime(today?.check_out ?? null)}
                </p>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">
                  Reason
                </span>
                <textarea
                  value={adjustmentReason}
                  onChange={(event) => setAdjustmentReason(event.target.value)}
                  rows={4}
                  placeholder="Explain what needs correcting on this record..."
                  className="w-full resize-none rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </label>

              <p className="text-xs leading-5 text-ink-muted">
                An approver reviews the request and applies the corrected
                times. Attendance records cannot be edited directly.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
              <button
                onClick={() => setShowAdjustment(false)}
                disabled={actionRunning}
                className={buttonClasses({ variant: "secondary" })}
              >
                Cancel
              </button>

              <button
                onClick={submitAdjustment}
                disabled={actionRunning || !adjustmentReason.trim()}
                className={buttonClasses({ variant: "primary" })}
              >
                {actionRunning ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{label}</p>

        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken text-ink">
          {icon}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-ink-strong">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-ink-strong">{value}</dd>
    </div>
  );
}
