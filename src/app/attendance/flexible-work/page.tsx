"use client";

import { useMemo, useState } from "react";
import {
  Clock3,
  Edit3,
  Plus,
  CalendarDays,
  Search,
  X,
} from "lucide-react";

type FlexibleRule = {
  id: number;
  name: string;
  code: string;
  earliestStart: string;
  latestStart: string;
  earliestEnd: string;
  latestEnd: string;
  requiredMinutes: number;
  coreStart?: string;
  coreEnd?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  employees: number;
  status: "ACTIVE" | "INACTIVE";
};

const initialRules: FlexibleRule[] = [
  {
    id: 1,
    name: "Standard Flexible Work",
    code: "FLEX-STD",
    earliestStart: "07:00",
    latestStart: "10:00",
    earliestEnd: "15:00",
    latestEnd: "19:00",
    requiredMinutes: 480,
    coreStart: "10:00",
    coreEnd: "15:00",
    effectiveFrom: "01 Jan 2026",
    employees: 18,
    status: "ACTIVE",
  },
  {
    id: 2,
    name: "Management Flexible Rule",
    code: "FLEX-MGT",
    earliestStart: "07:30",
    latestStart: "09:30",
    earliestEnd: "16:00",
    latestEnd: "18:30",
    requiredMinutes: 450,
    coreStart: "09:30",
    coreEnd: "16:00",
    effectiveFrom: "01 Mar 2026",
    employees: 7,
    status: "ACTIVE",
  },
];

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}h ${mins}m`;
};

export default function FlexibleWorkPage() {
  const [rules, setRules] = useState(initialRules);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<FlexibleRule | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [earliestStart, setEarliestStart] = useState("07:00");
  const [latestStart, setLatestStart] = useState("10:00");
  const [earliestEnd, setEarliestEnd] = useState("15:00");
  const [latestEnd, setLatestEnd] = useState("19:00");
  const [requiredHours, setRequiredHours] = useState("8");
  const [requiredMinutes, setRequiredMinutes] = useState("0");
  const [hasCoreHours, setHasCoreHours] = useState(true);
  const [coreStart, setCoreStart] = useState("10:00");
  const [coreEnd, setCoreEnd] = useState("15:00");
  const [effectiveFrom, setEffectiveFrom] = useState("2026-09-13");
  const [effectiveTo, setEffectiveTo] = useState("");

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      const matchesSearch =
        !search ||
        `${rule.name} ${rule.code}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesStatus =
        status === "ALL" || rule.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [rules, search, status]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setCode("");
    setEarliestStart("07:00");
    setLatestStart("10:00");
    setEarliestEnd("15:00");
    setLatestEnd("19:00");
    setRequiredHours("8");
    setRequiredMinutes("0");
    setHasCoreHours(true);
    setCoreStart("10:00");
    setCoreEnd("15:00");
    setEffectiveFrom("2026-09-13");
    setEffectiveTo("");
    setShowEditor(true);
  };

  const openEdit = (rule: FlexibleRule) => {
    setEditing(rule);
    setName(rule.name);
    setCode(rule.code);
    setEarliestStart(rule.earliestStart);
    setLatestStart(rule.latestStart);
    setEarliestEnd(rule.earliestEnd);
    setLatestEnd(rule.latestEnd);

    setRequiredHours(String(Math.floor(rule.requiredMinutes / 60)));
    setRequiredMinutes(String(rule.requiredMinutes % 60));

    setHasCoreHours(Boolean(rule.coreStart && rule.coreEnd));
    setCoreStart(rule.coreStart ?? "10:00");
    setCoreEnd(rule.coreEnd ?? "15:00");

    setEffectiveFrom("2026-09-13");
    setEffectiveTo("");
    setShowEditor(true);
  };

  const saveRule = () => {
    if (!name.trim() || !code.trim()) return;

    const totalMinutes =
      Number(requiredHours || 0) * 60 +
      Number(requiredMinutes || 0);

    if (totalMinutes <= 0) return;

    const formattedEffectiveFrom = new Date(
      effectiveFrom
    ).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const formattedEffectiveTo = effectiveTo
      ? new Date(effectiveTo).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : undefined;

    if (editing) {
      setRules((current) =>
        current.map((rule) =>
          rule.id === editing.id
            ? {
                ...rule,
                name: name.trim(),
                code: code.trim(),
                earliestStart,
                latestStart,
                earliestEnd,
                latestEnd,
                requiredMinutes: totalMinutes,
                coreStart: hasCoreHours ? coreStart : undefined,
                coreEnd: hasCoreHours ? coreEnd : undefined,
                effectiveFrom: formattedEffectiveFrom,
                effectiveTo: formattedEffectiveTo,
              }
            : rule
        )
      );
    } else {
      setRules((current) => [
        ...current,
        {
          id: Date.now(),
          name: name.trim(),
          code: code.trim(),
          earliestStart,
          latestStart,
          earliestEnd,
          latestEnd,
          requiredMinutes: totalMinutes,
          coreStart: hasCoreHours ? coreStart : undefined,
          coreEnd: hasCoreHours ? coreEnd : undefined,
          effectiveFrom: formattedEffectiveFrom,
          effectiveTo: formattedEffectiveTo,
          employees: 0,
          status: "ACTIVE",
        },
      ]);
    }

    setShowEditor(false);
  };

  return (
    <main className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Attendance & Scheduling
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Flexible Work
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Configure flexible working windows while defining required working
            time and optional core hours.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus size={17} />
          New Flexible Rule
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Flexible Rules</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {rules.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active Rules</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {rules.filter((rule) => rule.status === "ACTIVE").length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Employees Assigned</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {rules.reduce((sum, rule) => sum + rule.employees, 0)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search flexible work rules..."
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Rule</th>
                <th className="px-5 py-3 font-medium">Start Window</th>
                <th className="px-5 py-3 font-medium">End Window</th>
                <th className="px-5 py-3 font-medium">Required Time</th>
                <th className="px-5 py-3 font-medium">Core Hours</th>
                <th className="px-5 py-3 font-medium">Employees</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{rule.name}</p>
                    <p className="text-xs text-slate-500">{rule.code}</p>
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {rule.earliestStart} - {rule.latestStart}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {rule.earliestEnd} - {rule.latestEnd}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {formatMinutes(rule.requiredMinutes)}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {rule.coreStart && rule.coreEnd
                      ? `${rule.coreStart} - ${rule.coreEnd}`
                      : "Not configured"}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {rule.employees}
                  </td>

                  <td className="px-5 py-4">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      {rule.status}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => openEdit(rule)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {filteredRules.map((rule) => (
            <div key={rule.id} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{rule.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{rule.code}</p>
                </div>

                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {rule.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Start Window</p>
                  <p className="mt-1 text-slate-700">
                    {rule.earliestStart} - {rule.latestStart}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">End Window</p>
                  <p className="mt-1 text-slate-700">
                    {rule.earliestEnd} - {rule.latestEnd}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Required Time</p>
                  <p className="mt-1 text-slate-700">
                    {formatMinutes(rule.requiredMinutes)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Employees</p>
                  <p className="mt-1 text-slate-700">{rule.employees}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openEdit(rule)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              >
                <Edit3 size={15} />
                Edit Rule
              </button>
            </div>
          ))}
        </div>
      </section>

      {showEditor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4">
          <div className="mx-auto my-8 w-full max-w-4xl rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editing ? "Edit Flexible Work Rule" : "New Flexible Work Rule"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Configure the permitted work windows and required working time.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <section>
                <h3 className="font-semibold text-slate-900">
                  Rule Details
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Rule Name
                    </label>

                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Standard Flexible Work"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Rule Code
                    </label>

                    <input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="e.g. FLEX-STD"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
                    />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <Clock3 size={18} className="text-slate-600" />

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Flexible Time Windows
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Define the earliest and latest permitted start and end times.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Earliest Start
                    </label>
                    <input
                      type="time"
                      value={earliestStart}
                      onChange={(event) => setEarliestStart(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Latest Start
                    </label>
                    <input
                      type="time"
                      value={latestStart}
                      onChange={(event) => setLatestStart(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Earliest End
                    </label>
                    <input
                      type="time"
                      value={earliestEnd}
                      onChange={(event) => setEarliestEnd(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Latest End
                    </label>
                    <input
                      type="time"
                      value={latestEnd}
                      onChange={(event) => setLatestEnd(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-slate-900">
                  Required Working Time
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Required Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={requiredHours}
                      onChange={(event) => setRequiredHours(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Additional Minutes
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={requiredMinutes}
                      onChange={(event) => setRequiredMinutes(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <input
                    id="core-hours"
                    type="checkbox"
                    checked={hasCoreHours}
                    onChange={(event) => setHasCoreHours(event.target.checked)}
                    className="mt-1"
                  />

                  <div>
                    <label
                      htmlFor="core-hours"
                      className="font-semibold text-slate-900"
                    >
                      Enable Core Hours
                    </label>

                    <p className="mt-1 text-sm text-slate-500">
                      Optional period when employees are expected to be available.
                    </p>
                  </div>
                </div>

                {hasCoreHours && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Core Start
                      </label>

                      <input
                        type="time"
                        value={coreStart}
                        onChange={(event) => setCoreStart(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Core End
                      </label>

                      <input
                        type="time"
                        value={coreEnd}
                        onChange={(event) => setCoreEnd(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <CalendarDays size={18} className="text-slate-600" />

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Effective Dates
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Define when this flexible work rule applies.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Effective From
                    </label>

                    <input
                      type="date"
                      value={effectiveFrom}
                      onChange={(event) => setEffectiveFrom(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">
                      Effective To
                    </label>

                    <input
                      type="date"
                      value={effectiveTo}
                      onChange={(event) => setEffectiveTo(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />

                    <p className="mt-1 text-xs text-slate-500">
                      Leave blank when there is no configured end date.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">Rule Preview</p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-500">Start Window</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {earliestStart} - {latestStart}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">End Window</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {earliestEnd} - {latestEnd}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Required Time</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatMinutes(
                        Number(requiredHours || 0) * 60 +
                          Number(requiredMinutes || 0)
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Core Hours</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {hasCoreHours
                        ? `${coreStart} - ${coreEnd}`
                        : "Not configured"}
                    </p>
                  </div>
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
                disabled={
                  !name.trim() ||
                  !code.trim() ||
                  Number(requiredHours || 0) * 60 +
                    Number(requiredMinutes || 0) <=
                    0
                }
                onClick={saveRule}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Flexible Rule
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Development mode</p>
        <p className="mt-1">
          Flexible work rules currently use local demo data. Final persistence,
          validation, employee assignment, schedule evaluation, and attendance
          calculations will be controlled by the backend.
        </p>
      </div>
    </main>
  );
}