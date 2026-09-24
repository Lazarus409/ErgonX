"use client";

import { useCallback, useEffect, useState } from "react";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { accountingApi, getApiErrorMessage, institutionsApi } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import type { BalanceSheet, IncomeStatement, TrialBalance } from "@/types/accounting";
import { useApiResource } from "@/lib/useApiResource";

type Report = "trial" | "income" | "balance";
export default function AccountingReportsPage() {
  const [report, setReport] = useState<Report>("trial");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [applied, setApplied] = useState({ date_from: "", date_to: "" });
  const [currency, setCurrency] = useState<string>();
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementReload, setStatementReload] = useState(0);
  const trial = useApiResource(useCallback(() => accountingApi.getTrialBalance({ date_from: applied.date_from || undefined, date_to: applied.date_to || undefined }), [applied]));
  const [statement, setStatement] = useState<IncomeStatement | BalanceSheet | null>(null);
  const [statementError, setStatementError] = useState<string | null>(null);
  useEffect(() => {
    institutionsApi.getCurrentInstitution().then((context) => setCurrency(context.institution.default_currency)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (report === "trial") return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setStatementLoading(true);
      setStatement(null);
      const request = report === "income" ? accountingApi.getIncomeStatement({ date_from: applied.date_from || undefined, date_to: applied.date_to || undefined }) : accountingApi.getBalanceSheet({ as_of: applied.date_to || undefined });
      request.then((value) => { if (active) { setStatementError(null); setStatement(value); } }).catch((caught) => { if (active) setStatementError(getApiErrorMessage(caught)); }).finally(() => { if (active) setStatementLoading(false); });
    })();
    return () => { active = false; };
  }, [report, applied, statementReload]);
  const apply = () => { setApplied({ date_from: dateFrom, date_to: dateTo }); setStatementReload((value) => value + 1); };
  return <main className="space-y-6"><PageHeader title="Financial Reports" description="Filterable, permission-aware accounting reports for the active institution." /><div className="grid gap-4 md:grid-cols-3">{(["trial", "income", "balance"] as Report[]).map((kind) => <button key={kind} type="button" onClick={() => setReport(kind)} className={`rounded-2xl border bg-white p-5 text-left transition hover:shadow-sm ${report === kind ? "border-slate-900 ring-2 ring-slate-100" : "opacity-80"}`}><span className="block font-semibold">{kind === "trial" ? "Trial Balance" : kind === "income" ? "Income Statement" : "Balance Sheet"}</span><span className="mt-2 block text-sm text-slate-500">{kind === "trial" ? "Debit and credit balances across posted accounts." : kind === "income" ? "Income, expenses, and net result." : "Assets, liabilities, and equity."}</span></button>)}</div><ReportFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} apply={apply} report={report} currency={currency} />{report === "trial" ? <TrialPanel data={trial.data} loading={trial.loading} error={trial.error} reload={trial.reload} currency={currency} /> : <StatementPanel report={report} data={statement} loading={statementLoading} error={statementError} onRetry={() => setStatementReload((value) => value + 1)} currency={currency} />}</main>;
}

function ReportFilters({ dateFrom, dateTo, setDateFrom, setDateTo, apply, report, currency }: { dateFrom: string; dateTo: string; setDateFrom: (v: string) => void; setDateTo: (v: string) => void; apply: () => void; report: Report; currency?: string }) { return <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border bg-white p-5"><div><p className="font-semibold">Report filters</p><p className="mt-1 text-sm text-slate-500">{report === "balance" ? "Balance Sheet uses the end date as its as-of date." : "Choose a period for posted ledger activity."}{currency && ` Reporting currency: ${currency}.`}</p></div><div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs font-medium text-slate-600">From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-xl border p-2 text-sm text-slate-900" /></label><label className="grid gap-1 text-xs font-medium text-slate-600">To / as of<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-xl border p-2 text-sm text-slate-900" /></label><button type="button" onClick={apply} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply</button></div></section>; }
function TrialPanel({ data, loading, error, reload, currency }: { data: TrialBalance | null; loading: boolean; error: string | null; reload: () => void; currency?: string }) { return <section className="rounded-2xl border bg-white p-5"><div><h2 className="font-semibold">Trial Balance</h2><p className="text-sm text-slate-500">Derived from posted journal lines by the backend.</p></div>{error && <div className="mt-4"><ErrorState message={error} onRetry={reload} /></div>}{loading ? <p className="py-10 text-center text-sm text-slate-500">Loading trial balance…</p> : !data?.rows.length ? <p className="py-10 text-center text-sm text-slate-500">No posted account balances found.</p> : <table className="mt-5 w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-3">Account</th><th className="pb-3">Type</th><th className="pb-3">Debit</th><th className="pb-3">Credit</th></tr></thead><tbody>{data.rows.map((row) => <tr key={row.account_id} className="border-b last:border-0"><td className="py-3">{row.code} · {row.name}</td><td className="py-3">{row.account_type}</td><td className="py-3">{formatAmount(row.debit, currency)}</td><td className="py-3">{formatAmount(row.credit, currency)}</td></tr>)}</tbody></table>}</section>; }
function StatementPanel({ report, data, loading, error, onRetry, currency }: { report: "income" | "balance"; data: IncomeStatement | BalanceSheet | null; loading: boolean; error: string | null; onRetry: () => void; currency?: string }) { if (error) return <ErrorState title="Unable to load report" message={error} onRetry={onRetry} />; if (loading || !data) return <section className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Loading report…</section>; if (report === "income") { const value = data as IncomeStatement; return <section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Income Statement</h2><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Income" value={formatAmount(value.total_income, currency)} /><Metric label="Expenses" value={formatAmount(value.total_expenses, currency)} /><Metric label="Net income" value={formatAmount(value.net_income, currency)} /></div></section>; } const value = data as BalanceSheet; return <section className="rounded-2xl border bg-white p-6"><h2 className="font-semibold">Balance Sheet</h2><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Assets" value={formatAmount(value.total_assets, currency)} /><Metric label="Liabilities" value={formatAmount(value.total_liabilities, currency)} /><Metric label="Status" value={value.balanced ? "Balanced" : "Out of balance"} /></div></section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
