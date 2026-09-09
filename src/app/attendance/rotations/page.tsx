"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  Clock3,
  GripVertical,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";

type RotationStep = {
  id: number;
  order: number;
  day: string;
  shift: string;
  start: string;
  end: string;
  crossMidnight: boolean;
  location: string;
};

type RotationPattern = {
  id: number;
  name: string;
  code: string;
  cycle: string;
  status: "ACTIVE" | "INACTIVE";
  employees: number;
  effectiveFrom: string;
  steps: RotationStep[];
};

const initialPatterns: RotationPattern[] = [
  {
    id: 1,
    name: "Security 3-Shift Rotation",
    code: "SEC-3R",
    cycle: "3-week cycle",
    status: "ACTIVE",
    employees: 24,
    effectiveFrom: "01 Jan 2026",
    steps: [
      {
        id: 1,
        order: 1,
        day: "Mon",
        shift: "Morning",
        start: "06:00",
        end: "14:00",
        crossMidnight: false,
        location: "Main Office",
      },
      {
        id: 2,
        order: 2,
        day: "Tue",
        shift: "Morning",
        start: "06:00",
        end: "14:00",
        crossMidnight: false,
        location: "Main Office",
      },
      {
        id: 3,
        order: 3,
        day: "Wed",
        shift: "Evening",
        start: "14:00",
        end: "22:00",
        crossMidnight: false,
        location: "Main Office",
      },
      {
        id: 4,
        order: 4,
        day: "Thu",
        shift: "Evening",
        start: "14:00",
        end: "22:00",
        crossMidnight: false,
        location: "Main Office",
      },
      {
        id: 5,
        order: 5,
        day: "Fri",
        shift: "Night",
        start: "22:00",
        end: "06:00",
        crossMidnight: true,
        location: "Main Office",
      },
    ],
  },
  {
    id: 2,
    name: "Operations 2-Shift Rotation",
    code: "OPS-2R",
    cycle: "2-week cycle",
    status: "ACTIVE",
    employees: 16,
    effectiveFrom: "15 Feb 2026",
    steps: [
      {
        id: 6,
        order: 1,
        day: "Mon",
        shift: "Day",
        start: "08:00",
        end: "16:00",
        crossMidnight: false,
        location: "Operations Site",
      },
      {
        id: 7,
        order: 2,
        day: "Tue",
        shift: "Day",
        start: "08:00",
        end: "16:00",
        crossMidnight: false,
        location: "Operations Site",
      },
      {
        id: 8,
        order: 3,
        day: "Wed",
        shift: "Night",
        start: "20:00",
        end: "04:00",
        crossMidnight: true,
        location: "Operations Site",
      },
      {
        id: 9,
        order: 4,
        day: "Thu",
        shift: "Night",
        start: "20:00",
        end: "04:00",
        crossMidnight: true,
        location: "Operations Site",
      },
    ],
  },
];

const emptyStep = (id: number, order: number): RotationStep => ({
  id,
  order,
  day: "Mon",
  shift: "Day",
  start: "08:00",
  end: "16:00",
  crossMidnight: false,
  location: "Main Office",
});

