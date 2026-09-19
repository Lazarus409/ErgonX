"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import ErrorState from "@/components/ui/ErrorState";
import {
  getApiErrorMessage,
  leaveApi,
  organizationApi,
} from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { Department, Grade, Location } from "@/types/hr";
import { EMPLOYMENT_TYPES } from "@/types/hr";
import { ACCRUAL_METHODS } from "@/types/leave";
import type { LeavePolicy, LeavePolicyPayload, LeaveType } from "@/types/leave";
import { formatDate, formatNumber, humanizeEnum } from "@/lib/format";

const ALL_TYPES = "ALL_TYPES";
const ALL_STATUSES = "ALL_STATUSES";

const GENDERS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"];

interface Option {
  value: string;
  label: string;
}

interface PolicyForm {
  name: string;
  leaveType: string;
  entitlement: number;
  accrualMethod: string;
  accrualRate: number;
  carryForward: number;
  minServiceDays: number;
  maxConsecutive: string;
  negativeBalance: boolean;
  documentsRequired: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
  employmentTypes: string[];
  departments: string[];
  grades: string[];
  genders: string[];
  locations: string[];
}

const emptyForm: PolicyForm = {
  name: "",
  leaveType: "",
  entitlement: 0,
  accrualMethod: "NONE",
  accrualRate: 0,
  carryForward: 0,
  minServiceDays: 0,
  maxConsecutive: "",
  negativeBalance: false,
  documentsRequired: false,
  effectiveFrom: "",
  effectiveTo: "",
  isActive: true,
  employmentTypes: [],
  departments: [],
  grades: [],
  genders: [],
  locations: [],
};

interface Reference {
  leaveTypes: LeaveType[];
  departments: Department[];
  grades: Grade[];
  locations: Location[];
}

const emptyReference: Reference = {
  leaveTypes: [],
  departments: [],
  grades: [],
  locations: [],
};

