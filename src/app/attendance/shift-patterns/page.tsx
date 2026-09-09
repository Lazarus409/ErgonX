"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  Edit3,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type Pattern = {
  id: string;
  name: string;
  code: string;
  type: string;
  cycleLength: number;
  assignedEmployees: number;
  status: string;
  description: string;
  days: {
    day: number;
    label: string;
    shift: string;
  }[];
};

const initialPatterns: Pattern[] = [
  {
    id: "pattern-001",
    name: "Standard 5-Day Pattern",
    code: "SP-001",
    type: "WEEKLY",
    cycleLength: 5,
    assignedEmployees: 28,
    status: "ACTIVE",
    description: "Standard Monday to Friday working pattern.",
    days: [
      { day: 1, label: "Day 1", shift: "Morning Shift" },
      { day: 2, label: "Day 2", shift: "Morning Shift" },
      { day: 3, label: "Day 3", shift: "Morning Shift" },
      { day: 4, label: "Day 4", shift: "Morning Shift" },
      { day: 5, label: "Day 5", shift: "Morning Shift" },
    ],
  },
  {
    id: "pattern-002",
    name: "Day/Night Alternating",
    code: "SP-002",
    type: "ALTERNATING",
    cycleLength: 4,
    assignedEmployees: 16,
    status: "ACTIVE",
    description: "Employees alternate between day and night shifts.",
    days: [
      { day: 1, label: "Day 1", shift: "Morning Shift" },
      { day: 2, label: "Day 2", shift: "Morning Shift" },
      { day: 3, label: "Day 3", shift: "Night Shift" },
      { day: 4, label: "Day 4", shift: "Night Shift" },
    ],
  },
  {
    id: "pattern-003",
    name: "Support Team Pattern",
    code: "SP-003",
    type: "WEEKLY",
    cycleLength: 7,
    assignedEmployees: 11,
    status: "ACTIVE",
    description: "Seven-day operational support pattern.",
    days: [
      { day: 1, label: "Day 1", shift: "Morning Shift" },
      { day: 2, label: "Day 2", shift: "Morning Shift" },
      { day: 3, label: "Day 3", shift: "Morning Shift" },
      { day: 4, label: "Day 4", shift: "Evening Shift" },
      { day: 5, label: "Day 5", shift: "Evening Shift" },
      { day: 6, label: "Day 6", shift: "Off" },
      { day: 7, label: "Day 7", shift: "Off" },
    ],
  },
  {
    id: "pattern-004",
    name: "Legacy Night Pattern",
    code: "SP-004",
    type: "WEEKLY",
    cycleLength: 7,
    assignedEmployees: 0,
    status: "INACTIVE",
    description: "Previously used night operations pattern.",
    days: [
      { day: 1, label: "Day 1", shift: "Night Shift" },
      { day: 2, label: "Day 2", shift: "Night Shift" },
      { day: 3, label: "Day 3", shift: "Night Shift" },
      { day: 4, label: "Day 4", shift: "Off" },
      { day: 5, label: "Day 5", shift: "Off" },
      { day: 6, label: "Day 6", shift: "Night Shift" },
      { day: 7, label: "Day 7", shift: "Night Shift" },
    ],
  },
];

