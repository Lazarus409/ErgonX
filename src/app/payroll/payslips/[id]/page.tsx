"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback } from "react";
import { ArrowLeft, FileText, Lock } from "lucide-react";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { employeesApi, payrollApi } from "@/lib/api";
import { EM_DASH, formatAmount, formatDate, formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { PayslipItem } from "@/types/payroll";

export default function PayslipDetailPage() {
  const params = useParams<{ id: string }>(); const id = params?.id ?? "";
  const load = useCallback(async () => { const payslip = await payrollApi.getPayslip(id); const employee = await employeesApi.getEmployee(payslip.payload.employee_id).catch(() => null); return { payslip, employee }; }, [id]);
  const { data, loading, error, reload } = useApiResource(load);
  if (loading) return <LoadingState />;
  if (error || !data) return <main className="p-4 md:p-6"><ErrorState title="Unable to load payslip" message={error ?? "This payslip could not be found."} onRetry={reload} /></main>;
  const { payslip, employee } = data; const period = payslip.payroll_period; const currency = payslip.payload.currency; const earnings = payslip.payload.items.filter((item) => item.metadata.effect === "EARNING"); const deductions = payslip.payload.items.filter((item) => item.metadata.effect === "DEDUCTION" || item.metadata.effect === "EMPLOYEE_CONTRIBUTION");
  return <main className="space-y-6 p-4 md:p-6"><Link href="/payroll/payslips" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"><ArrowLeft size={16} />Back to Payslips</Link><PageHeader title={`Payslip — ${period.name}`} description={`Generated ${formatDateTime(payslip.generated_at)} from a finalized payroll record.`} /><section className="mx-auto max-w-4xl rounded-xl border bg-white"><div className="border-b p-6"><div className="flex flex-col justify-between gap-5 sm:flex-row"><div><div className="flex items-center gap-2"><FileText size={20} /><h2 className="text-lg font-bold">ErgonX</h2></div><p className="mt-1 text-sm text-slate-500">Employee Payslip</p></div><div className="text-left text-sm sm:text-right"><p className="font-semibold">{period.name}</p><p className="text-slate-500">Pay date: {formatDate(period.pay_date)}</p></div></div></div><div className="grid gap-6 border-b p-6 sm:grid-cols-2"><Detail label="Employee" value={employee ? employeesApi.employeeDisplayName(employee) : EM_DASH} subvalue={employee?.employee_number} /><Detail label="Payroll period" value={`${formatDate(period.start_date)} – ${formatDate(period.end_date)}`} /></div><div className="grid gap-6 p-6 md:grid-cols-2"><ItemGroup title="Earnings" items={earnings} currency={currency} totalLabel="Gross Pay" total={payslip.payload.gross_pay} /><ItemGroup title="Deductions" items={deductions} currency={currency} totalLabel="Total Deductions" total={payslip.payload.total_deductions} /></div><div className="m-6 rounded-xl bg-slate-900 p-5 text-white"><div className="flex items-center justify-between"><span className="font-semibold">Net Pay</span><span className="text-2xl font-bold">{formatAmount(payslip.payload.net_pay, currency)}</span></div></div><div className="border-t p-5"><div className="flex gap-3 text-sm text-slate-500"><Lock size={17} className="shrink-0" /><p>This payslip is generated from a finalized payroll record. Historical payroll data is immutable.</p></div></div></section>{!payslip.document_reference && <p className="mx-auto max-w-4xl text-center text-xs text-slate-500">No downloadable document has been attached to this payslip.</p>}</main>;
}
function Detail({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p>{subvalue && <p className="text-sm text-slate-500">{subvalue}</p>}</div>; }
function ItemGroup({ title, items, currency, totalLabel, total }: { title: string; items: PayslipItem[]; currency: string; totalLabel: string; total: string }) { return <div><h3 className="mb-3 font-semibold">{title}</h3><div className="space-y-3 text-sm">{items.map((item, index) => <div key={`${item.code}-${index}`} className="flex justify-between gap-3"><span>{item.name}</span><span>{formatAmount(item.amount, currency)}</span></div>)}{!items.length && <p className="text-slate-500">No {title.toLowerCase()} entries.</p>}</div><div className="mt-4 flex justify-between border-t pt-3 font-bold"><span>{totalLabel}</span><span>{formatAmount(total, currency)}</span></div></div>; }
