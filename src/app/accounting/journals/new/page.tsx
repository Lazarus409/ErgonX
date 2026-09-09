"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";

type Line = {
  id: number;
  account: string;
  description: string;
  debit: string;
  credit: string;
};

export default function NewJournalPage() {
  const [lines, setLines] = useState<Line[]>([
    { id: 1, account: "5000 - Expenses", description: "", debit: "10000", credit: "" },
    { id: 2, account: "1110 - Main Bank Account", description: "", debit: "", credit: "10000" },
  ]);

  const debit = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.debit || 0), 0),
    [lines]
  );
  const credit = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.credit || 0), 0),
    [lines]
  );
  const difference = debit - credit;
  const balanced = Math.abs(difference) < 0.001;

  const updateLine = (id: number, field: keyof Line, value: string) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const addLine = () => {
    setLines((current) => [
      ...current,
      {
        id: Date.now(),
        account: "",
        description: "",
        debit: "",
        credit: "",
      },
    ]);
  };

  const removeLine = (id: number) => {
    setLines((current) => current.filter((line) => line.id !== id));
  };

  const save = () => {
    if (!balanced) {
      window.alert("The journal must be balanced before it can be saved.");
      return;
    }

    window.alert("Journal saved as DRAFT in development mode.");
  };

  return (
    <main className="space-y-6">
      <PageHeader
        title="New Journal"
        description="Create a balanced double-entry accounting journal."
        actions={
          <Link
            href="/accounting/journals"
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        }
      />

      <section className="rounded-2xl border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium">
            Journal Date
            <input type="date" defaultValue="2026-08-31" className="mt-2 w-full rounded-xl border p-2.5" />
          </label>
          <label className="text-sm font-medium">
            Accounting Period
            <select className="mt-2 w-full rounded-xl border p-2.5">
              <option>August 2026</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Reference
            <input placeholder="JV-2026-XXXX" className="mt-2 w-full rounded-xl border p-2.5" />
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium">
          Description
          <input placeholder="Journal description" className="mt-2 w-full rounded-xl border p-2.5" />
        </label>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Journal Lines</h2>
            <p className="text-sm text-slate-500">Every journal must balance before posting.</p>
          </div>
          <button
            onClick={addLine}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            Add Line
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {lines.map((line) => (
            <div
              key={line.id}
              className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1.2fr_1fr_150px_150px_auto]"
            >
              <select
                value={line.account}
                onChange={(e) => updateLine(line.id, "account", e.target.value)}
                className="rounded-lg border p-2.5 text-sm"
              >
                <option value="">Select account</option>
                <option>1110 - Main Bank Account</option>
                <option>1200 - Accounts Receivable</option>
                <option>2100 - Accounts Payable</option>
                <option>4000 - Revenue</option>
                <option>5000 - Expenses</option>
              </select>

              <input
                value={line.description}
                onChange={(e) => updateLine(line.id, "description", e.target.value)}
                placeholder="Line description"
                className="rounded-lg border p-2.5 text-sm"
              />

              <input
                value={line.debit}
                onChange={(e) => updateLine(line.id, "debit", e.target.value)}
                type="number"
                min="0"
                placeholder="Debit"
                className="rounded-lg border p-2.5 text-sm"
              />

              <input
                value={line.credit}
                onChange={(e) => updateLine(line.id, "credit", e.target.value)}
                type="number"
                min="0"
                placeholder="Credit"
                className="rounded-lg border p-2.5 text-sm"
              />

              <button
                onClick={() => removeLine(line.id)}
                className="rounded-lg border p-2.5 text-slate-500 hover:text-red-600"
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Total Debit</p>
            <p className="mt-1 text-lg font-bold">GHS {debit.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Total Credit</p>
            <p className="mt-1 text-lg font-bold">GHS {credit.toLocaleString()}</p>
          </div>
          <div className={`rounded-xl p-4 ${balanced ? "bg-slate-100" : "bg-red-50"}`}>
            <p className="text-xs text-slate-500">Balance Difference</p>
            <p className="mt-1 text-lg font-bold">GHS {Math.abs(difference).toLocaleString()}</p>
            <p className="mt-1 text-xs font-medium">
              {balanced ? "Balanced" : "Journal is not balanced"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={save}
            disabled={!balanced}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save Draft
          </button>
        </div>
      </section>
    </main>
  );
}