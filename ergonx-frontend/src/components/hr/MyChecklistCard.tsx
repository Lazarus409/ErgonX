"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { CheckCircle2, Circle, ListChecks, MinusCircle } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { employeesApi, getApiErrorMessage } from "@/lib/api";
import type { MyLifecycle, MyLifecycleRecord } from "@/lib/api/employees";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { EmployeeOffboarding, EmployeeOnboarding } from "@/types/hr";

/**
 * The signed-in employee's own onboarding or offboarding checklist. They tick
 * off the items they are responsible for; HR, IT, Finance and the line manager
 * handle the rest. Hidden when nothing is in progress.
 */
export default function MyChecklistCard() {
  const load = useCallback(() => employeesApi.getMyLifecycle(), []);
  const { data, error, setData } = useApiResource<MyLifecycle>(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const record: MyLifecycleRecord<EmployeeOnboarding> | MyLifecycleRecord<EmployeeOffboarding> | null = data?.onboarding ?? data?.offboarding ?? null;
  if (error || !record || record.tasks.length === 0) return null;
  const isOnboarding = Boolean(data?.onboarding);
  const mine = record.tasks.filter((task) => task.can_complete && task.status === "OPEN").length;

  const toggle = async (taskId: string, done: boolean) => {
    setBusy(taskId);
    setActionError("");
    try {
      const next = await employeesApi.updateMyLifecycleTask(taskId, done ? "OPEN" : "DONE");
      setData(() => next);
    }
    catch (caught) { setActionError(getApiErrorMessage(caught)); }
    finally { setBusy(null); }
  };

  return (
    <Card
      title={isOnboarding ? "Your onboarding checklist" : "Your offboarding checklist"}
      description={isOnboarding ? "What happens in your first weeks. Tick off the items marked for you." : "What needs to happen before you leave. Tick off the items marked for you."}
      icon={ListChecks}
      accent="hr"
      actions={<Badge tone={mine ? "warning" : "success"}>{mine ? `${mine} for you` : `${record.checklist.closed} of ${record.checklist.total} done`}</Badge>}
    >
      {actionError && <Alert tone="danger" onDismiss={() => setActionError("")}>{actionError}</Alert>}
      <ul className="divide-y divide-line-soft">
        {record.tasks.map((task) => {
          const done = task.status === "DONE";
          const skipped = task.status === "NOT_APPLICABLE";
          const Icon = done ? CheckCircle2 : skipped ? MinusCircle : Circle;
          const policyItem = task.category === "POLICY" && !task.can_complete && task.status === "OPEN";
          return (
            <li key={task.id} className="flex items-start gap-3 py-2.5">
              {task.can_complete ? (
                <button type="button" disabled={busy !== null} onClick={() => void toggle(task.id, done)} aria-label={done ? `Reopen ${task.title}` : `Mark ${task.title} done`} className={cx("mt-0.5 shrink-0 rounded-full", done ? "text-success" : "text-primary-ink hover:text-primary")}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : (
                <Icon className={cx("mt-0.5 h-5 w-5 shrink-0", done ? "text-success" : "text-ink-muted")} aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className={cx("flex flex-wrap items-center gap-1.5 text-sm font-medium", done || skipped ? "text-ink-muted line-through decoration-ink-muted/50" : "text-ink-strong")}>
                  {task.title}
                  {task.can_complete && task.status === "OPEN" && <Badge size="sm" tone="warning">For you</Badge>}
                  {task.is_overdue && <Badge size="sm" tone="danger">Overdue</Badge>}
                </p>
                <p className="mt-0.5 text-caption text-ink-muted">
                  {task.owner_label}{task.due_date && ` · due ${formatDate(task.due_date)}`}
                  {policyItem && <> · <Link href="/me/policies" className="font-semibold text-primary-ink hover:underline">Acknowledge your policies</Link> to complete this</>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
