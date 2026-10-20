"use client";

import { useCallback, useMemo, useState } from "react";
import { MessagesSquare, UserPlus } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import { employeesApi, getApiErrorMessage, performanceApi } from "@/lib/api";
import { FEEDBACK_RELATIONSHIP_LABELS, type FeedbackRelationship } from "@/lib/api/performance";
import { useApiResource } from "@/lib/useApiResource";

/**
 * 360 feedback on one review. The employee and reviewer see averages and
 * unattributed comments once enough colleagues have answered; HR sees names.
 */
export default function ReviewFeedbackCard({ reviewId, employeeId, canRequest }: { reviewId: string; employeeId: string; canRequest: boolean }) {
  const load = useCallback(() => performanceApi.getReviewFeedback(reviewId), [reviewId]);
  const { data, error, setData } = useApiResource(load);
  const [asking, setAsking] = useState(false);
  const [people, setPeople] = useState<{ id: string; name: string }[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [relationship, setRelationship] = useState<FeedbackRelationship>("PEER");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const openAsk = async () => {
    setAsking(true); setChosen([]); setFormError(""); setSearch("");
    if (people) return;
    try {
      const page = await employeesApi.listEmployees({ page_size: 100, status: "ACTIVE", ordering: "first_name" });
      setPeople(page.results.filter((person) => person.user && person.id !== employeeId).map((person) => ({ id: String(person.user), name: person.full_name })));
    } catch {
      setPeople([]);
      setFormError("You can't browse the staff list. Ask HR to request feedback for this review.");
    }
  };

  const filtered = useMemo(() => (people ?? []).filter((person) => person.name.toLowerCase().includes(search.trim().toLowerCase())), [people, search]);

  const send = async () => {
    if (!chosen.length) { setFormError("Choose at least one colleague."); return; }
    setSaving(true); setFormError("");
    try {
      const next = await performanceApi.requestReviewFeedback(reviewId, chosen, relationship);
      setData(() => next);
      setAsking(false);
    } catch (caught) { setFormError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };

  if (error) return null;
  const summary = data;
  if (!summary || (summary.requested === 0 && !canRequest)) return null;

  return (
    <Card
      title="360 feedback"
     
      icon={MessagesSquare}
      accent="hr"
      actions={<span className="flex items-center gap-2"><Badge tone={summary.visible ? "success" : "neutral"}>{summary.submitted} of {summary.requested} answered</Badge>{canRequest && <Button size="sm" variant="secondary" leadingIcon={<UserPlus className="h-4 w-4" />} onClick={() => void openAsk()}>Ask colleagues</Button>}</span>}
    >
      {summary.requested === 0 ? (
        <p className="text-support text-ink-muted">No feedback requested yet. Ask three or more colleagues who work closely with this person.</p>
      ) : !summary.visible ? (
        <p className="text-support text-ink-muted">Results appear once at least {summary.min_responses} colleagues have answered, so no single answer can be identified.</p>
      ) : (
        <div className="space-y-4">
          {summary.competencies.length > 0 && (
            <ul className="space-y-2">
              {summary.competencies.map((row) => (
                <li key={row.competency} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 font-medium text-ink-strong">{row.competency}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true"><span className="block h-full rounded-full bg-primary" style={{ width: `${(row.average / 5) * 100}%` }} /></span>
                  <span className="w-24 text-right tabular-nums text-ink">{row.average.toFixed(1)} / 5 <span className="text-caption text-ink-muted">({row.responses})</span></span>
                </li>
              ))}
            </ul>
          )}
          {summary.comments.length > 0 && (
            <ul className="space-y-3">
              {summary.comments.map((comment, index) => (
                <li key={index} className="rounded-lg bg-surface-muted p-3 text-sm">
                  {comment.name && <p className="mb-1 text-caption font-semibold text-ink-muted">{comment.name} · {comment.relationship}</p>}
                  {comment.strengths && <p><span className="font-semibold text-ink-strong">Strengths: </span>{comment.strengths}</p>}
                  {comment.improvements && <p className="mt-1"><span className="font-semibold text-ink-strong">Could improve: </span>{comment.improvements}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {summary.respondents.length > 0 && (
        <p className="mt-4 text-caption text-ink-muted">Asked (visible to HR only): {summary.respondents.map((person) => `${person.name} (${person.status.toLowerCase()})`).join(", ")}</p>
      )}

      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        dismissible={!saving}
        title="Ask colleagues for feedback"
        description="Each colleague rates the review's competencies and writes strengths and suggestions. Up to 10 people per review."
        footer={<><Button variant="secondary" onClick={() => setAsking(false)} disabled={saving}>Cancel</Button><Button loading={saving} onClick={() => void send()} disabled={!chosen.length}>Send {chosen.length ? `(${chosen.length})` : ""}</Button></>}
      >
        <div className="space-y-4">
          {formError && <Alert tone="warning">{formError}</Alert>}
          <Field label="They are this person's">
            <Select value={relationship} onChange={(event) => setRelationship(event.target.value as FeedbackRelationship)}>
              {Object.entries(FEEDBACK_RELATIONSHIP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Colleagues"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" /></Field>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
            {people === null ? <p className="p-2 text-support text-ink-muted">Loading…</p> : filtered.length === 0 ? <p className="p-2 text-support text-ink-muted">No one found.</p> : filtered.map((person) => (
              <Checkbox key={person.id} label={person.name} checked={chosen.includes(person.id)} onChange={(event) => setChosen(event.target.checked ? [...chosen, person.id] : chosen.filter((id) => id !== person.id))} />
            ))}
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
