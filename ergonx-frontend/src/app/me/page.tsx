"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, ClipboardCheck, Contact, FileText, Pencil, UserRound } from "lucide-react";
import { employeesApi, getApiErrorMessage } from "@/lib/api";
import type { Employee } from "@/types/hr";

const tools = [
  { href: "/me/profile", label: "My profile", description: "View and update your details", icon: UserRound },
  { href: "/me/leave", label: "Leave", description: "Balances and requests", icon: CalendarDays },
  { href: "/me/attendance", label: "Attendance", description: "Time and attendance activity", icon: ClipboardCheck },
  { href: "/me/emergency-contacts", label: "Emergency contacts", description: "Keep your contacts current", icon: Contact },
  { href: "/me/documents", label: "Documents", description: "Your shared documents", icon: FileText },
];

export default function SelfServiceHome() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { employeesApi.getCurrentEmployee().then(setEmployee).catch((caught) => setError(getApiErrorMessage(caught))); }, []);
  const name = employee?.first_name || "there";
  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-950 to-sky-950 px-7 py-8 text-white shadow-xl sm:px-9"><p className="text-sm font-semibold tracking-[0.16em] text-sky-300">EMPLOYEE HOME</p><div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold tracking-tight">Welcome, {name}.</h1><p className="mt-2 max-w-xl text-slate-300">Manage your personal information and everyday work services in one place.</p></div><Link href="/me/profile" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-50"><Pencil className="h-4 w-4" />Edit my details</Link></div></section>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-sky-50 p-3 text-sky-700"><UserRound className="h-5 w-5" /></span><div><h2 className="font-semibold text-slate-950">My details</h2><p className="text-sm text-slate-500">Your employee account information.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Employee number" value={employee?.employee_number ?? "—"} /><Detail label="Work email" value={employee?.work_email ?? "—"} /><Detail label="Personal email" value={employee?.personal_email || "Add in profile"} /><Detail label="Phone" value={employee?.phone || "Add in profile"} /></div></section>
    <section><div className="mb-4"><h2 className="text-lg font-bold text-slate-950">Self-Service</h2><p className="mt-1 text-sm text-slate-500">Choose what you need to manage today.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{tools.map((tool) => { const Icon = tool.icon; return <Link key={tool.href} href={tool.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"><span className="inline-flex rounded-xl bg-sky-50 p-3 text-sky-700"><Icon className="h-5 w-5" /></span><div className="mt-5 flex items-center justify-between"><div><h3 className="font-semibold text-slate-950">{tool.label}</h3><p className="mt-1 text-sm text-slate-500">{tool.description}</p></div><ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-sky-700" /></div></Link>; })}</div></section>
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 truncate text-sm font-semibold text-slate-900">{value}</p></div>; }
