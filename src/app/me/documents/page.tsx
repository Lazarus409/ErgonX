"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { employeesApi, getApiErrorMessage } from "@/lib/api";
import type { SelfServiceDocument } from "@/lib/api/employees";

export default function MyDocumentsPage() {
  const [items, setItems] = useState<SelfServiceDocument[]>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => { employeesApi.listMyDocuments().then(setItems).catch((caught) => setError(getApiErrorMessage(caught))); }, []);
  return <div className="mx-auto max-w-4xl space-y-6"><section className="rounded-2xl bg-slate-950 px-7 py-8 text-white shadow-lg"><p className="text-sm font-semibold text-sky-300">EMPLOYEE SELF-SERVICE</p><h1 className="mt-2 text-3xl font-bold">My documents</h1><p className="mt-2 text-slate-300">Documents shared with you by your organisation.</p></section>{error && <p className="rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>}<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{items.length ? items.map((item) => <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 p-5 last:border-0"><FileText className="text-sky-700" /><div><p className="font-semibold text-slate-900">{item.original_filename}</p><p className="text-sm text-slate-500">{item.category || "Employee document"} · {item.classification}</p></div></div>) : <div className="p-10 text-center text-slate-500">No documents have been shared with you yet.</div>}</section></div>;
}
