"use client";

import { useCallback, useMemo, useState } from "react";
import { Flag, Plus, Target, Trash2 } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import Tabs from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/ToastProvider";
import { employeesApi, getApiErrorMessage, organizationApi, performanceApi } from "@/lib/api";
import { GOAL_HEALTH_LABELS, GOAL_HEALTH_TONES, GOAL_STATUS_TONES, type Goal, type GoalHealth, type GoalLevel, type KeyResult } from "@/lib/api/performance";
import { useAccess } from "@/lib/access";
import { cx } from "@/lib/cx";
import { formatDate, formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

type View = "mine" | "team" | "organisation";
type Person = { id: string; name: string };
type GoalForm = { level: GoalLevel; employee: string; department: string; parent: string; title: string; description: string; period_start: string; period_end: string; key_results: KeyResult[] };

function quarter() {
  const now = new Date();
  const start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { period_start: iso(start), period_end: iso(end) };
}

function ProgressBar({ value, health }: { value: number; health: GoalHealth }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-full min-w-24 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <span className={cx("block h-full rounded-full", health === "ON_TRACK" ? "bg-success" : health === "AT_RISK" ? "bg-warning" : "bg-danger")} style={{ width: `${value}%` }} />
      </span>
      <span className="w-10 text-right text-caption font-semibold tabular-nums text-ink-strong">{value}%</span>
    </span>
  );
}

