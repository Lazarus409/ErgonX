"use client";

import { useCallback, useMemo, useState } from "react";
import { Crown, Grid3x3, Plus, ShieldAlert, Star, Trash2, Users } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, MetricCard } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { getApiErrorMessage, organizationApi, performanceApi } from "@/lib/api";
import { READINESS_LABELS, READINESS_TONES, TALENT_LEVEL_LABELS, type Readiness, type SuccessionPlan, type TalentLevel, type TalentRow } from "@/lib/api/performance";
import { useAccess } from "@/lib/access";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

type View = "succession" | "grid";
const LEVELS: TalentLevel[] = ["HIGH", "MEDIUM", "LOW"];
// 9-box names, keyed performance:potential.
const BOX_NAMES: Record<string, string> = {
  "HIGH:HIGH": "Future leader", "MEDIUM:HIGH": "Growth employee", "LOW:HIGH": "Enigma",
  "HIGH:MEDIUM": "High performer", "MEDIUM:MEDIUM": "Core player", "LOW:MEDIUM": "Inconsistent",
  "HIGH:LOW": "Trusted professional", "MEDIUM:LOW": "Effective", "LOW:LOW": "Under-performer",
};
const COVER: Record<SuccessionPlan["cover"]["status"], { label: string; tone: "success" | "warning" | "danger" }> = {
  READY: { label: "Covered", tone: "success" }, DEVELOPING: { label: "Developing", tone: "warning" }, NONE: { label: "No successor", tone: "danger" },
};

