"use client";

import { useState } from "react";
import { CheckCircle2, Info, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function GhanaPayrollSetupPage() {
  const [option, setOption] = useState("preset");
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2500);
  };

  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Ghana Payroll Setup"
        description="Choose and review the institution's Ghana payroll configuration."
      />

      {saved && (
        <div className="flex items-center gap-3 rounded-xl border bg-white p-4 text-sm">
          <CheckCircle2 size={18} />
          Ghana payroll configuration saved in development mode.
        </div>
      )}

      <section className="rounded-xl border bg-white p-5">
        <div className="flex gap-3">
          <Info size={20} className="shrink-0" />
          <div>
            <h2 className="font-semibold">Configuration Choice</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ghana payroll can use the versioned preset or be configured
              manually. Selecting Ghana does not automatically force the
              preset.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <button
            onClick={() => setOption("preset")}
            className={`rounded-xl border p-5 text-left ${
              option === "preset" ? "border-slate-900 bg-slate-50" : ""
            }`}
          >
            <ShieldCheck size={22} />
            <h3 className="mt-3 font-semibold">
              Use Ghana Payroll Preset
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Recommended. Apply the institution's versioned Ghana statutory
              payroll configuration.
            </p>
          </button>

          <button
            onClick={() => setOption("custom")}
            className={`rounded-xl border p-5 text-left ${
              option === "custom" ? "border-slate-900 bg-slate-50" : ""
            }`}
          >
            <h3 className="font-semibold">Configure Manually</h3>
            <p className="mt-1 text-sm text-slate-500">
              Configure payroll rules and mappings manually.
            </p>
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white">
        <div className="border-b p-5">
          <h2 className="font-semibold">Ghana Configuration Summary</h2>
          <p className="text-sm text-slate-500">
            Current statutory configuration areas.
          </p>
        </div>

        <div className="divide-y">
          {[
            ["Preset Version", "GH-PAYROLL-2026.1"],
            ["PAYE", "Configured"],
            ["SSNIT / Tier 1", "Configured"],
            ["Tier 2", "Configured"],
            ["Statutory Thresholds", "Backend-controlled"],
            ["Compliance Reminders", "Enabled"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium">{label}</span>
              <span className="text-sm text-slate-500">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-slate-50 p-5">
        <h2 className="font-semibold">Important</h2>
        <p className="mt-1 text-sm text-slate-600">
          Statutory thresholds and payroll calculations must be supplied and
          validated by the backend configuration service. The frontend does
          not independently calculate authoritative PAYE, pension or statutory
          obligations.
        </p>
      </section>

      <div className="flex justify-end">
        <button
          onClick={save}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Save Ghana Setup
        </button>
      </div>
    </main>
  );
}