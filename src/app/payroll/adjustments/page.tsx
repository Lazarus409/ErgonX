"use client";

import { useMemo, useState } from "react";
import { Check, Edit3, Plus, Search, X, XCircle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

type AdjustmentStatus = "PENDING" | "APPROVED" | "REJECTED";

type Adjustment = {
  id: string;
  employee: string;
  employeeNumber: string;
  type: "EARNING" | "DEDUCTION";
  component: string;
  amount: number;
  reason: string;
  effectivePeriod: string;
  submittedBy: string;
  submittedAt: string;
  status: AdjustmentStatus;
  reviewComment?: string;
};

const initialAdjustments: Adjustment[] = [
  {
    id: "adj-001",
    employee: "Kwame Mensah",
    employeeNumber: "EMP-001",
    type: "EARNING",
    component: "Transport Allowance",
    amount: 450,
    reason: "Approved transport allowance adjustment.",
    effectivePeriod: "September 2026",
    submittedBy: "HR Admin",
    submittedAt: "12 Sep 2026",
    status: "PENDING",
  },
  {
    id: "adj-002",
    employee: "Ama Owusu",
    employeeNumber: "EMP-002",
    type: "EARNING",
    component: "Overtime Adjustment",
    amount: 320,
    reason: "Correction for approved overtime.",
    effectivePeriod: "September 2026",
    submittedBy: "HR Admin",
    submittedAt: "11 Sep 2026",
    status: "APPROVED",
  },
  {
    id: "adj-003",
    employee: "Daniel Asare",
    employeeNumber: "EMP-003",
    type: "DEDUCTION",
    component: "Salary Deduction",
    amount: 200,
    reason: "Approved employee deduction.",
    effectivePeriod: "September 2026",
    submittedBy: "HR Admin",
    submittedAt: "10 Sep 2026",
    status: "REJECTED",
    reviewComment: "Supporting documentation required.",
  },
];

const emptyForm = {
  employee: "",
  employeeNumber: "",
  type: "EARNING" as Adjustment["type"],
  component: "",
  amount: "",
  reason: "",
  effectivePeriod: "September 2026",
};

const money = (value: number) =>
  new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(value);

export default function PayrollAdjustmentsPage() {
  const [items, setItems] = useState(initialAdjustments);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [reviewing, setReviewing] = useState<Adjustment | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.employee.toLowerCase().includes(query) ||
        item.employeeNumber.toLowerCase().includes(query) ||
        item.component.toLowerCase().includes(query);

      const matchesStatus =
        status === "ALL" || item.status === status;

      return matchesSearch && matchesStatus;
    });
  }, [items, search, status]);

  const createAdjustment = () => {
    if (
      !form.employee.trim() ||
      !form.component.trim() ||
      !form.amount ||
      !form.reason.trim()
    ) {
      return;
    }

    const newItem: Adjustment = {
      id: `adj-${Date.now()}`,
      employee: form.employee,
      employeeNumber: form.employeeNumber || "EMP-NEW",
      type: form.type,
      component: form.component,
      amount: Number(form.amount),
      reason: form.reason,
      effectivePeriod: form.effectivePeriod,
      submittedBy: "Current User",
      submittedAt: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      status: "PENDING",
    };

    setItems((current) => [newItem, ...current]);
    setForm(emptyForm);
    setShowModal(false);
  };

  const review = (nextStatus: "APPROVED" | "REJECTED") => {
    if (!reviewing) return;

    let comment = reviewing.reviewComment || "";

    if (nextStatus === "REJECTED") {
      const entered = window.prompt(
        "Enter the reason for rejecting this adjustment:",
      );

      if (!entered?.trim()) return;

      comment = entered;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === reviewing.id
          ? {
              ...item,
              status: nextStatus,
              reviewComment: comment,
            }
          : item,
      ),
    );

    setReviewing(null);
  };

  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Payroll Adjustments"
        description="Create, review and approve payroll adjustments before payroll finalisation."
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={17} />
            New Adjustment
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Pending</p>
          <p className="mt-1 text-2xl font-bold">
            {items.filter((x) => x.status === "PENDING").length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Approved</p>
          <p className="mt-1 text-2xl font-bold">
            {items.filter((x) => x.status === "APPROVED").length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Pending Value</p>
          <p className="mt-1 text-2xl font-bold">
            {money(
              items
                .filter((x) => x.status === "PENDING")
                .reduce((sum, x) => sum + x.amount, 0),
            )}
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
              placeholder="Search employee or adjustment..."
              className="w-full rounded-lg border px-10 py-2.5 text-sm"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border px-3 py-2.5 text-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <p className="font-medium">{item.employee}</p>
                    <p className="text-xs text-slate-500">
                      {item.employeeNumber}
                    </p>
                  </td>
                  <td className="px-4 py-4">{item.component}</td>
                  <td className="px-4 py-4">{item.type}</td>
                  <td className="px-4 py-4 font-medium">
                    {money(item.amount)}
                  </td>
                  <td className="px-4 py-4">{item.effectivePeriod}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    {item.status === "PENDING" ? (
                      <button
                        onClick={() => setReviewing(item)}
                        className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                      >
                        Review
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Processed</span>
                    )}
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
                  <p className="font-semibold">{item.employee}</p>
                  <p className="text-xs text-slate-500">
                    {item.employeeNumber}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <span>{item.component}</span>
                <span>{item.type}</span>
                <span>{money(item.amount)}</span>
                <span>{item.effectivePeriod}</span>
              </div>

              {item.status === "PENDING" && (
                <button
                  onClick={() => setReviewing(item)}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-medium"
                >
                  Review Adjustment
                </button>
              )}
            </div>
          ))}
        </div>

        {!filtered.length && (
          <div className="p-10 text-center text-sm text-slate-500">
            No payroll adjustments found.
          </div>
        )}
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="font-bold">New Payroll Adjustment</h2>
                <p className="text-sm text-slate-500">
                  The adjustment will enter the approval workflow.
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
                <span className="text-sm font-medium">Employee</span>
                <input
                  value={form.employee}
                  onChange={(e) =>
                    setForm({ ...form, employee: e.target.value })
                  }
                  placeholder="Employee name"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">Employee Number</span>
                <input
                  value={form.employeeNumber}
                  onChange={(e) =>
                    setForm({ ...form, employeeNumber: e.target.value })
                  }
                  placeholder="EMP-000"
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
                      type: e.target.value as Adjustment["type"],
                    })
                  }
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                >
                  <option value="EARNING">Earning</option>
                  <option value="DEDUCTION">Deduction</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">Component</span>
                <input
                  value={form.component}
                  onChange={(e) =>
                    setForm({ ...form, component: e.target.value })
                  }
                  placeholder="Pay component"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">Amount (GHS)</span>
                <input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium">Effective Period</span>
                <input
                  value={form.effectivePeriod}
                  onChange={(e) =>
                    setForm({ ...form, effectivePeriod: e.target.value })
                  }
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                />
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="text-sm font-medium">Reason</span>
                <textarea
                  rows={3}
                  value={form.reason}
                  onChange={(e) =>
                    setForm({ ...form, reason: e.target.value })
                  }
                  placeholder="Explain why this adjustment is required..."
                  className="w-full rounded-lg border px-3 py-2.5 text-sm"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t p-5">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border px-4 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={createAdjustment}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Submit Adjustment
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="font-bold">Review Adjustment</h2>
                <p className="text-sm text-slate-500">
                  Review before approving for payroll.
                </p>
              </div>

              <button
                onClick={() => setReviewing(null)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="font-semibold">{reviewing.employee}</p>
                <p className="text-xs text-slate-500">
                  {reviewing.employeeNumber}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Component</p>
                  <p className="mt-1 font-medium">{reviewing.component}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="mt-1 font-medium">
                    {money(reviewing.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Type</p>
                  <p className="mt-1 font-medium">{reviewing.type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Period</p>
                  <p className="mt-1 font-medium">
                    {reviewing.effectivePeriod}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500">Reason</p>
                <p className="mt-1 text-sm">{reviewing.reason}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t p-5">
              <button
                onClick={() => review("REJECTED")}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold text-red-600"
              >
                <XCircle size={16} />
                Reject
              </button>

              <button
                onClick={() => review("APPROVED")}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Check size={16} />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}