/** Talent & succession (confidential): critical positions and who could fill them, and the 9-box talent grid. */
export default function TalentPage() {
  const canManage = useAccess().can("talent.manage");
  const [view, setView] = useState<View>("succession");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [plans, grid, positions] = await Promise.all([
      performanceApi.listSuccessionPlans(),
      performanceApi.getTalentGrid(),
      organizationApi.listPositions({ page_size: 100, ordering: "title", is_active: true }).then((page) => page.results).catch(() => []),
    ]);
    return { plans: plans.results, grid, positions };
  }, []);
  const { data, loading, error: loadError, reload } = useApiResource(load);
  const plans = useMemo(() => data?.plans ?? [], [data]);
  const grid = data?.grid;
  const people = grid?.employees ?? [];
  const planned = new Set(plans.map((plan) => plan.position));

  // Succession
  const [newPlan, setNewPlan] = useState<{ position: string; risk_of_loss: TalentLevel; impact_of_loss: TalentLevel; notes: string } | null>(null);
  const [adding, setAdding] = useState<{ plan: SuccessionPlan; employee: string; readiness: Readiness; development_notes: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const run = async (work: () => Promise<unknown>, after?: () => void) => {
    setSaving(true); setError("");
    try { await work(); after?.(); reload(); } catch (caught) { setError(getApiErrorMessage(caught)); } finally { setSaving(false); }
  };

  // Grid
  const [assessing, setAssessing] = useState<TalentRow | null>(null);
  const [box, setBox] = useState<string | null>(null);
  const boxPeople = box ? people.filter((row) => `${row.performance}:${row.potential}` === box) : [];
  const unplaced = people.filter((row) => !row.performance || !row.potential);

  const critical = plans.filter((plan) => plan.is_critical);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Human Resources · Confidential"
        title="Talent & succession"
       
        icon={Crown}
        accent="hr"
        actions={canManage && view === "succession" ? <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setNewPlan({ position: "", risk_of_loss: "MEDIUM", impact_of_loss: "HIGH", notes: "" })}>Add position</Button> : null}
      />
      {(loadError || error) && <ErrorState variant="inline" title="Something went wrong" message={loadError || error} onRetry={reload} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Talent summary">
        <MetricCard label="Critical positions" value={String(critical.length)} description={`${critical.filter((plan) => plan.cover.status === "NONE").length} without a successor`} icon={Crown} accent="hr" loading={loading && !data} />
        <MetricCard label="Ready-now cover" value={critical.length ? `${Math.round((critical.filter((plan) => plan.cover.READY_NOW > 0).length * 100) / critical.length)}%` : "—"} icon={ShieldAlert} accent="audit" loading={loading && !data} />
        <MetricCard label="Talent pool" value={String(grid?.summary.talent_pool ?? 0)} description={`${grid?.summary.placed ?? 0} of ${grid?.summary.employees ?? 0} placed on the grid`} icon={Star} accent="leave" loading={loading && !data} />
        <MetricCard label="High flight risk" value={String(grid?.summary.high_flight_risk ?? 0)} icon={Users} accent="payroll" loading={loading && !data} />
      </section>

      <Tabs label="Talent" value={view} onChange={(value) => setView(value as View)} items={[{ value: "succession", label: "Succession" }, { value: "grid", label: "Talent grid" }]} />

      {view === "succession" ? (
        plans.length === 0 && data ? (
          <EmptyState icon={Crown} title="No succession plans yet" description="Start with the roles the organisation can't run without, then name who could step in and how soon." action={canManage ? <Button variant="secondary" onClick={() => setNewPlan({ position: "", risk_of_loss: "MEDIUM", impact_of_loss: "HIGH", notes: "" })}>Add position</Button> : undefined} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {plans.map((plan) => (
              <Card key={plan.id} title={plan.position_title} description={plan.department_name || undefined} icon={Crown} accent="hr" actions={<span className="flex items-center gap-2">{plan.is_critical && <Badge tone="brand">Critical</Badge>}<Badge tone={COVER[plan.cover.status].tone}>{COVER[plan.cover.status].label}</Badge></span>}>
                <p className="text-caption text-ink-muted">Held by {plan.incumbents.length ? plan.incumbents.map((person) => person.name).join(", ") : "nobody (vacant)"} · risk of loss {plan.risk_of_loss_label.toLowerCase()} · impact {plan.impact_of_loss_label.toLowerCase()}</p>
                {plan.notes && <p className="mt-1 text-support text-ink">{plan.notes}</p>}
                <ul className="mt-3 divide-y divide-line-soft">
                  {plan.successors.map((successor) => (
                    <li key={successor.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0"><span className="block truncate font-medium text-ink-strong">{successor.employee_name}</span><span className="block truncate text-caption text-ink-muted">{successor.current_position}{successor.latest_rating ? ` · last rating ${successor.latest_rating}/5` : ""}{successor.development_notes ? ` · ${successor.development_notes}` : ""}</span></span>
                      <span className="flex shrink-0 items-center gap-1"><Badge size="sm" tone={READINESS_TONES[successor.readiness]}>{READINESS_LABELS[successor.readiness]}</Badge>{canManage && <IconButton size="sm" label={`Remove ${successor.employee_name}`} onClick={() => void run(() => performanceApi.removeSuccessor(plan.id, successor.id))}><Trash2 className="h-4 w-4" /></IconButton>}</span>
                    </li>
                  ))}
                  {plan.successors.length === 0 && <li className="py-2 text-support text-ink-muted">No successors named.</li>}
                </ul>
                {canManage && (
                  <div className="mt-2 flex flex-wrap justify-between gap-2">
                    <Button size="sm" variant="ghost" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setAdding({ plan, employee: "", readiness: "ONE_TO_TWO_YEARS", development_notes: "" })}>Add successor</Button>
                    <Button size="sm" variant="ghost" className="text-danger-ink" onClick={() => window.confirm(`Remove the succession plan for ${plan.position_title}?`) && void run(() => performanceApi.deleteSuccessionPlan(plan.id))}>Remove plan</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card title="9-box grid" icon={Grid3x3} accent="hr">
            <div className="grid grid-cols-[2rem_repeat(3,minmax(0,1fr))] gap-1.5 text-center">
              {LEVELS.map((potential) => (
                <div key={potential} className="contents">
                  <span className="flex items-center justify-center text-caption font-semibold text-ink-muted [writing-mode:vertical-rl] rotate-180">{TALENT_LEVEL_LABELS[potential]}</span>
                  {(["LOW", "MEDIUM", "HIGH"] as TalentLevel[]).map((performance) => {
                    const key = `${performance}:${potential}`;
                    const count = grid?.boxes[key] ?? 0;
                    return (
                      <button key={key} type="button" onClick={() => setBox(box === key ? null : key)} aria-pressed={box === key}
                        className={cx("rounded-lg border p-2 text-left transition", box === key ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-primary/40", performance === "HIGH" && potential === "HIGH" && "ring-1 ring-success/40")}>
                        <span className="block text-caption text-ink-muted">{BOX_NAMES[key]}</span>
                        <span className="block text-xl font-bold tabular-nums text-ink-strong">{count}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              <span />
              {(["LOW", "MEDIUM", "HIGH"] as TalentLevel[]).map((performance) => <span key={performance} className="text-caption font-semibold text-ink-muted">{TALENT_LEVEL_LABELS[performance]}</span>)}
            </div>
            <p className="mt-2 text-center text-caption text-ink-muted">Performance → · ↑ Potential</p>
          </Card>
          <Card title={box ? BOX_NAMES[box] : unplaced.length ? "Not yet placed" : "People"} description={box ? `${boxPeople.length} people` : unplaced.length ? "Assess potential (and add a review rating) to place people on the grid." : undefined} icon={Users} accent="hr">
            <ul className="max-h-[28rem] divide-y divide-line-soft overflow-y-auto">
              {(box ? boxPeople : unplaced.length ? unplaced : people).map((row) => (
                <li key={row.employee_id}>
                  <button type="button" disabled={!canManage} onClick={() => setAssessing(row)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm hover:bg-surface-hover disabled:cursor-default">
                    <span className="min-w-0"><span className="block truncate font-medium text-ink-strong">{row.employee}</span><span className="block truncate text-caption text-ink-muted">{[row.position, row.department].filter(Boolean).join(" · ")}</span></span>
                    <span className="flex shrink-0 gap-1">{row.in_talent_pool && <Badge size="sm" tone="success">Pool</Badge>}{row.flight_risk === "HIGH" && <Badge size="sm" tone="danger">Flight risk</Badge>}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Dialog open={newPlan !== null} onClose={() => setNewPlan(null)} dismissible={!saving} title="Add a position to succession planning"
        footer={<><Button variant="secondary" onClick={() => setNewPlan(null)} disabled={saving}>Cancel</Button><Button loading={saving} disabled={!newPlan?.position} onClick={() => newPlan && void run(() => performanceApi.createSuccessionPlan({ ...newPlan, is_critical: true }), () => setNewPlan(null))}>Add</Button></>}>
        {newPlan && (
          <div className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Position" required>
              <Select value={newPlan.position} onChange={(event) => setNewPlan({ ...newPlan, position: event.target.value })}>
                <option value="">Choose</option>
                {(data?.positions ?? []).filter((position) => !planned.has(position.id)).map((position) => <option key={position.id} value={position.id}>{position.title}</option>)}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Risk of losing the incumbent"><Select value={newPlan.risk_of_loss} onChange={(event) => setNewPlan({ ...newPlan, risk_of_loss: event.target.value as TalentLevel })}>{LEVELS.map((level) => <option key={level} value={level}>{TALENT_LEVEL_LABELS[level]}</option>)}</Select></Field>
              <Field label="Impact if the role is empty"><Select value={newPlan.impact_of_loss} onChange={(event) => setNewPlan({ ...newPlan, impact_of_loss: event.target.value as TalentLevel })}>{LEVELS.map((level) => <option key={level} value={level}>{TALENT_LEVEL_LABELS[level]}</option>)}</Select></Field>
            </div>
            <Field label="Notes" optional><Textarea rows={2} value={newPlan.notes} onChange={(event) => setNewPlan({ ...newPlan, notes: event.target.value })} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog open={adding !== null} onClose={() => setAdding(null)} dismissible={!saving} title={adding ? `Successor for ${adding.plan.position_title}` : "Successor"}
        footer={<><Button variant="secondary" onClick={() => setAdding(null)} disabled={saving}>Cancel</Button><Button loading={saving} disabled={!adding?.employee} onClick={() => adding && void run(() => performanceApi.saveSuccessor(adding.plan.id, { employee: adding.employee, readiness: adding.readiness, development_notes: adding.development_notes }), () => setAdding(null))}>Save</Button></>}>
        {adding && (
          <div className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field label="Employee" required>
              <Select value={adding.employee} onChange={(event) => setAdding({ ...adding, employee: event.target.value })}>
                <option value="">Choose</option>
                {people.filter((row) => !adding.plan.successors.some((successor) => successor.employee === row.employee_id)).map((row) => <option key={row.employee_id} value={row.employee_id}>{row.employee}{row.position ? ` · ${row.position}` : ""}</option>)}
              </Select>
            </Field>
            <Field label="Readiness"><Select value={adding.readiness} onChange={(event) => setAdding({ ...adding, readiness: event.target.value as Readiness })}>{Object.entries(READINESS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
            <Field label="Development needed" optional><Textarea rows={2} value={adding.development_notes} onChange={(event) => setAdding({ ...adding, development_notes: event.target.value })} placeholder="e.g. Lead one budget round; complete the leadership course" /></Field>
          </div>
        )}
      </Dialog>

      {assessing && <AssessDialog row={assessing} onClose={() => setAssessing(null)} onSaved={() => { setAssessing(null); reload(); }} />}
    </div>
  );
}

function AssessDialog({ row, onClose, onSaved }: { row: TalentRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ potential: row.potential, performance_override: row.performance_overridden ? row.performance : "", flight_risk: row.flight_risk, in_talent_pool: row.in_talent_pool, career_aspiration: row.career_aspiration, notes: row.notes });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true); setError("");
    try { await performanceApi.assessTalent({ employee: row.employee_id, ...form }); onSaved(); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };
  const level = (value: string, onChange: (value: TalentLevel | "") => void, blank: string) => (
    <Select value={value} onChange={(event) => onChange(event.target.value as TalentLevel | "")}><option value="">{blank}</option>{LEVELS.map((item) => <option key={item} value={item}>{TALENT_LEVEL_LABELS[item]}</option>)}</Select>
  );
  return (
    <Dialog open onClose={onClose} dismissible={!saving} title={`Talent assessment · ${row.employee}`} description={`${[row.position, row.department].filter(Boolean).join(" · ")}${row.latest_rating ? ` · last review ${row.latest_rating}/5` : " · no signed-off review yet"}${row.assessed_at ? ` · last assessed ${formatDate(row.assessed_at)} by ${row.assessed_by}` : ""}`}
      footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button loading={saving} onClick={() => void save()}>Save assessment</Button></>}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Potential">{level(form.potential, (value) => setForm({ ...form, potential: value }), "Not assessed")}</Field>
          <Field label="Performance" helper="Leave as 'From reviews' to use the latest rating.">{level(form.performance_override, (value) => setForm({ ...form, performance_override: value }), "From reviews")}</Field>
          <Field label="Flight risk">{level(form.flight_risk, (value) => setForm({ ...form, flight_risk: value }), "Not assessed")}</Field>
        </div>
        <Checkbox label="In the talent pool" description="People being developed for bigger roles." checked={form.in_talent_pool} onChange={(event) => setForm({ ...form, in_talent_pool: event.target.checked })} />
        <Field label="Career aspiration" optional><Input maxLength={300} value={form.career_aspiration} onChange={(event) => setForm({ ...form, career_aspiration: event.target.value })} placeholder="e.g. Wants to move into operations management" /></Field>
        <Field label="Notes" optional><Textarea rows={3} maxLength={3000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
      </div>
    </Dialog>
  );
}
