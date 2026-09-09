"use client";

import { useMemo, useState } from "react";
import { Edit3, Link2, Plus, Search, Trash2, X } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type Component = {
  id: string;
  code: string;
  name: string;
  type: "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION";
};

type SalaryStructure = {
  id: string;
  code: string;
  name: string;
  description: string;
  frequency: "MONTHLY" | "WEEKLY" | "BIWEEKLY";
  components: string[];
  status: "ACTIVE" | "INACTIVE";
  employees: number;
};

const components: Component[] = [
  { id: "pc-001", code: "BASIC", name: "Basic Salary", type: "EARNING" },
  { id: "pc-002", code: "HOUSING", name: "Housing Allowance", type: "EARNING" },
  {
    id: "pc-003",
    code: "TRANSPORT",
    name: "Transport Allowance",
    type: "EARNING",
  },
  { id: "pc-004", code: "PAYE", name: "PAYE Tax", type: "DEDUCTION" },
  { id: "pc-005", code: "SSNIT", name: "SSNIT / Tier 1", type: "DEDUCTION" },
];

const initialStructures: SalaryStructure[] = [
  {
    id: "ss-001",
    code: "STANDARD",
    name: "Standard Monthly",
    description: "Standard monthly employee salary structure.",
    frequency: "MONTHLY",
    components: ["pc-001", "pc-002", "pc-003", "pc-004", "pc-005"],
    status: "ACTIVE",
    employees: 86,
  },
  {
    id: "ss-002",
    code: "MANAGEMENT",
    name: "Management Monthly",
    description: "Salary structure for management employees.",
    frequency: "MONTHLY",
    components: ["pc-001", "pc-002", "pc-004", "pc-005"],
    status: "ACTIVE",
    employees: 14,
  },
  {
    id: "ss-003",
    code: "WEEKLY",
    name: "Weekly Payroll",
    description: "Weekly payroll structure.",
    frequency: "WEEKLY",
    components: ["pc-001", "pc-004"],
    status: "INACTIVE",
    employees: 0,
  },
];

const emptyForm = {
  code: "",
  name: "",
  description: "",
  frequency: "MONTHLY" as SalaryStructure["frequency"],
  components: [] as string[],
  status: "ACTIVE" as SalaryStructure["status"],
};

export default function SalaryStructuresPage() {
  const [structures, setStructures] = useState(initialStructures);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SalaryStructure | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return structures.filter((item) => {
      const matchesSearch =
        !query ||
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query);

      const matchesStatus = status === "ALL" || item.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [structures, search, status]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (item: SalaryStructure) => {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description,
      frequency: item.frequency,
      components: item.components,
      status: item.status,
    });
    setShowModal(true);
  };

  const toggleComponent = (id: string) => {
    setForm((current) => ({
      ...current,
      components: current.components.includes(id)
        ? current.components.filter((item) => item !== id)
        : [...current.components, id],
    }));
  };

  const save = () => {
    if (!form.code.trim() || !form.name.trim() || !form.components.length)
      return;

    if (editing) {
      setStructures((items) =>
        items.map((item) =>
          item.id === editing.id ? { ...editing, ...form } : item,
        ),
      );
    } else {
      setStructures((items) => [
        ...items,
        {
          id: `ss-${Date.now()}`,
          ...form,
          employees: 0,
        },
      ]);
    }

    setShowModal(false);
  };

  const remove = (id: string) => {
    const structure = structures.find((item) => item.id === id);

    if (structure?.employees) {
      window.alert(
        "This salary structure is assigned to employees and cannot be deleted in this demo.",
      );
      return;
    }

    if (!window.confirm("Delete this salary structure?")) return;

    setStructures((items) => items.filter((item) => item.id !== id));
  };

  const getComponent = (id: string) =>
    components.find((item) => item.id === id);

  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Salary Structures"
        description="Define reusable salary structures and associate approved pay components."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus size={17} />
            Add Structure
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Total Structures</p>
          <p className="mt-1 text-2xl font-bold">{structures.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-bold">
            {structures.filter((x) => x.status === "ACTIVE").length}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Employees Assigned</p>
          <p className="mt-1 text-2xl font-bold">
            {structures.reduce((sum, item) => sum + item.employees, 0)}
          </p>
        </div>
      </div>

      <section className="rounded-xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search salary structures..."
              className="w-full rounded-lg border px-10 py-2.5 text-sm outline-none"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No salary structures found.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Structure</th>
                    <th className="px-4 py-3">Frequency</th>
                    <th className="px-4 py-3">Components</th>
                    <th className="px-4 py-3">Employees</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-semibold">{item.code}</td>
                      <td className="px-4 py-4">
                        <p className="font-medium">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.description}
                        </p>
                      </td>
                      <td className="px-4 py-4">{item.frequency}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {item.components.slice(0, 3).map((id) => (
                            <span
                              key={id}
                              className="rounded bg-slate-100 px-2 py-1 text-xs"
                            >
                              {getComponent(id)?.code}
                            </span>
                          ))}
                          {item.components.length > 3 && (
                            <span className="rounded bg-slate-100 px-2 py-1 text-xs">
                              +{item.components.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">{item.employees}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="rounded-lg border p-2 hover:bg-slate-100"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => remove(item.id)}
                            className="rounded-lg border p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y md:hidden">
              {filtered.map((item) => (
                <div key={item.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.code}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>

                  <p className="text-sm text-slate-600">
                    {item.description}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {item.components.map((id) => (
                      <span
                        key={id}
                        className="rounded bg-slate-100 px-2 py-1 text-xs"
                      >
                        {getComponent(id)?.code}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs text-slate-500">
                    {item.frequency} · {item.employees} employees
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(item)}
                      className="flex-1 rounded-lg border px-3 py-2 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(item.id)}
                      className="rounded-lg border px-3 py-2 text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-bold">
                  {editing ? "Edit Salary Structure" : "Add Salary Structure"}
                </h2>
                <p className="text-sm text-slate-500">
                  Associate reusable pay components with the structure.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Code</span>
                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. STANDARD"
                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Name</span>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="Salary structure name"
                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Frequency</span>
                  <select
                    value={form.frequency}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        frequency:
                          e.target.value as SalaryStructure["frequency"],
                      })
                    }
                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Biweekly</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as SalaryStructure["status"],
                      })
                    }
                    className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-sm font-medium">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                  placeholder="Describe the purpose of this structure..."
                />
              </label>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Link2 size={17} />
                  <h3 className="font-semibold">Associated Components</h3>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {components.map((component) => {
                    const selected = form.components.includes(component.id);

                    return (
                      <label
                        key={component.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                          selected ? "border-slate-900 bg-slate-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleComponent(component.id)}
                        />
                        <div>
                          <p className="text-sm font-medium">
                            {component.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {component.code} ·{" "}
                            {component.type.replaceAll("_", " ")}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {!form.components.length && (
                  <p className="mt-2 text-xs text-red-600">
                    Select at least one pay component.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t p-5">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={
                  !form.code.trim() ||
                  !form.name.trim() ||
                  form.components.length === 0
                }
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editing ? "Save Changes" : "Create Structure"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}