export default function RotationPatternsPage() {
  const [patterns, setPatterns] = useState(initialPatterns);
  const [selectedId, setSelectedId] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<RotationPattern | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [cycle, setCycle] = useState("1-week cycle");
  const [effectiveFrom, setEffectiveFrom] = useState("2026-09-13");
  const [steps, setSteps] = useState<RotationStep[]>([]);

  const selectedPattern = patterns.find((pattern) => pattern.id === selectedId) ?? patterns[0];

  const filteredPatterns = useMemo(() => {
    return patterns.filter((pattern) => {
      const matchesSearch =
        !search ||
        `${pattern.name} ${pattern.code}`.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = status === "ALL" || pattern.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [patterns, search, status]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setCode("");
    setCycle("1-week cycle");
    setEffectiveFrom("2026-09-13");
    setSteps([emptyStep(Date.now(), 1)]);
    setShowEditor(true);
  };

  const openEdit = (pattern: RotationPattern) => {
    setEditing(pattern);
    setName(pattern.name);
    setCode(pattern.code);
    setCycle(pattern.cycle);
    setEffectiveFrom("2026-09-13");
    setSteps(pattern.steps.map((step) => ({ ...step })));
    setShowEditor(true);
  };

  const addStep = () => {
    setSteps((current) => [
      ...current,
      emptyStep(Date.now() + current.length, current.length + 1),
    ]);
  };

  const updateStep = (id: number, field: keyof RotationStep, value: string | boolean) => {
    setSteps((current) =>
      current.map((step) =>
        step.id === id ? { ...step, [field]: value } : step
      )
    );
  };

  const removeStep = (id: number) => {
    setSteps((current) =>
      current
        .filter((step) => step.id !== id)
        .map((step, index) => ({ ...step, order: index + 1 }))
    );
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];

      return next.map((step, position) => ({
        ...step,
        order: position + 1,
      }));
    });
  };

  const savePattern = () => {
    if (!name.trim() || !code.trim() || steps.length === 0) return;

    const normalizedSteps = steps.map((step, index) => ({
      ...step,
      order: index + 1,
    }));

    if (editing) {
      setPatterns((current) =>
        current.map((pattern) =>
          pattern.id === editing.id
            ? {
                ...pattern,
                name: name.trim(),
                code: code.trim(),
                cycle,
                effectiveFrom: new Date(effectiveFrom).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
                steps: normalizedSteps,
              }
            : pattern
        )
      );
      setSelectedId(editing.id);
    } else {
      const id = Date.now();
      setPatterns((current) => [
        ...current,
        {
          id,
          name: name.trim(),
          code: code.trim(),
          cycle,
          status: "ACTIVE",
          employees: 0,
          effectiveFrom: new Date(effectiveFrom).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          steps: normalizedSteps,
        },
      ]);
      setSelectedId(id);
    }

    setShowEditor(false);
  };

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Attendance & Scheduling</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Rotation Patterns
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Define ordered shift sequences that repeat across a rotation cycle.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={17} />
          New Rotation Pattern
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Rotation Patterns</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{patterns.length}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active Patterns</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {patterns.filter((pattern) => pattern.status === "ACTIVE").length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Employees Assigned</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {patterns.reduce((sum, pattern) => sum + pattern.employees, 0)}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patterns..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredPatterns.map((pattern) => (
              <button
                key={pattern.id}
                type="button"
                onClick={() => setSelectedId(pattern.id)}
                className={`w-full p-4 text-left transition ${
                  selectedId === pattern.id ? "bg-slate-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{pattern.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {pattern.code} · {pattern.cycle}
                    </p>
                  </div>
                  <ChevronRight size={17} className="mt-1 text-slate-400" />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{pattern.steps.length} sequence steps</span>
                  <span>{pattern.employees} employees</span>
                </div>
              </button>
            ))}

            {filteredPatterns.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">
                No rotation patterns found.
              </div>
            )}
          </div>
        </div>

        {selectedPattern && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selectedPattern.name}
                    </h2>

                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      {selectedPattern.status}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedPattern.code} · {selectedPattern.cycle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openEdit(selectedPattern)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil size={16} />
                  Edit Pattern
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Effective From</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {selectedPattern.effectiveFrom}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Employees</p>
                  <p className="mt-1 flex items-center gap-2 font-medium text-slate-900">
                    <Users size={15} />
                    {selectedPattern.employees}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Sequence Length</p>
                  <p className="mt-1 flex items-center gap-2 font-medium text-slate-900">
                    <RotateCcw size={15} />
                    {selectedPattern.steps.length} steps
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Rotation Sequence</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    The ordered sequence repeats when the cycle completes.
                  </p>
                </div>
                <CalendarDays size={20} className="text-slate-500" />
              </div>

              <div className="space-y-3">
                {selectedPattern.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="relative rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <div className="flex items-center gap-3 lg:w-28">
                        <GripVertical size={17} className="text-slate-300" />
                        <div>
                          <p className="text-xs text-slate-500">Step</p>
                          <p className="font-semibold text-slate-900">{step.order}</p>
                        </div>
                      </div>

                      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <div>
                          <p className="text-xs text-slate-500">Day</p>
                          <p className="mt-1 font-medium text-slate-900">{step.day}</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">Shift</p>
                          <p className="mt-1 font-medium text-slate-900">{step.shift}</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">Time</p>
                          <p className="mt-1 flex items-center gap-1 font-medium text-slate-900">
                            <Clock3 size={14} />
                            {step.start} - {step.end}
                          </p>
                          {step.crossMidnight && (
                            <p className="mt-1 text-xs text-amber-700">
                              Crosses midnight
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">Location</p>
                          <p className="mt-1 flex items-center gap-1 font-medium text-slate-900">
                            <MapPin size={14} />
                            {step.location}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500">Sequence</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {index === selectedPattern.steps.length - 1
                              ? "Returns to Step 1"
                              : `Then Step ${index + 2}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Rotation behaviour</p>
                <p className="mt-1">
                  Employees follow the sequence in order. When the final step is
                  completed, the pattern starts again from Step 1. Cross-midnight
                  shifts remain explicitly identified.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {showEditor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4">
          <div className="mx-auto my-8 w-full max-w-6xl rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editing ? "Edit Rotation Pattern" : "New Rotation Pattern"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Define the pattern, effective date, and ordered shift sequence.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="text-sm text-slate-500 hover:text-slate-900"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-6 p-5">
              <section>
                <h3 className="font-semibold text-slate-900">Pattern Details</h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Pattern Name
                    </label>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Security 3-Shift Rotation"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Pattern Code
                    </label>
                    <input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="e.g. SEC-3R"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Rotation Cycle
                    </label>
                    <select
                      value={cycle}
                      onChange={(event) => setCycle(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none"
                    >
                      <option>1-week cycle</option>
                      <option>2-week cycle</option>
                      <option>3-week cycle</option>
                      <option>4-week cycle</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Effective From
                    </label>
                    <input
                      type="date"
                      value={effectiveFrom}
                      onChange={(event) => setEffectiveFrom(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Sequence / Timeline</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Arrange the shifts in the exact order employees should follow.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addStep}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Plus size={16} />
                    Add Step
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {steps.map((step, index) => (
                    <div
                      key={step.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              Rotation Step {index + 1}
                            </p>
                            <p className="text-xs text-slate-500">
                              Ordered timeline position
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveStep(index, -1)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                            title="Move up"
                          >
                            <ArrowUp size={16} />
                          </button>

                          <button
                            type="button"
                            disabled={index === steps.length - 1}
                            onClick={() => moveStep(index, 1)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                            title="Move down"
                          >
                            <ArrowDown size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => removeStep(step.id)}
                            disabled={steps.length === 1}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30"
                            title="Remove step"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                        <div>
                          <label className="text-xs font-medium text-slate-600">Day</label>
                          <select
                            value={step.day}
                            onChange={(event) =>
                              updateStep(step.id, "day", event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                              (day) => (
                                <option key={day}>{day}</option>
                              )
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Shift
                          </label>
                          <select
                            value={step.shift}
                            onChange={(event) =>
                              updateStep(step.id, "shift", event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          >
                            <option>Day</option>
                            <option>Morning</option>
                            <option>Evening</option>
                            <option>Night</option>
                            <option>Rotating</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Start
                          </label>
                          <input
                            type="time"
                            value={step.start}
                            onChange={(event) =>
                              updateStep(step.id, "start", event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            End
                          </label>
                          <input
                            type="time"
                            value={step.end}
                            onChange={(event) =>
                              updateStep(step.id, "end", event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Location
                          </label>
                          <input
                            value={step.location}
                            onChange={(event) =>
                              updateStep(step.id, "location", event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>

                        <label className="flex items-center gap-2 self-end rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={step.crossMidnight}
                            onChange={(event) =>
                              updateStep(
                                step.id,
                                "crossMidnight",
                                event.target.checked
                              )
                            }
                          />
                          Crosses midnight
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">Preview</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {steps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-2">
                      <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                        {index + 1}. {step.day} · {step.shift} · {step.start}-{step.end}
                      </span>
                      {index < steps.length - 1 && (
                        <ChevronRight size={15} className="text-slate-400" />
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!name.trim() || !code.trim() || steps.length === 0}
                onClick={savePattern}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Rotation Pattern
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Development mode</p>
        <p className="mt-1">
          Rotation patterns currently use local demo data. Final persistence,
          validation, employee assignment, and effective-date enforcement will
          be controlled by the backend.
        </p>
      </div>
    </main>
  );
}