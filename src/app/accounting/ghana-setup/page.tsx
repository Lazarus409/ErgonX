"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";

const presets = ["GH-COMMERCIAL", "GH-SME", "GH-PUBLIC", "GH-NONPROFIT", "Custom"];

export default function GhanaAccountingSetupPage() {
  const [preset, setPreset] = useState("GH-COMMERCIAL");

  return (
    <main className="space-y-6">
      <PageHeader
        title="Ghana Accounting Setup"
        description="Configure the accounting localisation layer for the institution."
      />

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Accounting Preset</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ghana presets are configuration layers and should not hardcode accounting rules into the frontend.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {presets.map((item) => (
            <button
              key={item}
              onClick={() => setPreset(item)}
              className={`rounded-xl border p-4 text-left ${
                preset === item ? "border-slate-900 bg-slate-50" : ""
              }`}
            >
              <p className="font-semibold">{item}</p>
              <p className="mt-1 text-xs text-slate-500">
                {item === "Custom" ? "Configure manually" : "Use Ghana accounting preset"}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-semibold">Configuration Summary</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[
            ["Base Currency", "GHS"],
            ["Reporting Framework", "Ghana configured framework"],
            ["Starter COA", "Included"],
            ["VAT / NHIL / GETFund", "Configured"],
            ["Withholding Tax", "Configured"],
            ["Compliance Reminders", "Enabled"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => window.alert(`Accounting preset ${preset} saved in development mode.`)}
          className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Save Configuration
        </button>
      </section>

      <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600">
        Statutory calculations and compliance logic remain backend-controlled. The frontend displays
        configuration and status only.
      </div>
    </main>
  );
}