export default function ShiftPatternsPage() {
  const [patterns, setPatterns] = useState(initialPatterns);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "WEEKLY",
    cycleLength: "5",
    description: "",
  });

  const filteredPatterns = useMemo(() => {
    return patterns.filter((pattern) => {
      const query = search.toLowerCase().trim();

      const matchesSearch =
        !query ||
        pattern.name.toLowerCase().includes(query) ||
        pattern.code.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" || pattern.status === statusFilter;

      const matchesType =
        typeFilter === "ALL" || pattern.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [patterns, search, statusFilter, typeFilter]);

  function openCreate() {
    setEditingPattern(null);
    setForm({
      name: "",
      code: "",
      type: "WEEKLY",
      cycleLength: "5",
      description: "",
    });
    setShowModal(true);
  }

  function openEdit(pattern: Pattern) {
    setEditingPattern(pattern);
    setForm({
      name: pattern.name,
      code: pattern.code,
      type: pattern.type,
      cycleLength: String(pattern.cycleLength),
      description: pattern.description,
    });
    setShowModal(true);
  }

  function savePattern(event: React.FormEvent) {
    event.preventDefault();

    if (!form.name.trim() || !form.code.trim()) return;

    if (editingPattern) {
      setPatterns((current) =>
        current.map((pattern) =>
          pattern.id === editingPattern.id
            ? {
                ...pattern,
                name: form.name,
                code: form.code,
                type: form.type,
                cycleLength: Number(form.cycleLength),
                description: form.description,
              }
            : pattern
        )
      );
    } else {
      const cycleLength = Number(form.cycleLength);

      const newPattern: Pattern = {
        id: `pattern-${Date.now()}`,
        name: form.name,
        code: form.code,
        type: form.type,
        cycleLength,
        assignedEmployees: 0,
        status: "ACTIVE",
        description: form.description,
        days: Array.from({ length: cycleLength }, (_, index) => ({
          day: index + 1,
          label: `Day ${index + 1}`,
          shift: "Off",
        })),
      };

      setPatterns((current) => [newPattern, ...current]);
    }

    setShowModal(false);
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Shift Patterns"
        description="Create and manage recurring sequences of shifts and rest days."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Pattern
          </button>
        }
      />

      {/* Summary */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Total Patterns"
          value={String(patterns.length)}
          detail="Configured patterns"
        />

        <SummaryCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Active Patterns"
          value={String(
            patterns.filter((pattern) => pattern.status === "ACTIVE").length
          )}
          detail="Currently available"
        />

        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="Assigned Employees"
          value={String(
            patterns.reduce(
              (total, pattern) => total + pattern.assignedEmployees,
              0
            )
          )}
          detail="Across active patterns"
        />

        <SummaryCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Pattern Days"
          value={String(
            patterns.reduce(
              (total, pattern) => total + pattern.cycleLength,
              0
            )
          )}
          detail="Configured cycle days"
        />
      </section>

      {/* Filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search pattern name or code..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="WEEKLY">Weekly</option>
            <option value="ALTERNATING">Alternating</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </section>

      {/* Desktop table */}
      <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pattern
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cycle
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pattern Days
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Employees
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredPatterns.map((pattern) => (
                <tr key={pattern.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-medium text-slate-900">
                        {pattern.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {pattern.code}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {formatType(pattern.type)}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {pattern.cycleLength} days
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {pattern.days.slice(0, 5).map((day) => (
                        <span
                          key={day.day}
                          className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
                        >
                          {day.shift}
                        </span>
                      ))}

                      {pattern.days.length > 5 && (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500">
                          +{pattern.days.length - 5}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {pattern.assignedEmployees}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={pattern.status} />
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/attendance/shift-patterns/${pattern.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </Link>

                      <button
                        type="button"
                        onClick={() => openEdit(pattern)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                        title="Edit pattern"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredPatterns.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 font-medium text-slate-900">
                      No shift patterns found
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mobile cards */}
      <section className="space-y-3 lg:hidden">
        {filteredPatterns.map((pattern) => (
          <div
            key={pattern.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {pattern.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {pattern.code}
                </p>
              </div>

              <StatusBadge status={pattern.status} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Info label="Type" value={formatType(pattern.type)} />
              <Info
                label="Cycle"
                value={`${pattern.cycleLength} days`}
              />
              <Info
                label="Employees"
                value={String(pattern.assignedEmployees)}
              />
              <Info
                label="Pattern Days"
                value={String(pattern.days.length)}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                href={`/attendance/shift-patterns/${pattern.id}`}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700"
              >
                View
              </Link>

              <button
                type="button"
                onClick={() => openEdit(pattern)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredPatterns.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 font-medium text-slate-900">
              No shift patterns found
            </p>
          </div>
        )}
      </section>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {editingPattern ? "Edit Shift Pattern" : "Add Shift Pattern"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Configure the basic pattern definition.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={savePattern} className="space-y-5 p-5">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Pattern Name
                </label>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. Standard 5-Day Pattern"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Pattern Code
                </label>
                <input
                  value={form.code}
                  onChange={(event) =>
                    setForm({ ...form, code: event.target.value })
                  }
                  placeholder="e.g. SP-005"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Pattern Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm({ ...form, type: event.target.value })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="ALTERNATING">Alternating</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Cycle Length
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.cycleLength}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        cycleLength: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Describe how this pattern is used."
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {editingPattern ? "Save Changes" : "Create Pattern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Pattern configuration
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Pattern days determine the sequence of shifts and rest days.
              Detailed assignments and authoritative scheduling calculations
              will be handled by the backend when the scheduling API is
              connected.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
          {icon}
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>

      <p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function formatType(type: string) {
  return type
    .toLowerCase()
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}