"use client";

import { useMemo, useState } from "react";
import { Edit3, Plus, Search, Trash2, X } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type PayComponent = {
  id: string;
  code: string;
  name: string;
  type: "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION";
  calculation: "FIXED" | "PERCENTAGE" | "FORMULA";
  taxable: boolean;
  pensionable: boolean;
  status: "ACTIVE" | "INACTIVE";
};

const initialComponents: PayComponent[] = [
  {
    id: "pc-001",
    code: "BASIC",
    name: "Basic Salary",
    type: "EARNING",
    calculation: "FIXED",
    taxable: true,
    pensionable: true,
    status: "ACTIVE",
  },
  {
    id: "pc-002",
    code: "HOUSING",
    name: "Housing Allowance",
    type: "EARNING",
    calculation: "PERCENTAGE",
    taxable: true,
    pensionable: false,
    status: "ACTIVE",
  },
  {
    id: "pc-003",
    code: "TRANSPORT",
    name: "Transport Allowance",
    type: "EARNING",
    calculation: "FIXED",
    taxable: true,
    pensionable: false,
    status: "ACTIVE",
  },
  {
    id: "pc-004",
    code: "PAYE",
    name: "PAYE Tax",
    type: "DEDUCTION",
    calculation: "FORMULA",
    taxable: false,
    pensionable: false,
    status: "ACTIVE",
  },
  {
    id: "pc-005",
    code: "SSNIT",
    name: "SSNIT / Tier 1",
    type: "DEDUCTION",
    calculation: "FORMULA",
    taxable: false,
    pensionable: true,
    status: "ACTIVE",
  },
  {
    id: "pc-006",
    code: "EMPLOYER_SS",
    name: "Employer Social Security",
    type: "EMPLOYER_CONTRIBUTION",
    calculation: "FORMULA",
    taxable: false,
    pensionable: true,
    status: "ACTIVE",
  },
];

const emptyForm = {
  code: "",
  name: "",
  type: "EARNING" as PayComponent["type"],
  calculation: "FIXED" as PayComponent["calculation"],
  taxable: true,
  pensionable: false,
  status: "ACTIVE" as PayComponent["status"],
};

export default function PayComponentsPage() {
  const [components, setComponents] = useState(initialComponents);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PayComponent | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return components.filter((item) => {
      const matchesSearch =
        !query ||
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query);

      const matchesType = typeFilter === "ALL" || item.type === typeFilter;
      const matchesStatus =
        statusFilter === "ALL" || item.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [components, search, typeFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (item: PayComponent) => {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      type: item.type,
      calculation: item.calculation,
      taxable: item.taxable,
      pensionable: item.pensionable,
      status: item.status,
    });
    setShowModal(true);
  };

  const save = () => {
    if (!form.code.trim() || !form.name.trim()) return;

    if (editing) {
      setComponents((items) =>
        items.map((item) =>
          item.id === editing.id ? { ...editing, ...form } : item,
        ),
      );
    } else {
      setComponents((items) => [
        ...items,
        {
          id: `pc-${Date.now()}`,
          ...form,
        },
      ]);
    }

    setShowModal(false);
  };

  const remove = (id: string) => {
    if (!window.confirm("Delete this pay component?")) return;
    setComponents((items) => items.filter((item) => item.id !== id));
  };

  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Pay Components"
        description="Configure earnings, deductions and employer contributions used by payroll."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus size={17} />
            Add Component
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Total Components</p>
          <p className="mt-1 text-2xl font-bold">{components.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-bold">
            {components.filter((x) => x.status === "ACTIVE").length}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Earnings</p>
          <p className="mt-1 text-2xl font-bold">
            {components.filter((x) => x.type === "EARNING").length}
          </p>
        </div>
      </div>

      <section className="rounded-xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code or component name..."
              className="w-full rounded-lg border px-10 py-2.5 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm"
          >
            <option value="ALL">All Types</option>
            <option value="EARNING">Earnings</option>
            <option value="DEDUCTION">Deductions</option>
            <option value="EMPLOYER_CONTRIBUTION">
              Employer Contributions
            </option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No pay components found.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Calculation</th>
                    <th className="px-4 py-3">Taxable</th>
                    <th className="px-4 py-3">Pensionable</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-semibold">{item.code}</td>
                      <td className="px-4 py-4">{item.name}</td>
                      <td className="px-4 py-4">
                        {item.type.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-4">{item.calculation}</td>
                      <td className="px-4 py-4">
                        {item.taxable ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-4">
                        {item.pensionable ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="rounded-lg border p-2 hover:bg-slate-100"
                            title="Edit"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => remove(item.id)}
                            className="rounded-lg border p-2 text-red-600 hover:bg-red-50"
                            title="Delete"
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

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <span>Type: {item.type.replaceAll("_", " ")}</span>
                    <span>Calculation: {item.calculation}</span>
                    <span>Taxable: {item.taxable ? "Yes" : "No"}</span>
                    <span>
                      Pensionable: {item.pensionable ? "Yes" : "No"}
                    </span>
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
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-bold">
                  {editing ? "Edit Pay Component" : "Add Pay Component"}
                </h2>
                <p className="text-sm text-slate-500">
                  Define the component metadata for payroll configuration.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium">Code</span>
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. BASIC"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Component name"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">Type</span>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as PayComponent["type"],
                    })
                  }
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                >
                  <option value="EARNING">Earning</option>
                  <option value="DEDUCTION">Deduction</option>
                  <option value="EMPLOYER_CONTRIBUTION">
                    Employer Contribution
                  </option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">Calculation</span>
                <select
                  value={form.calculation}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      calculation:
                        e.target.value as PayComponent["calculation"],
                    })
                  }
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                >
                  <option value="FIXED">Fixed</option>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FORMULA">Formula</option>
                </select>
              </label>

              <label className="flex items-center gap-2 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={form.taxable}
                  onChange={(e) =>
                    setForm({ ...form, taxable: e.target.checked })
                  }
                />
                <span className="text-sm">Taxable</span>
              </label>

              <label className="flex items-center gap-2 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={form.pensionable}
                  onChange={(e) =>
                    setForm({ ...form, pensionable: e.target.checked })
                  }
                />
                <span className="text-sm">Pensionable</span>
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="text-sm font-medium">Status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as PayComponent["status"],
                    })
                  }
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
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
                disabled={!form.code.trim() || !form.name.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editing ? "Save Changes" : "Create Component"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}