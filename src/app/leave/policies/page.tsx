"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type LeavePolicy = {
  id: string;
  name: string;
  leaveType: string;
  entitlement: number;
  accrual: string;
  carryForward: number;
  minService: number;
  maxConsecutive: number;
  negativeBalance: boolean;
  documentsRequired: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  employmentTypes: string[];
  departments: string[];
  grades: string[];
  genders: string[];
  locations: string[];
  status: "ACTIVE" | "INACTIVE";
};

const initialPolicies: LeavePolicy[] = [
  {
    id: "LP-001",
    name: "Annual Leave Policy",
    leaveType: "Annual Leave",
    entitlement: 20,
    accrual: "Monthly",
    carryForward: 5,
    minService: 3,
    maxConsecutive: 15,
    negativeBalance: false,
    documentsRequired: false,
    effectiveFrom: "2026-01-01",
    employmentTypes: [],
    departments: [],
    grades: [],
    genders: [],
    locations: [],
    status: "ACTIVE",
  },
  {
    id: "LP-002",
    name: "Sick Leave Policy",
    leaveType: "Sick Leave",
    entitlement: 10,
    accrual: "Annual",
    carryForward: 0,
    minService: 0,
    maxConsecutive: 10,
    negativeBalance: false,
    documentsRequired: true,
    effectiveFrom: "2026-01-01",
    employmentTypes: [],
    departments: [],
    grades: [],
    genders: [],
    locations: [],
    status: "ACTIVE",
  },
  {
    id: "LP-003",
    name: "Maternity Leave Policy",
    leaveType: "Maternity Leave",
    entitlement: 84,
    accrual: "Fixed",
    carryForward: 0,
    minService: 6,
    maxConsecutive: 84,
    negativeBalance: false,
    documentsRequired: true,
    effectiveFrom: "2026-01-01",
    employmentTypes: [],
    departments: [],
    grades: [],
    genders: ["Female"],
    locations: [],
    status: "ACTIVE",
  },
];

const emptyForm: Omit<LeavePolicy, "id" | "status"> = {
  name: "",
  leaveType: "",
  entitlement: 0,
  accrual: "Monthly",
  carryForward: 0,
  minService: 0,
  maxConsecutive: 0,
  negativeBalance: false,
  documentsRequired: false,
  effectiveFrom: "",
  effectiveTo: "",
  employmentTypes: [],
  departments: [],
  grades: [],
  genders: [],
  locations: [],
};

const employmentTypeOptions = [
  "Permanent",
  "Contract",
  "Temporary",
  "Intern",
];

const departmentOptions = [
  "Human Resources",
  "Finance",
  "IT",
  "Operations",
];

const gradeOptions = [
  "Junior",
  "Intermediate",
  "Senior",
  "Management",
];

const genderOptions = [
  "Male",
  "Female",
];

const locationOptions = [
  "Head Office",
  "Regional Office",
  "Remote",
];

