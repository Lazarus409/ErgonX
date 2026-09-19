"use client";

import { FormEvent, useEffect, useState } from "react";
import { Save, UserRound } from "lucide-react";
import { employeesApi, getApiErrorMessage } from "@/lib/api";
import type { Employee } from "@/types/hr";

export default function MyProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [phone, setPhone] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    employeesApi.getCurrentEmployee().then((value) => {
      setEmployee(value);
      setPhone(value?.phone ?? "");
      setPersonalEmail(value?.personal_email ?? "");
    }).catch((caught) => setError(getApiErrorMessage(caught)));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault(); setError(null); setMessage(null);
    if (!employee) return;
    try {
      const updated = await employeesApi.updateMyProfile({ phone, personal_email: personalEmail });
      setEmployee(updated); setMessage("Your contact details have been updated.");
    } catch (caught) { setError(getApiErrorMessage(caught)); }
  }

  return <div className="mx-auto max-w-4xl space-y-6">
    <section className="rounded-2xl bg-slate-950 px-7 py-8 text-white shadow-lg"><p className="text-sm font-semibold text-sky-300">EMPLOYEE SELF-SERVICE</p><h1 className="mt-2 text-3xl font-bold">My profile</h1><p className="mt-2 text-slate-300">Keep your personal contact details current.</p></section>
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}
    <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3"><span className="rounded-xl bg-sky-50 p-3 text-sky-700"><UserRound /></span><div><h2 className="font-semibold text-slate-950">Personal information</h2><p className="text-sm text-slate-500">Employment details are managed by HR.</p></div></div>
      <div className="grid gap-5 md:grid-cols-2"><Field label="Full name" value={employee?.full_name ?? "Loading…"} disabled /><Field label="Employee number" value={employee?.employee_number ?? ""} disabled /><Field label="Work email" value={employee?.work_email ?? ""} disabled /><Field label="Personal email" value={personalEmail} onChange={setPersonalEmail} type="email" /><Field label="Phone" value={phone} onChange={setPhone} /></div>
      {message && <p className="mt-5 text-sm text-emerald-700">{message}</p>}<button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"><Save className="h-4 w-4" />Save changes</button>
    </form>
  </div>;
}

function Field({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange?: (value: string) => void; disabled?: boolean; type?: string }) { return <label className="grid gap-2 text-sm font-medium text-slate-700">{label}<input type={type} value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-slate-900 disabled:bg-slate-50" /></label>; }
