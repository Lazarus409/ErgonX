"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useCallback } from "react";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { payrollApi } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";

export default function MyPayslipsPage() {
  const load = useCallback(() => payrollApi.listPayslips({ page_size: MAX_PAGE_SIZE, ordering: "-generated_at" }), []);
  const { data, loading, error, reload } = useApiResource(load);
  const payslips = data?.results ?? [];
  return <main className="space-y-6 p-4 md:p-6"><PageHeader title="My Payslips" description="View your available payroll statements." />{error && <ErrorState message={error} onRetry={reload} />}<section className="rounded-xl border bg-white"><div className="divide-y">{payslips.map((item) => <div key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-lg bg-slate-100 p-3"><FileText size={20} /></div><div><p className="font-semibold">{item.payroll_period.name}</p><p className="text-sm text-slate-500">Pay date: {formatDate(item.payroll_period.pay_date)} · Net: {formatAmount(item.payload.net_pay, item.payload.currency)}</p></div></div><Link href={`/payroll/payslips/${item.id}`} className="rounded-lg border px-4 py-2 text-center text-sm font-medium">View</Link></div>)}{loading && <p className="p-10 text-center text-sm text-slate-500">Loading payslips...</p>}{!loading && !payslips.length && <p className="p-10 text-center text-sm text-slate-500">No payslips are available yet.</p>}</div></section></main>;
}