export default function LeavePoliciesPage() {
  const [policies, setPolicies] = useState(initialPolicies);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);

  const filteredPolicies = useMemo(() => {
    const value = search.toLowerCase().trim();

    return policies.filter((policy) => {
      const matchesSearch =
        !value ||
        policy.name.toLowerCase().includes(value) ||
        policy.leaveType.toLowerCase().includes(value);

      const matchesStatus =
        statusFilter === "All Statuses" ||
        policy.status === statusFilter;

      const matchesType =
        typeFilter === "All Types" ||
        policy.leaveType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [policies, search, statusFilter, typeFilter]);

  const openCreate = () => {
    setEditingPolicy(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (policy: LeavePolicy) => {
    setEditingPolicy(policy);
    setForm({
      name: policy.name,
      leaveType: policy.leaveType,
      entitlement: policy.entitlement,
      accrual: policy.accrual,
      carryForward: policy.carryForward,
      minService: policy.minService,
      maxConsecutive: policy.maxConsecutive,
      negativeBalance: policy.negativeBalance,
      documentsRequired: policy.documentsRequired,
      effectiveFrom: policy.effectiveFrom,
      effectiveTo: policy.effectiveTo || "",
      employmentTypes: policy.employmentTypes,
      departments: policy.departments,
      grades: policy.grades,
      genders: policy.genders,
      locations: policy.locations,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPolicy(null);
    setForm(emptyForm);
  };

  const savePolicy = () => {
    if (!form.name.trim() || !form.leaveType || !form.effectiveFrom) {
      return;
    }

    if (editingPolicy) {
      setPolicies((current) =>
        current.map((policy) =>
          policy.id === editingPolicy.id
            ? {
                ...policy,
                ...form,
              }
            : policy
        )
      );
    } else {
      const newPolicy: LeavePolicy = {
        id: `LP-${String(policies.length + 1).padStart(3, "0")}`,
        ...form,
        status: "ACTIVE",
      };

      setPolicies((current) => [...current, newPolicy]);
    }

    closeModal();
  };

  const toggleSelection = (
    field:
      | "employmentTypes"
      | "departments"
      | "grades"
      | "genders"
      | "locations",
    value: string
  ) => {
    setForm((current) => {
      const values = current[field];

      return {
        ...current,
        [field]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  };

  const eligibilityText = (values: string[]) =>
    values.length === 0 ? "All" : values.join(", ");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Policies"
        description="Configure leave entitlement, accrual rules and employee eligibility."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Policy
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Policies</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {policies.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active Policies</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {policies.filter((policy) => policy.status === "ACTIVE").length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Leave Types</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {new Set(policies.map((policy) => policy.leaveType)).size}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search policies..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option>All Types</option>
            <option>Annual Leave</option>
            <option>Sick Leave</option>
            <option>Maternity Leave</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option>All Statuses</option>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Policy
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Entitlement
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Accrual
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Carry Forward
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Effective From
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredPolicies.map((policy) => (
                <tr
                  key={policy.id}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {policy.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {policy.leaveType}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {policy.entitlement} days
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {policy.accrual}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {policy.carryForward} days
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {policy.effectiveFrom}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={policy.status} />
                  </td>

                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => openEdit(policy)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {filteredPolicies.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      No leave policies found
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your filters or search term.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {filteredPolicies.map((policy) => {
            const expanded = expandedPolicy === policy.id;

            return (
              <div key={policy.id} className="p-4">
                <button
                  onClick={() =>
                    setExpandedPolicy(expanded ? null : policy.id)
                  }
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {policy.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {policy.leaveType}
                    </p>
                  </div>

                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div className="mt-3 flex items-center justify-between">
                  <StatusBadge status={policy.status} />
                  <button
                    onClick={() => openEdit(policy)}
                    className="text-sm font-medium text-slate-700"
                  >
                    Edit
                  </button>
                </div>

                {expanded && (
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Entitlement</p>
                      <p className="font-medium">{policy.entitlement} days</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Accrual</p>
                      <p className="font-medium">{policy.accrual}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Carry Forward</p>
                      <p className="font-medium">{policy.carryForward} days</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Min Service</p>
                      <p className="font-medium">{policy.minService} months</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingPolicy ? "Edit Leave Policy" : "Add Leave Policy"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Configure the policy rules and eligibility.
                </p>
              </div>

              <button
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <section>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Basic Information
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Policy Name
                    </span>
                    <input
                      value={form.name}
                      onChange={(event) =>
                        setForm({ ...form, name: event.target.value })
                      }
                      placeholder="e.g. Annual Leave Policy"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Leave Type
                    </span>
                    <select
                      value={form.leaveType}
                      onChange={(event) =>
                        setForm({ ...form, leaveType: event.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="">Select leave type</option>
                      <option>Annual Leave</option>
                      <option>Sick Leave</option>
                      <option>Maternity Leave</option>
                      <option>Personal Leave</option>
                    </select>
                  </label>
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Entitlement & Accrual
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Entitlement (days)
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={form.entitlement}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          entitlement: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Accrual
                    </span>
                    <select
                      value={form.accrual}
                      onChange={(event) =>
                        setForm({ ...form, accrual: event.target.value })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    >
                      <option>Monthly</option>
                      <option>Annual</option>
                      <option>Fixed</option>
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Carry Forward (days)
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={form.carryForward}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          carryForward: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Max Consecutive Days
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={form.maxConsecutive}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          maxConsecutive: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Service & Requirements
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Minimum Service (months)
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={form.minService}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          minService: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>

                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <input
                      type="checkbox"
                      checked={form.negativeBalance}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          negativeBalance: event.target.checked,
                        })
                      }
                      className="h-4 w-4"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-700">
                        Negative balance
                      </span>
                      <span className="block text-xs text-slate-500">
                        Allow leave beyond available balance.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <input
                      type="checkbox"
                      checked={form.documentsRequired}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          documentsRequired: event.target.checked,
                        })
                      }
                      className="h-4 w-4"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-700">
                        Documents required
                      </span>
                      <span className="block text-xs text-slate-500">
                        Require supporting documents.
                      </span>
                    </span>
                  </label>
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Effective Dates
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Effective From
                    </span>
                    <input
                      type="date"
                      value={form.effectiveFrom}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          effectiveFrom: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Effective To
                    </span>
                    <input
                      type="date"
                      value={form.effectiveTo}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          effectiveTo: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-sm font-semibold text-slate-900">
                  Eligibility
                </h3>
                <p className="mb-4 text-xs text-slate-500">
                  Leaving a dimension unselected means the policy applies to
                  everyone in that dimension.
                </p>

                <div className="grid gap-5 md:grid-cols-2">
                  <MultiSelectGroup
                    title="Employment Types"
                    values={form.employmentTypes}
                    options={employmentTypeOptions}
                    onToggle={(value) =>
                      toggleSelection("employmentTypes", value)
                    }
                    allText={eligibilityText(form.employmentTypes)}
                  />

                  <MultiSelectGroup
                    title="Departments"
                    values={form.departments}
                    options={departmentOptions}
                    onToggle={(value) =>
                      toggleSelection("departments", value)
                    }
                    allText={eligibilityText(form.departments)}
                  />

                  <MultiSelectGroup
                    title="Grades"
                    values={form.grades}
                    options={gradeOptions}
                    onToggle={(value) => toggleSelection("grades", value)}
                    allText={eligibilityText(form.grades)}
                  />

                  <MultiSelectGroup
                    title="Genders"
                    values={form.genders}
                    options={genderOptions}
                    onToggle={(value) => toggleSelection("genders", value)}
                    allText={eligibilityText(form.genders)}
                  />

                  <MultiSelectGroup
                    title="Locations"
                    values={form.locations}
                    options={locationOptions}
                    onToggle={(value) =>
                      toggleSelection("locations", value)
                    }
                    allText={eligibilityText(form.locations)}
                  />
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                onClick={savePolicy}
                disabled={
                  !form.name.trim() ||
                  !form.leaveType ||
                  !form.effectiveFrom
                }
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {editingPolicy ? "Save Changes" : "Create Policy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MultiSelectGroup({
  title,
  values,
  options,
  onToggle,
  allText,
}: {
  title: string;
  values: string[];
  options: string[];
  onToggle: (value: string) => void;
  allText: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <span className="text-xs text-slate-400">{allText}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option);

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
