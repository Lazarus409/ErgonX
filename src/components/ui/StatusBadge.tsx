import {
  Ban,
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleDot,
  Clock3,
  Lock,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Canonical workflow/status chip. Meaning is carried by colour, icon and
 * label together so it never depends on colour alone.
 */
const toneIcon: Record<BadgeTone, LucideIcon> = {
  success: CheckCircle2,
  warning: Clock3,
  danger: XCircle,
  info: CircleDot,
  neutral: Circle,
  brand: Lock,
  violet: CircleDot,
};

const statusConfig: Record<string, { label: string; tone: BadgeTone; icon?: LucideIcon }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  SUSPENDED: { label: "Suspended", tone: "warning", icon: TriangleAlert },
  TERMINATED: { label: "Terminated", tone: "danger", icon: Ban },
  PENDING: { label: "Pending", tone: "warning" },
  SUBMITTED: { label: "Submitted", tone: "warning" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "warning" },
  NOT_STARTED: { label: "Not started", tone: "neutral", icon: CircleDashed },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  COMPLETED: { label: "Completed", tone: "success" },
  SKIPPED: { label: "Not required", tone: "neutral", icon: CircleDashed },
  BLOCKED: { label: "Needs attention", tone: "danger", icon: TriangleAlert },
  READY: { label: "Ready", tone: "success" },
  DRAFT: { label: "Draft", tone: "neutral", icon: CircleDashed },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "danger", icon: Ban },
  FINALIZED: { label: "Finalized", tone: "brand" },
  POSTED: { label: "Posted", tone: "brand" },
  CLOSED: { label: "Closed", tone: "neutral", icon: Lock },
  OPEN: { label: "Open", tone: "info" },
  PAID: { label: "Paid", tone: "success" },
  PARTIALLY_PAID: { label: "Partially paid", tone: "info" },
  PART_PAID: { label: "Part paid", tone: "info" },
  ISSUED: { label: "Issued", tone: "info" },
  OVERDUE: { label: "Overdue", tone: "danger", icon: TriangleAlert },
  SCHEDULED: { label: "Scheduled", tone: "info", icon: Clock3 },
  VOID: { label: "Void", tone: "danger", icon: Ban },
  VOIDED: { label: "Voided", tone: "danger", icon: Ban },
  REVERSED: { label: "Reversed", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
  HIRED: { label: "Hired", tone: "success" },
  PUBLISHED: { label: "Published", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  PRESENT: { label: "Present", tone: "success" },
  LATE: { label: "Late", tone: "warning", icon: TriangleAlert },
  ABSENT: { label: "Absent", tone: "danger" },
  ON_LEAVE: { label: "On leave", tone: "info" },
  HOLIDAY: { label: "Holiday", tone: "violet" },
  OFF_DAY: { label: "Off day", tone: "neutral" },
  REMOTE: { label: "Remote", tone: "info" },
};

function humanize(value: string): string {
  const words = value.replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default function StatusBadge({ status, size = "md", className }: StatusBadgeProps) {
  const normalizedStatus = (status ?? "").toUpperCase();
  const config = statusConfig[normalizedStatus] ?? { label: humanize(status ?? ""), tone: "neutral" as BadgeTone };
  return (
    <Badge tone={config.tone} icon={config.icon ?? toneIcon[config.tone]} size={size} className={className}>
      {config.label}
    </Badge>
  );
}
