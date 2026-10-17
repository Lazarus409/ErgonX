"use client";

import { useCallback, useState } from "react";
import { MessagesSquare } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import { getApiErrorMessage, performanceApi } from "@/lib/api";
import { RATING_LABELS, type FeedbackRequestItem } from "@/lib/api/performance";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

/** 360 feedback you've been asked to give: rate a colleague's competencies and add comments. */
export default function GiveFeedbackPage() {
  const { showToast } = useToast();
  const load = useCallback(() => performanceApi.listMyFeedbackRequests(), []);
  const { data, error, reload } = useApiResource(load);
  const items = data?.results ?? [];
  const open = items.filter((item) => item.open);
  const done = items.filter((item) => !item.open);

  const [answering, setAnswering] = useState<FeedbackRequestItem | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const start = (item: FeedbackRequestItem) => { setAnswering(item); setRatings({}); setStrengths(""); setImprovements(""); setFormError(""); };
  const submit = async () => {
    if (!answering) return;
    setSaving(true); setFormError("");
    try {
      await performanceApi.submitFeedback(answering.id, { ratings, strengths: strengths.trim(), improvements: improvements.trim() });
      setAnswering(null);
      showToast({ tone: "success", message: `Feedback on ${answering.employee_name} sent.` });
      reload();
    } catch (caught) { setFormError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };
  const decline = async (item: FeedbackRequestItem) => {
    try { await performanceApi.declineFeedback(item.id); reload(); }
    catch (caught) { showToast({ tone: "error", message: getApiErrorMessage(caught) }); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Performance"
        title="Give feedback"
        description="Colleagues have asked for your view as part of their performance review. Your answers are combined with others' and shown without your name."
        icon={MessagesSquare}
        accent="hr"
      />
      {error && <ErrorState variant="inline" title="Unable to load feedback requests" message={error} onRetry={reload} />}
      {data && items.length === 0 && <EmptyState icon={MessagesSquare} title="No feedback requests" description="When a colleague asks for your feedback, it appears here and in My Work." />}
      {open.length > 0 && (
        <Card title="Waiting for you" icon={MessagesSquare} accent="hr">
          <ul className="divide-y divide-line-soft">
            {open.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span><span className="block font-semibold text-ink-strong">{item.employee_name}</span><span className="text-caption text-ink-muted">{item.cycle_name} · you are their {item.relationship_label.toLowerCase()} · asked {formatDate(item.created_at)}</span></span>
                <span className="flex gap-2"><Button size="sm" onClick={() => start(item)}>Give feedback</Button><Button size="sm" variant="ghost" onClick={() => void decline(item)}>Decline</Button></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {done.length > 0 && (
        <Card title="Earlier requests" icon={MessagesSquare} accent="hr">
          <ul className="divide-y divide-line-soft">
            {done.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 py-3">
                <span><span className="block font-medium text-ink-strong">{item.employee_name}</span><span className="text-caption text-ink-muted">{item.cycle_name}{item.submitted_at ? ` · sent ${formatDate(item.submitted_at)}` : ""}</span></span>
                <Badge size="sm" tone={item.status === "SUBMITTED" ? "success" : "neutral"}>{item.status === "PENDING" ? "Closed" : item.status_label}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog
        open={answering !== null}
        onClose={() => setAnswering(null)}
        dismissible={!saving}
        size="lg"
        title={answering ? `Feedback on ${answering.employee_name}` : "Feedback"}
        description="Be specific and constructive. Rate only what you have seen; skip a competency if you can't judge it."
        footer={<><Button variant="secondary" onClick={() => setAnswering(null)} disabled={saving}>Cancel</Button><Button loading={saving} onClick={() => void submit()}>Send feedback</Button></>}
      >
        {answering && (
          <div className="space-y-4">
            {formError && <Alert tone="danger">{formError}</Alert>}
            {answering.competencies.map((competency) => (
              <fieldset key={competency.id}>
                <legend className="text-sm font-semibold text-ink-strong">{competency.name}</legend>
                {competency.description && <p className="text-caption text-ink-muted">{competency.description}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button key={value} type="button" title={RATING_LABELS[value]} aria-pressed={ratings[competency.id] === value} onClick={() => setRatings((current) => { const next = { ...current }; if (next[competency.id] === value) delete next[competency.id]; else next[competency.id] = value; return next; })}
                      className={cx("h-9 min-w-9 rounded-md border px-2 text-sm font-semibold", ratings[competency.id] === value ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink hover:border-primary/50")}>{value}</button>
                  ))}
                  {ratings[competency.id] && <span className="self-center text-caption text-ink-muted">{RATING_LABELS[ratings[competency.id]]}</span>}
                </div>
              </fieldset>
            ))}
            <Field label="What they do well" optional><Textarea rows={3} maxLength={3000} value={strengths} onChange={(event) => setStrengths(event.target.value)} /></Field>
            <Field label="What they could do better" optional><Textarea rows={3} maxLength={3000} value={improvements} onChange={(event) => setImprovements(event.target.value)} /></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
