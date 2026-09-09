"use client";

import { useState } from "react";
import { CheckCircle2, Save, Settings2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function PayrollConfigurationPage() {
  const [preset, setPreset] = useState("GHANA");
  const [currency, setCurrency] = useState("GHS");
  const [frequency, setFrequency] = useState("MONTHLY");
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
        title="Payroll Configuration"
        description="Configure institution-level payroll settings, presets and component mappings."
      />

      {saved && (
        <div className="flex items-center gap-3 rounded-xl border bg-white p-4 text-sm">
          <CheckCircle2 size={18} />
          Payroll configuration saved in development mode.
        </div>
      )}

      <section className="rounded-xl border bg-white">
        <div className="border-b p-5">
          <div className="flex items-center gap-3">
            <Settings2 size={20} />
            <div>
              <h2 className="font-semibold">General Payroll Settings</h2>
              <p className="text-sm text-slate-500">
                Institution-wide payroll defaults.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Payroll Preset</span>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
            >
              <option value="GHANA">Ghana Payroll Preset</option>
              <option value="CUSTOM">Custom Configuration</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Payroll Frequency</span>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Biweekly</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Currency</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border px-3 py-2.5 text-sm"
            >
              <option value="GHS">GHS — Ghana Cedi</option>
              <option value="USD">USD — US Dollar</option>
              <option value="GBP">GBP — Pound Sterling</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium">Current Configuration Version</span>
            <input
              value={preset === "GHANA" ? "GH-PAYROLL-2026.1" : "CUSTOM"}
              readOnly
              className="w-full rounded-lg border bg-slate-50 px-3 py-2.5 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border bg-white">
        <div className="border-b p-5">
          <h2 className="font-semibold">Payroll Component Mapping</h2>
          <p className="text-sm text-slate-500">
            Components available to the selected payroll configuration.
          </p>
        </div>

        <div className="divide-y">
          {[
            ["BASIC", "Basic Salary", "EARNING"],
            ["HOUSING", "Housing Allowance", "EARNING"],
            ["TRANSPORT", "Transport Allowance", "EARNING"],
            ["PAYE", "PAYE Tax", "DEDUCTION"],
            ["SSNIT", "SSNIT / Tier 1", "DEDUCTION"],
          ].map(([code, name, type]) => (
            <div
              key={code}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{name}</p>
                <p className="text-xs text-slate-500">
                  {code} · {type}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                Mapped
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={save}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          <Save size={17} />
          Save Configuration
        </button>
      </div>
    </main>
  );
}