export default function LeavePoliciesPage() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [reference, setReference] = useState<Reference>(emptyReference);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);
  const [form, setForm] = useState<PolicyForm>(emptyForm);
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [policyPage, types, departments, grades, locations] =
          await Promise.all([
            leaveApi.listLeavePolicies({
              page_size: MAX_PAGE_SIZE,
              ordering: "name",
            }),
            leaveApi.listLeaveTypes({
              page_size: MAX_PAGE_SIZE,
              ordering: "name",
            }),
            organizationApi.listDepartments({
              page_size: MAX_PAGE_SIZE,
              ordering: "name",
            }),
            organizationApi.listGrades({
              page_size: MAX_PAGE_SIZE,
              ordering: "name",
            }),
            organizationApi.listLocations({
              page_size: MAX_PAGE_SIZE,
              ordering: "name",
            }),
          ]);

        if (!active) {
          return;
        }

        setPolicies(policyPage.results);
        setReference({
          leaveTypes: types.results,
          departments: departments.results,
          grades: grades.results,
          locations: locations.results,
        });
      } catch (caught) {
        if (active) {
          setError(getApiErrorMessage(caught));
          setPolicies([]);
          setReference(emptyReference);
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

  const leaveTypeNames = useMemo(
    () => new Map(reference.leaveTypes.map((type) => [type.id, type.name])),
    [reference.leaveTypes],
  );

  const filteredPolicies = useMemo(() => {
    const value = search.toLowerCase().trim();

    return policies.filter((policy) => {
      const typeName = leaveTypeNames.get(policy.leave_type) ?? "";

      const matchesSearch =
        !value ||
        policy.name.toLowerCase().includes(value) ||
        typeName.toLowerCase().includes(value);

      const matchesStatus =
        statusFilter === ALL_STATUSES ||
        (statusFilter === "ACTIVE" ? policy.is_active : !policy.is_active);

      const matchesType =
        typeFilter === ALL_TYPES || policy.leave_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [policies, search, statusFilter, typeFilter, leaveTypeNames]);

  const openCreate = () => {
    setEditingPolicy(null);
    setFormError("");
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (policy: LeavePolicy) => {
    setEditingPolicy(policy);
    setFormError("");
    setForm({
      name: policy.name,
      leaveType: policy.leave_type,
      entitlement: Number(policy.annual_entitlement),
      accrualMethod: policy.accrual_method,
      accrualRate: Number(policy.accrual_rate),
      carryForward: Number(policy.max_carry_forward),
      minServiceDays: policy.min_service_days,
      maxConsecutive:
        policy.max_consecutive_days === null
          ? ""
          : String(Number(policy.max_consecutive_days)),
      negativeBalance: policy.allow_negative_balance,
      documentsRequired: policy.requires_document,
      effectiveFrom: policy.effective_from,
      effectiveTo: policy.effective_to ?? "",
      isActive: policy.is_active,
      // Employment-type and gender eligibility are not returned by the API,
      // so an edit starts from an empty selection for those two dimensions.
      employmentTypes: policy.eligible_employment_types ?? [],
      departments: policy.eligible_department_ids ?? [],
      grades: policy.eligible_grade_ids ?? [],
      genders: policy.eligible_genders ?? [],
      locations: policy.eligible_location_ids ?? [],
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPolicy(null);
    setForm(emptyForm);
    setFormError("");
  };

  const savePolicy = useCallback(async () => {
    if (!form.name.trim() || !form.leaveType || !form.effectiveFrom) {
      setFormError("Policy name, leave type and effective-from are required.");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload: LeavePolicyPayload = {
      leave_type: form.leaveType,
      name: form.name.trim(),
      annual_entitlement: form.entitlement,
      accrual_method: form.accrualMethod,
      accrual_rate: form.accrualRate,
      max_carry_forward: form.carryForward,
      min_service_days: form.minServiceDays,
      max_consecutive_days:
        form.maxConsecutive === "" ? null : Number(form.maxConsecutive),
      allow_negative_balance: form.negativeBalance,
      requires_document: form.documentsRequired,
      effective_from: form.effectiveFrom,
      effective_to: form.effectiveTo || null,
      is_active: form.isActive,
      eligible_department_ids: form.departments,
      eligible_grade_ids: form.grades,
      eligible_location_ids: form.locations,
      eligible_employment_types: form.employmentTypes,
      eligible_genders: form.genders,
    };

    try {
      if (editingPolicy) {
        await leaveApi.updateLeavePolicy(editingPolicy.id, payload);
      } else {
        await leaveApi.createLeavePolicy(payload);
      }

      closeModal();
      reload();
    } catch (caught) {
      setFormError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }, [form, editingPolicy, reload]);

  const toggleSelection = (
    field:
      | "employmentTypes"
      | "departments"
      | "grades"
      | "genders"
      | "locations",
    value: string,
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
    values.length === 0 ? "All" : `${values.length} selected`;

  const employmentTypeOptions: Option[] = EMPLOYMENT_TYPES.map((type) => ({
    value: type,
    label: humanizeEnum(type),
  }));

  const genderOptions: Option[] = GENDERS.map((gender) => ({
    value: gender,
    label: humanizeEnum(gender),
  }));

  const departmentOptions: Option[] = reference.departments.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const gradeOptions: Option[] = reference.grades.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const locationOptions: Option[] = reference.locations.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const activeCount = policies.filter((policy) => policy.is_active).length;

  const distinctTypes = new Set(policies.map((policy) => policy.leave_type))
    .size;

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

      {error && <ErrorState message={error} onRetry={reload} />}

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
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Leave Types</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {distinctTypes}
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
            aria-label="Filter by leave type"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value={ALL_TYPES}>All Types</option>

            {reference.leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value={ALL_STATUSES}>All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
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
                    <p className="font-medium text-slate-900">{policy.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {leaveTypeNames.get(policy.leave_type) ?? "—"}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {formatNumber(policy.annual_entitlement)} days
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {humanizeEnum(policy.accrual_method)}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {formatNumber(policy.max_carry_forward)} days
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-700">
                    {formatDate(policy.effective_from)}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge
                      status={policy.is_active ? "ACTIVE" : "INACTIVE"}
                    />
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
                      {loading
                        ? "Loading leave policies..."
                        : "No leave policies found"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {loading
                        ? "Please wait."
                        : "Try changing your filters or search term."}
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
                    <p className="font-medium text-slate-900">{policy.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {leaveTypeNames.get(policy.leave_type) ?? "—"}
                    </p>
                  </div>

                  <ChevronDown
                    className={`h-5 w-5 text-slate-400 transition-transform ${
                      expanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div className="mt-3 flex items-center justify-between">
                  <StatusBadge
                    status={policy.is_active ? "ACTIVE" : "INACTIVE"}
                  />
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
                      <p className="font-medium">
                        {formatNumber(policy.annual_entitlement)} days
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Accrual</p>
                      <p className="font-medium">
                        {humanizeEnum(policy.accrual_method)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Carry Forward</p>
                      <p className="font-medium">
                        {formatNumber(policy.max_carry_forward)} days
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Min Service</p>
                      <p className="font-medium">
                        {policy.min_service_days} days
                      </p>
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
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

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

                      {reference.leaveTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Entitlement &amp; Accrual
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Entitlement (days)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
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
                      Accrual Method
                    </span>
                    <select
                      value={form.accrualMethod}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          accrualMethod: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    >
                      {ACCRUAL_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {humanizeEnum(method)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Accrual Rate
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={form.accrualRate}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          accrualRate: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Carry Forward (days)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
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
                      step="0.01"
                      value={form.maxConsecutive}
                      placeholder="No limit"
                      onChange={(event) =>
                        setForm({
                          ...form,
                          maxConsecutive: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                    />
                  </label>
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Service &amp; Requirements
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                  {/*
                    The backend field is `min_service_days`; minimum service is
                    stored and evaluated in days, not months.
                  */}
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Minimum Service (days)
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={form.minServiceDays}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          minServiceDays: Number(event.target.value),
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

                <div className="grid gap-4 md:grid-cols-3">
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

                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) =>
                        setForm({ ...form, isActive: event.target.checked })
                      }
                      className="h-4 w-4"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-700">
                        Active
                      </span>
                      <span className="block text-xs text-slate-500">
                        Policy is available for evaluation.
                      </span>
                    </span>
                  </label>
                </div>
              </section>

              <section>
                <h3 className="mb-1 text-sm font-semibold text-slate-900">
                  Eligibility
                </h3>
                <p className="mb-4 text-xs text-slate-500">
                  Leaving a dimension unselected means the policy applies to
                  everyone in that dimension. Employment-type and gender
                  eligibility are write-only in the current API and will not
                  reappear when this policy is reopened for editing.
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
                    onToggle={(value) => toggleSelection("departments", value)}
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
                    onToggle={(value) => toggleSelection("locations", value)}
                    allText={eligibilityText(form.locations)}
                  />
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={savePolicy}
                disabled={
                  saving ||
                  !form.name.trim() ||
                  !form.leaveType ||
                  !form.effectiveFrom
                }
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {saving
                  ? "Saving..."
                  : editingPolicy
                    ? "Save Changes"
                    : "Create Policy"}
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
  options: Option[];
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
        {options.length === 0 && (
          <span className="text-xs text-slate-400">
            No options configured.
          </span>
        )}

        {options.map((option) => {
          const selected = values.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
