"use client";

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<
  string,
  {
    label: string;
    className: string;
  }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  INACTIVE: {
    label: "Inactive",
    className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  },
  TERMINATED: {
    label: "Terminated",
    className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  },
  PENDING: {
    label: "Pending",
    className: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  },
  NOT_STARTED: {
    label: "Not started",
    className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  },
  IN_PROGRESS: {
    label: "In progress",
    className: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  SKIPPED: {
    label: "Not required",
    className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  },
  BLOCKED: {
    label: "Needs attention",
    className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  },
  READY: {
    label: "Ready",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  },
  FINALIZED: {
    label: "Finalized",
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
  },
  PRESENT: {
    label: "Present",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  },
  LATE: {
    label: "Late",
    className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  },
  ABSENT: {
    label: "Absent",
    className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  },
  ON_LEAVE: {
    label: "On Leave",
    className: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  },
  HOLIDAY: {
    label: "Holiday",
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
  },
  OFF_DAY: {
    label: "Off Day",
    className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  },
  REMOTE: {
    label: "Remote",
    className: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-600/20",
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status.toUpperCase();
  const config = statusConfig[normalizedStatus] ?? {
    label: status,
    className:
      "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
