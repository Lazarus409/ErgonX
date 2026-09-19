"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { getApiErrorMessage, schedulingApi } from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/types/api";
import type {
  RotationPattern,
  RotationStep,
  Shift,
  ShiftPattern,
} from "@/types/attendance";
import { EM_DASH } from "@/lib/format";

const ALL = "ALL";

interface PatternForm {
  name: string;
  code: string;
  isActive: boolean;
}

const emptyPatternForm: PatternForm = {
  name: "",
  code: "",
  isActive: true,
};

interface StepForm {
  sequence: number;
  shiftPattern: string;
  shift: string;
  durationDays: number;
}

const emptyStepForm: StepForm = {
  sequence: 1,
  shiftPattern: "",
  shift: "",
  durationDays: 1,
};

export default function RotationsPage() {
  const [patterns, setPatterns] = useState<RotationPattern[]>([]);
  const [steps, setSteps] = useState<RotationStep[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftPatterns, setShiftPatterns] = useState<ShiftPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);

  const [patternModalOpen, setPatternModalOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<RotationPattern | null>(
    null,
  );
  const [patternForm, setPatternForm] =
    useState<PatternForm>(emptyPatternForm);

  const [stepModalFor, setStepModalFor] = useState<RotationPattern | null>(
    null,
  );
  const [editingStep, setEditingStep] = useState<RotationStep | null>(null);
  const [stepForm, setStepForm] = useState<StepForm>(emptyStepForm);

  const [deleteTarget, setDeleteTarget] = useState<RotationStep | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [patternPage, stepPage, shiftPage, shiftPatternPage] =
          await Promise.all([
            schedulingApi.listRotationPatterns({
              page_size: MAX_PAGE_SIZE,
              ordering: "name",
            }),
            schedulingApi.listRotationSteps({
              page_size: MAX_PAGE_SIZE,
              ordering: "sequence",
            }),
            schedulingApi.listShifts({
              page_size: MAX_PAGE_SIZE,
              ordering: "name",
            }),
            schedulingApi.listShiftPatterns({
              page_size: MAX_PAGE_SIZE,
              ordering: "name",
            }),
          ]);

        if (!active) {
          return;
        }

        setPatterns(patternPage.results);
        setSteps(stepPage.results);
        setShifts(shiftPage.results);
        setShiftPatterns(shiftPatternPage.results);
      } catch (caught) {
        if (active) {
          setError(getApiErrorMessage(caught));
          setPatterns([]);
          setSteps([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const shiftNames = useMemo(
    () => new Map(shifts.map((shift) => [shift.id, shift.name])),
    [shifts],
  );

  const shiftPatternNames = useMemo(
    () => new Map(shiftPatterns.map((item) => [item.id, item.name])),
    [shiftPatterns],
  );

  const stepsByPattern = useMemo(() => {
    const grouped = new Map<string, RotationStep[]>();

    for (const step of steps) {
      const existing = grouped.get(step.rotation_pattern) ?? [];
      existing.push(step);
      grouped.set(step.rotation_pattern, existing);
    }

    for (const list of grouped.values()) {
      list.sort((a, b) => a.sequence - b.sequence);
    }

    return grouped;
  }, [steps]);

  const filteredPatterns = useMemo(() => {
    const value = search.trim().toLowerCase();

    return patterns.filter((pattern) => {
      const matchesSearch =
        !value ||
        pattern.name.toLowerCase().includes(value) ||
        pattern.code.toLowerCase().includes(value);

      const matchesStatus =
        statusFilter === ALL ||
        (statusFilter === "ACTIVE" ? pattern.is_active : !pattern.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [patterns, search, statusFilter]);

  const savePattern = useCallback(async () => {
    if (!patternForm.name.trim() || !patternForm.code.trim()) {
      setFormError("Rotation name and code are required.");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload: Partial<RotationPattern> = {
      name: patternForm.name.trim(),
      code: patternForm.code.trim(),
      is_active: patternForm.isActive,
    };

    try {
      if (editingPattern) {
        await schedulingApi.updateRotationPattern(editingPattern.id, payload);
      } else {
        await schedulingApi.createRotationPattern(payload);
      }

      setPatternModalOpen(false);
      reload();
    } catch (caught) {
      setFormError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }, [patternForm, editingPattern, reload]);

  const saveStep = useCallback(async () => {
    if (!stepModalFor) {
      return;
    }

    if (!stepForm.shiftPattern && !stepForm.shift) {
      setFormError("Select either a shift pattern or a shift for this step.");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload: Partial<RotationStep> = {
      rotation_pattern: stepModalFor.id,
      sequence: stepForm.sequence,
      shift_pattern: stepForm.shiftPattern || null,
      shift: stepForm.shift || null,
      duration_days: stepForm.durationDays,
    };

    try {
      if (editingStep) {
        await schedulingApi.updateRotationStep(editingStep.id, payload);
      } else {
        await schedulingApi.createRotationStep(payload);
      }

      setStepModalFor(null);
      setEditingStep(null);
      reload();
    } catch (caught) {
      setFormError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }, [stepModalFor, stepForm, editingStep, reload]);

  const deleteStep = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    setSaving(true);

    try {
      await schedulingApi.deleteRotationStep(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (caught) {
      setDeleteTarget(null);
      setError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }, [deleteTarget, reload]);

  const openNewStep = (pattern: RotationPattern) => {
    const existing = stepsByPattern.get(pattern.id) ?? [];

    setStepModalFor(pattern);
    setEditingStep(null);
    setFormError("");
    setStepForm({
      ...emptyStepForm,
      sequence: existing.length + 1,
    });
  };

  const openEditStep = (pattern: RotationPattern, step: RotationStep) => {
    setStepModalFor(pattern);
    setEditingStep(step);
    setFormError("");
    setStepForm({
      sequence: step.sequence,
      shiftPattern: step.shift_pattern ?? "",
      shift: step.shift ?? "",
      durationDays: step.duration_days,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rotation Patterns"
        description="Define rotating sequences of shift patterns or shifts."
        actions={
          <button
            onClick={() => {
              setEditingPattern(null);
              setPatternForm(emptyPatternForm);
              setFormError("");
              setPatternModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Rotation
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Rotations"
          value={patterns.length}
          icon={<RotateCcw className="h-5 w-5" />}
        />
        <SummaryCard
          title="Active"
          value={patterns.filter((pattern) => pattern.is_active).length}
          icon={<Clock3 className="h-5 w-5" />}
        />
        <SummaryCard
          title="Steps"
          value={steps.length}
          icon={<CalendarDays className="h-5 w-5" />}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rotation patterns..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value={ALL}>All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {filteredPatterns.length === 0 ? (
        <EmptyState
          title={loading ? "Loading rotations..." : "No rotation patterns"}
          description={
            loading
              ? "Please wait."
              : "Create a rotation to sequence shift patterns across a cycle."
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredPatterns.map((pattern) => {
            const patternSteps = stepsByPattern.get(pattern.id) ?? [];

            const totalDays = patternSteps.reduce(
              (total, step) => total + step.duration_days,
              0,
            );

            return (
              <section
                key={pattern.id}
                className="rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-semibold text-slate-900">
                        {pattern.name}
                      </h2>

                      <StatusBadge
                        status={pattern.is_active ? "ACTIVE" : "INACTIVE"}
                      />
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {pattern.code} · {patternSteps.length} step
                      {patternSteps.length === 1 ? "" : "s"} · {totalDays} day
                      {totalDays === 1 ? "" : "s"} per cycle
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openNewStep(pattern)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add step
                    </button>

                    <button
                      onClick={() => {
                        setEditingPattern(pattern);
                        setPatternForm({
                          name: pattern.name,
                          code: pattern.code,
                          isActive: pattern.is_active,
                        });
                        setFormError("");
                        setPatternModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </div>
                </div>

                {patternSteps.length === 0 ? (
                  <p className="p-5 text-sm text-slate-500">
                    No steps configured. Add a step to define the rotation
                    sequence.
                  </p>
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {patternSteps.map((step) => (
                      <li
                        key={step.id}
                        className="flex items-center gap-4 px-5 py-4"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          {step.sequence}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {step.shift_pattern
                              ? (shiftPatternNames.get(step.shift_pattern) ??
                                EM_DASH)
                              : (shiftNames.get(step.shift ?? "") ?? EM_DASH)}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            {step.shift_pattern ? "Shift pattern" : "Shift"} ·{" "}
                            {step.duration_days} day
                            {step.duration_days === 1 ? "" : "s"}
                          </p>
                        </div>

                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />

                        <button
                          onClick={() => openEditStep(pattern, step)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => setDeleteTarget(step)}
                          aria-label={`Remove step ${step.sequence}`}
                          className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Rotation pattern modal */}
      {patternModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingPattern ? "Edit Rotation" : "Add Rotation"}
              </h2>

              <button
                onClick={() => setPatternModalOpen(false)}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Name</span>
                <input
                  value={patternForm.name}
                  onChange={(event) =>
                    setPatternForm({ ...patternForm, name: event.target.value })
                  }
                  placeholder="e.g. Security 3-Shift Rotation"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Code</span>
                <input
                  value={patternForm.code}
                  onChange={(event) =>
                    setPatternForm({ ...patternForm, code: event.target.value })
                  }
                  placeholder="e.g. SEC-3R"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={patternForm.isActive}
                  onChange={(event) =>
                    setPatternForm({
                      ...patternForm,
                      isActive: event.target.checked,
                    })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-700">
                  Active
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setPatternModalOpen(false)}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={savePattern}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingPattern ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step modal */}
      {stepModalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingStep ? "Edit Step" : "Add Step"}
              </h2>

              <button
                onClick={() => setStepModalFor(null)}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  Sequence
                </span>
                <input
                  type="number"
                  min="1"
                  value={stepForm.sequence}
                  onChange={(event) =>
                    setStepForm({
                      ...stepForm,
                      sequence: Number(event.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </label>

              {/* A step references either a shift pattern or a single shift. */}
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  Shift Pattern
                </span>
                <select
                  value={stepForm.shiftPattern}
                  onChange={(event) =>
                    setStepForm({
                      ...stepForm,
                      shiftPattern: event.target.value,
                      shift: event.target.value ? "" : stepForm.shift,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">None</option>

                  {shiftPatterns.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  Shift
                </span>
                <select
                  value={stepForm.shift}
                  onChange={(event) =>
                    setStepForm({
                      ...stepForm,
                      shift: event.target.value,
                      shiftPattern: event.target.value
                        ? ""
                        : stepForm.shiftPattern,
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">None</option>

                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-slate-700">
                  Duration (days)
                </span>
                <input
                  type="number"
                  min="1"
                  value={stepForm.durationDays}
                  onChange={(event) =>
                    setStepForm({
                      ...stepForm,
                      durationDays: Number(event.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setStepModalFor(null)}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={saveStep}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingStep ? "Save" : "Add Step"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove this rotation step?"
        description="The step is removed from the rotation sequence. This cannot be undone."
        confirmLabel="Remove step"
        destructive
        loading={saving}
        onConfirm={deleteStep}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>

        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          {icon}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
