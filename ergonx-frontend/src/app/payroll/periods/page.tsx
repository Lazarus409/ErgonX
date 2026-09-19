"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, Plus, Search, X } from "lucide-react";

import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, payrollApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";

const ALL = "ALL";
const emptyForm = { name: "", start_date: "", end_date: "", pay_date: "" };

export default function PayrollPeriodsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(
    () => payrollApi.listPayrollPeriods({ page_size: MAX_PAGE_SIZE, status: status === ALL ? undefined : status, ordering: "-start_date" }),
    [status],
  );
  const { data, loading, error, reload } = useApiResource(load);

  const periods = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.results ?? []).filter((period) => !query || period.name.toLowerCase().includes(query));
  }, [data, search]);

  const createPeriod = async () => {
    setFormError("");
    if (!form.name.trim() || !form.start_date || !form.end_date || !form.pay_date) {
      setFormError("Complete the name, period dates, and pay date.");
      return;
    }
    if (form.end_date < form.start_date) {
      setFormError("The end date must not be before the start date.");
      return;
    }
    setSaving(true);
    try {
      await payrollApi.createPayrollPeriod({ ...form, name: form.name.trim() });
      setFormOpen(false);
      setForm(emptyForm);
      reload();
    } catch (caught) {
      setFormError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6 p-4 md:p-6">
      <PageHeader title="Payroll Periods" description="Manage payroll periods and their processing status." actions={<button type="button" onClick={() => { setFormError(""); setFormOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17} />New Period</button>} />
      {error && <ErrorState message={error} onRetry={reload} />}

      <section className="rounded-xl border bg-white">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row"><div className="relative flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payroll periods..." className="w-full rounded-lg border px-10 py-2.5 text-sm" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border px-3 py-2.5 text-sm"><option value={ALL}>All Statuses</option><option value="OPEN">Open</option><option value="PROCESSING">Processing</option><option value="CLOSED">Closed</option></select></div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Period</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">End</th><th className="px-4 py-3">Pay Date</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y">{periods.map((period) => <tr key={period.id} className="hover:bg-slate-50"><td className="px-4 py-4 font-semibold">{period.name}</td><td className="px-4 py-4">{formatDate(period.start_date)}</td><td className="px-4 py-4">{formatDate(period.end_date)}</td><td className="px-4 py-4">{formatDate(period.pay_date)}</td><td className="px-4 py-4"><StatusBadge status={period.status} /></td></tr>)}</tbody></table></div>
        <div className="divide-y md:hidden">{periods.map((period) => <div key={period.id} className="space-y-3 p-4"><div className="flex items-start justify-between"><div><p className="font-semibold">{period.name}</p><p className="text-xs text-slate-500">Pay date: {formatDate(period.pay_date)}</p></div><StatusBadge status={period.status} /></div><div className="grid grid-cols-2 gap-2 text-xs text-slate-500"><span>Start: {formatDate(period.start_date)}</span><span>End: {formatDate(period.end_date)}</span></div></div>)}</div>
        {loading && <div className="p-10 text-center text-sm text-slate-500">Loading payroll periods...</div>}
        {!loading && periods.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No payroll periods found.</div>}
      </section>

      <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600"><div className="flex gap-3"><CalendarDays size={18} className="shrink-0" /><p>Period dates and processing status are controlled by the payroll backend. Closed periods cannot be changed.</p></div></div>

      {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">New Payroll Period</h2><p className="mt-1 text-sm text-slate-500">Open a period for an already configured payroll institution.</p></div><button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{formError && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}<div className="mt-5 space-y-4"><Input label="Period Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input label="Start Date" type="date" value={form.start_date} onChange={(value) => setForm({ ...form, start_date: value })} /><Input label="End Date" type="date" value={form.end_date} onChange={(value) => setForm({ ...form, end_date: value })} /><Input label="Pay Date" type="date" value={form.pay_date} onChange={(value) => setForm({ ...form, pay_date: value })} /></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="rounded-lg border px-4 py-2.5 text-sm font-medium">Cancel</button><button type="button" onClick={() => void createPeriod()} disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">{saving ? "Creating..." : "Create Period"}</button></div></div></div>}
    </main>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label>; }