/** Goals (OKRs): your goals, your team's, and the company and department goals they align to. */
export default function GoalsPage() {
  const { showToast } = useToast();
  const { can } = useAccess();
  const isHr = can("performance.manage");
  const canSeePeople = can("employee.view");
  const canSeeDepartments = can("organization.view");
  const [view, setView] = useState<View>("mine");

  // Only ask for lists the person may see: everyone else sets goals for themselves.
  const load = useCallback(async () => {
    const [goals, me, people, departments] = await Promise.all([
      performanceApi.listGoals(),
      employeesApi.getCurrentEmployee(),
      canSeePeople ? employeesApi.listEmployees({ page_size: 100, status: "ACTIVE", ordering: "first_name" }).then((page) => page.results).catch(() => []) : Promise.resolve([]),
      canSeeDepartments ? organizationApi.listDepartments({ page_size: 100, ordering: "name" }).then((page) => page.results).catch(() => []) : Promise.resolve([]),
    ]);
    return { goals: goals.results, me, people, departments };
  }, [canSeePeople, canSeeDepartments]);
  const { data, loading, error, reload } = useApiResource(load);
  const goals = useMemo(() => data?.goals ?? [], [data]);
  const me = data?.me ?? null;
  const team: Person[] = useMemo(() => (data?.people ?? []).filter((person) => person.id !== me?.id).map((person) => ({ id: person.id, name: person.full_name ?? `${person.first_name} ${person.last_name}` })), [data, me]);

  const mine = goals.filter((goal) => goal.level === "INDIVIDUAL" && goal.employee === me?.id);
  const teamGoals = goals.filter((goal) => goal.level === "INDIVIDUAL" && goal.employee !== me?.id);
  const organisation = goals.filter((goal) => goal.level !== "INDIVIDUAL");
  const rows = view === "mine" ? mine : view === "team" ? teamGoals : organisation;
  const alignable = organisation.filter((goal) => goal.status === "ACTIVE" || goal.status === "DRAFT");

  // Detail
  const [open, setOpen] = useState<Goal | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const openGoal = async (goal: Goal) => {
    setActionError("");
    try { setOpen(await performanceApi.getGoal(goal.id)); } catch (caught) { showToast({ tone: "error", message: getApiErrorMessage(caught) }); }
  };
  const act = async (action: "activate" | "complete" | "cancel") => {
    if (!open) return;
    setBusy(true); setActionError("");
    try { await performanceApi.goalAction(open.id, action); setOpen(await performanceApi.getGoal(open.id)); reload(); }
    catch (caught) { setActionError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  // Check-in
  const [checkIn, setCheckIn] = useState<{ health: GoalHealth; note: string; values: Record<string, string>; progress: string } | null>(null);
  const startCheckIn = () => open && setCheckIn({ health: open.health, note: "", progress: String(open.progress), values: Object.fromEntries(open.key_results.map((result) => [result.id ?? "", String(result.current_value ?? "")])) });
  const saveCheckIn = async () => {
    if (!open || !checkIn) return;
    setBusy(true); setActionError("");
    try {
      await performanceApi.checkInGoal(open.id, { health: checkIn.health, note: checkIn.note.trim(), ...(open.key_results.length ? { values: checkIn.values } : { progress: Number(checkIn.progress) || 0 }) });
      setCheckIn(null);
      setOpen(await performanceApi.getGoal(open.id));
      reload();
    } catch (caught) { setActionError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  // Create / edit
  const [editing, setEditing] = useState<{ goal: Goal | null; form: GoalForm } | null>(null);
  const [formError, setFormError] = useState("");
  const startCreate = () => {
    setFormError("");
    const level: GoalLevel = view === "organisation" ? (isHr ? "COMPANY" : "DEPARTMENT") : "INDIVIDUAL";
    setEditing({ goal: null, form: { level, employee: view === "mine" ? me?.id ?? "" : "", department: "", parent: "", title: "", description: "", ...quarter(), key_results: [{ title: "", unit: "", start_value: 0, target_value: "" }] } });
  };
  const startEdit = (goal: Goal) => {
    setFormError("");
    setEditing({ goal, form: { level: goal.level, employee: goal.employee ?? "", department: goal.department ?? "", parent: goal.parent ?? "", title: goal.title, description: goal.description, period_start: goal.period_start, period_end: goal.period_end, key_results: goal.key_results.map((result) => ({ ...result })) } });
  };
  const setForm = (patch: Partial<GoalForm>) => setEditing((current) => current && { ...current, form: { ...current.form, ...patch } });
  const setResult = (index: number, patch: Partial<KeyResult>) => editing && setForm({ key_results: editing.form.key_results.map((result, at) => (at === index ? { ...result, ...patch } : result)) });
  const saveGoal = async () => {
    if (!editing) return;
    const { form, goal } = editing;
    if (!form.title.trim()) { setFormError("Give the goal a title."); return; }
    const results = form.key_results.filter((result) => String(result.title).trim());
    if (results.some((result) => result.target_value === "" || Number.isNaN(Number(result.target_value)))) { setFormError("Give every key result a numeric target."); return; }
    setBusy(true); setFormError("");
    const payload = {
      level: form.level, employee: form.level === "INDIVIDUAL" ? form.employee || null : null, department: form.level === "DEPARTMENT" ? form.department || null : null,
      parent: form.parent || null, title: form.title.trim(), description: form.description.trim(), period_start: form.period_start, period_end: form.period_end,
      key_results: results.map((result) => ({ ...(result.id ? { id: result.id } : {}), title: String(result.title).trim(), unit: String(result.unit ?? "").trim(), start_value: result.start_value === "" ? 0 : result.start_value, target_value: result.target_value })),
    };
    try {
      const saved = goal ? await performanceApi.updateGoal(goal.id, payload) : await performanceApi.createGoal(payload);
      setEditing(null);
      showToast({ tone: "success", message: goal ? "Goal updated." : saved.status === "DRAFT" && saved.level === "INDIVIDUAL" ? "Goal saved. Your manager agrees it to make it active." : "Goal created." });
      if (open && goal) setOpen(await performanceApi.getGoal(goal.id));
      reload();
    } catch (caught) { setFormError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  const tabs = [
    { value: "mine", label: `My goals (${mine.length})` },
    ...(teamGoals.length || team.length ? [{ value: "team", label: `Team (${teamGoals.length})` }] : []),
    { value: "organisation", label: `Company & departments (${organisation.length})` },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Performance"
        title="Goals"
        description="Objectives with measurable key results. Your goals align to your department's, and theirs to the company's; check in regularly so everyone can see progress."
        icon={Target}
        accent="hr"
        actions={<Button leadingIcon={<Plus className="h-4 w-4" />} onClick={startCreate} disabled={!data}>New goal</Button>}
      />
      {error && <ErrorState variant="inline" title="Unable to load goals" message={error} onRetry={reload} />}
      <Tabs label="Goals" value={view} onChange={(value) => setView(value as View)} items={tabs} />

      {loading && !data ? <div className="space-y-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-20 w-full" />)}</div> : rows.length === 0 ? (
        <EmptyState
          icon={Flag}
          title={view === "mine" ? "No goals yet" : view === "team" ? "No team goals yet" : "No company or department goals yet"}
          description={view === "mine" ? "Draft a goal with one to three measurable key results; your manager agrees it." : view === "team" ? "Set goals for the people you manage, or agree the ones they draft." : "HR sets company goals; department heads set department goals that align to them."}
          action={<Button variant="secondary" leadingIcon={<Plus className="h-4 w-4" />} onClick={startCreate}>New goal</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((goal) => (
            <li key={goal.id}>
              <button type="button" onClick={() => void openGoal(goal)} className="block w-full rounded-xl border border-line bg-surface p-4 text-left shadow-elevation-1 transition hover:border-primary/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">
                      {goal.title}
                      {goal.status !== "ACTIVE" && <Badge size="sm" tone={GOAL_STATUS_TONES[goal.status]}>{goal.status === "DRAFT" && goal.level === "INDIVIDUAL" ? "Draft · needs agreeing" : goal.status_label}</Badge>}
                      {goal.status === "ACTIVE" && <Badge size="sm" tone={GOAL_HEALTH_TONES[goal.health]}>{goal.health_label}</Badge>}
                    </p>
                    <p className="mt-0.5 text-caption text-ink-muted">
                      {goal.level_label} · {goal.owner_name} · {formatDate(goal.period_start)} – {formatDate(goal.period_end)}
                      {goal.parent_title && ` · supports “${goal.parent_title}”`}
                      {goal.children_count > 0 && ` · ${goal.children_count} aligned`}
                    </p>
                  </div>
                  <div className="w-full sm:w-56"><ProgressBar value={goal.progress} health={goal.health} /></div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open !== null && checkIn === null}
        onClose={() => setOpen(null)}
        size="lg"
        title={open?.title ?? "Goal"}
        description={open ? `${open.level_label} · ${open.owner_name} · ${formatDate(open.period_start)} – ${formatDate(open.period_end)}` : undefined}
        footer={open && (
          <div className="flex w-full flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {open.viewer.can_manage && open.status === "DRAFT" && <Button loading={busy} onClick={() => void act("activate")}>{open.level === "INDIVIDUAL" ? "Agree goal" : "Activate"}</Button>}
              {open.viewer.can_check_in && <Button variant={open.status === "ACTIVE" ? "primary" : "secondary"} onClick={startCheckIn}>Check in</Button>}
              {open.viewer.can_edit && <Button variant="secondary" onClick={() => startEdit(open)}>Edit</Button>}
              {open.status === "ACTIVE" && (open.viewer.can_manage || open.viewer.is_owner) && <Button variant="secondary" loading={busy} onClick={() => void act("complete")}>Mark complete</Button>}
              {(open.viewer.can_manage || (open.status === "DRAFT" && open.viewer.is_owner)) && (open.status === "DRAFT" || open.status === "ACTIVE") && <Button variant="ghost" loading={busy} onClick={() => void act("cancel")}>Cancel goal</Button>}
            </div>
            <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>
          </div>
        )}
      >
        {open && (
          <div className="space-y-5">
            {actionError && <Alert tone="danger">{actionError}</Alert>}
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={GOAL_STATUS_TONES[open.status]}>{open.status_label}</Badge>
              {open.status === "ACTIVE" && <Badge tone={GOAL_HEALTH_TONES[open.health]}>{open.health_label}</Badge>}
              {open.agreed_by_name && <span className="text-caption text-ink-muted">Agreed by {open.agreed_by_name}</span>}
            </div>
            <ProgressBar value={open.progress} health={open.health} />
            {open.parent_title && <p className="text-support text-ink">Supports <span className="font-semibold">{open.parent_title}</span></p>}
            {open.description && <p className="whitespace-pre-wrap text-support text-ink">{open.description}</p>}
            {open.key_results.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-ink-strong">Key results</h3>
                <ul className="mt-2 space-y-2">
                  {open.key_results.map((result) => (
                    <li key={result.id} className="rounded-lg bg-surface-muted p-3">
                      <p className="flex justify-between gap-2 text-sm font-medium text-ink-strong"><span>{result.title}</span><span className="tabular-nums text-ink-muted">{Number(result.current_value)} / {Number(result.target_value)} {result.unit}</span></p>
                      <div className="mt-1.5"><ProgressBar value={result.progress ?? 0} health={open.health} /></div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {open.children && open.children.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-ink-strong">Aligned goals</h3>
                <ul className="mt-2 divide-y divide-line-soft">
                  {open.children.map((child) => <li key={child.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate">{child.title} <span className="text-ink-muted">· {child.owner_name}</span></span><span className="w-40"><ProgressBar value={child.progress} health={child.health} /></span></li>)}
                </ul>
              </section>
            )}
            <section>
              <h3 className="text-sm font-semibold text-ink-strong">Check-ins</h3>
              {open.check_ins && open.check_ins.length ? (
                <ul className="mt-2 space-y-2">
                  {open.check_ins.map((entry) => (
                    <li key={entry.id} className="text-sm">
                      <p className="flex flex-wrap items-center gap-2"><Badge size="sm" tone={GOAL_HEALTH_TONES[entry.health]}>{entry.health_label}</Badge><span className="font-semibold tabular-nums">{entry.progress}%</span><span className="text-caption text-ink-muted">{entry.author_name} · {formatDateTime(entry.created_at)}</span></p>
                      {entry.note && <p className="mt-0.5 text-ink">{entry.note}</p>}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-support text-ink-muted">No check-ins yet.</p>}
            </section>
          </div>
        )}
      </Dialog>

      <Dialog
        open={checkIn !== null}
        onClose={() => setCheckIn(null)}
        dismissible={!busy}
        title={open ? `Check in: ${open.title}` : "Check in"}
        footer={<><Button variant="secondary" onClick={() => setCheckIn(null)} disabled={busy}>Back</Button><Button loading={busy} onClick={() => void saveCheckIn()}>Save check-in</Button></>}
      >
        {open && checkIn && (
          <div className="space-y-4">
            {actionError && <Alert tone="danger">{actionError}</Alert>}
            <Field label="How is it going?">
              <Select value={checkIn.health} onChange={(event) => setCheckIn({ ...checkIn, health: event.target.value as GoalHealth })}>
                {Object.entries(GOAL_HEALTH_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            {open.key_results.length ? open.key_results.map((result) => (
              <Field key={result.id} label={result.title} helper={`From ${Number(result.start_value)} to ${Number(result.target_value)} ${result.unit}`}>
                <Input type="number" step="any" value={checkIn.values[result.id ?? ""] ?? ""} onChange={(event) => setCheckIn({ ...checkIn, values: { ...checkIn.values, [result.id ?? ""]: event.target.value } })} />
              </Field>
            )) : (
              <Field label="Progress (%)"><Input type="number" min={0} max={100} value={checkIn.progress} onChange={(event) => setCheckIn({ ...checkIn, progress: event.target.value })} /></Field>
            )}
            <Field label="Note" optional><Textarea rows={3} maxLength={2000} value={checkIn.note} onChange={(event) => setCheckIn({ ...checkIn, note: event.target.value })} placeholder="What moved, what's blocking you, what's next" /></Field>
          </div>
        )}
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        dismissible={!busy}
        size="lg"
        title={editing?.goal ? "Edit goal" : "New goal"}
        footer={<><Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button loading={busy} onClick={() => void saveGoal()}>{editing?.goal ? "Save changes" : "Save goal"}</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            {formError && <Alert tone="danger">{formError}</Alert>}
            {!editing.goal && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Level">
                  <Select value={editing.form.level} onChange={(event) => setForm({ level: event.target.value as GoalLevel })}>
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="DEPARTMENT">Department</option>
                    {isHr && <option value="COMPANY">Company</option>}
                  </Select>
                </Field>
                {editing.form.level === "INDIVIDUAL" && (
                  <Field label="Whose goal" required>
                    <Select value={editing.form.employee} onChange={(event) => setForm({ employee: event.target.value })}>
                      <option value="">Choose</option>
                      {me && <option value={me.id}>Me</option>}
                      {team.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                    </Select>
                  </Field>
                )}
                {editing.form.level === "DEPARTMENT" && (
                  <Field label="Department" required>
                    <Select value={editing.form.department} onChange={(event) => setForm({ department: event.target.value })}>
                      <option value="">Choose</option>
                      {(data?.departments ?? []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </Select>
                  </Field>
                )}
              </div>
            )}
            <Field label="Objective" required><Input value={editing.form.title} maxLength={200} onChange={(event) => setForm({ title: event.target.value })} placeholder="e.g. Cut depot loading time" data-autofocus /></Field>
            <Field label="Why it matters" optional><Textarea rows={2} value={editing.form.description} onChange={(event) => setForm({ description: event.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start"><Input type="date" value={editing.form.period_start} onChange={(event) => setForm({ period_start: event.target.value })} /></Field>
              <Field label="End"><Input type="date" value={editing.form.period_end} onChange={(event) => setForm({ period_end: event.target.value })} /></Field>
              {editing.form.level !== "COMPANY" && (
                <Field label="Supports" optional>
                  <Select value={editing.form.parent} onChange={(event) => setForm({ parent: event.target.value })}>
                    <option value="">Nothing</option>
                    {alignable.filter((goal) => goal.id !== editing.goal?.id && (editing.form.level === "INDIVIDUAL" || goal.level === "COMPANY")).map((goal) => <option key={goal.id} value={goal.id}>{goal.level === "COMPANY" ? "Company" : goal.owner_name}: {goal.title}</option>)}
                  </Select>
                </Field>
              )}
            </div>
            <section className="space-y-2">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-ink-strong">Key results</h3><span className="text-caption text-ink-muted">How you will measure it</span></div>
              {editing.form.key_results.map((result, index) => (
                <div key={result.id ?? `new-${index}`} className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                  <Field label={index === 0 ? "Key result" : ""} hideLabel={index !== 0}><Input value={String(result.title)} onChange={(event) => setResult(index, { title: event.target.value })} placeholder="e.g. Average loading time" /></Field>
                  <Field label={index === 0 ? "From" : ""} hideLabel={index !== 0}><Input type="number" step="any" value={String(result.start_value)} onChange={(event) => setResult(index, { start_value: event.target.value })} /></Field>
                  <Field label={index === 0 ? "Target" : ""} hideLabel={index !== 0}><Input type="number" step="any" value={String(result.target_value)} onChange={(event) => setResult(index, { target_value: event.target.value })} /></Field>
                  <Field label={index === 0 ? "Unit" : ""} hideLabel={index !== 0}><Input value={String(result.unit ?? "")} maxLength={30} onChange={(event) => setResult(index, { unit: event.target.value })} placeholder="min" /></Field>
                  <IconButton label="Remove key result" onClick={() => setForm({ key_results: editing.form.key_results.filter((_, at) => at !== index) })}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              ))}
              {editing.form.key_results.length < 5 && <Button size="sm" variant="ghost" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setForm({ key_results: [...editing.form.key_results, { title: "", unit: "", start_value: 0, target_value: "" }] })}>Add key result</Button>}
              <p className="text-caption text-ink-muted">No key results? Progress is then whatever you report at each check-in.</p>
            </section>
          </div>
        )}
      </Dialog>
    </div>
  );
}
