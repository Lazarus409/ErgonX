"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/components/guards/AuthProvider";
import { APPROVAL_PERMISSIONS } from "@/components/navigation/navigation";
import { getApiErrorMessage, workflowsApi } from "@/lib/api";
import type { InboxAction, InboxItem } from "@/types/workflows";

/**
 * Approve, reject or return the request a notification is about, without leaving the
 * notification centre. It uses the approvals inbox, so the same rules apply: only requests
 * waiting on you, with the module's own checks (e.g. no approving your own submission).
 */
export default function QuickDecision({ route }: { route: string }) {
  const { user } = useAuth();
  const canApprove = Boolean(user?.permissions.some((permission) => permission === "*" || APPROVAL_PERMISSIONS.includes(permission)));
  const [item, setItem] = useState<InboxItem | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canApprove) return;
    let active = true;
    workflowsApi.getApprovalInbox().then((inbox) => {
      const matches = inbox.items.filter((candidate) => candidate.route === route);
      if (active) setItem(matches.length === 1 ? matches[0] : null);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [canApprove, route]);

  if (!item || (!item.actions.length && !item.blocked_reason)) return null;
  if (done) return <p role="status" className="mt-4 rounded-lg bg-success-soft p-3 text-support text-success-ink">{done}</p>;

  const decide = async (action: InboxAction) => {
    if (action.comment_required && !comment.trim()) { setError(`Add a note to ${action.label.toLowerCase()}.`); return; }
    setBusy(action.code); setError(null);
    try { await workflowsApi.runInboxAction(action, comment.trim()); setDone(`${action.label} recorded for ${item.reference || item.title}.`); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(null); }
  };

  return (
    <section className="mt-4 space-y-2 rounded-lg border border-line p-3" aria-label="Decide this request">
      <p className="text-support font-semibold text-ink-strong">Waiting on you{item.amount ? ` · ${item.amount} ${item.currency}` : ""}</p>
      {item.blocked_reason ? <p className="text-caption text-warning-ink">{item.blocked_reason}</p> : (
        <>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} maxLength={1000} placeholder="Note (needed to reject or return)"
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink-strong" aria-label="Decision note" />
          <div className="flex flex-wrap gap-2">
            {item.actions.map((action) => (
              <Button key={action.code} size="sm" variant={action.code === "approve" ? "primary" : action.code === "reject" ? "danger" : "secondary"} loading={busy === action.code} disabled={busy !== null} onClick={() => void decide(action)}>{action.label}</Button>
            ))}
          </div>
        </>
      )}
      {error && <p role="alert" className="text-caption text-danger-ink">{error}</p>}
    </section>
  );
}
