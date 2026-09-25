"use client";

import { useCallback, useEffect, useState } from "react";
import { FileBarChart, Printer } from "lucide-react";

import DocumentFrame from "@/components/brand/DocumentFrame";
import { useAuth } from "@/components/guards/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Input } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import Tabs from "@/components/ui/Tabs";
import { cx } from "@/lib/cx";
import { accountingApi, getApiErrorMessage, institutionsApi } from "@/lib/api";
import { formatAmount, formatDate, humanizeEnum } from "@/lib/format";
import type { BalanceSheet, IncomeStatement, TrialBalance } from "@/types/accounting";
import { useApiResource } from "@/lib/useApiResource";

type Report = "trial" | "income" | "balance";
export default function AccountingReportsPage() {
  const { institution } = useAuth();
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
  const reportLabels: Record<Report, string> = { trial: "Trial Balance", income: "Income Statement", balance: "Balance Sheet" };
  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-6">
        <PageHeader
          title="Financial reports"
          description="Filterable, permission-aware accounting reports for the active institution."
          icon={FileBarChart}
          accent="accounting"
          actions={<Button variant="secondary" leadingIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>}
        />
        <Tabs
          label="Report type"
          value={report}
          onChange={(value) => setReport(value as Report)}
          items={(["trial", "income", "balance"] as Report[]).map((kind) => ({ value: kind, label: reportLabels[kind] }))}
        />
        <ReportFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} apply={apply} report={report} currency={currency} />
      </div>
      <DocumentFrame
        institutionName={institution?.name ?? "Institution"}
        documentTitle={reportLabels[report]}
        meta={<><p className="font-semibold text-ink-strong">{report === "balance" ? `As of ${applied.date_to ? formatDate(applied.date_to) : "today"}` : applied.date_from || applied.date_to ? `${applied.date_from ? formatDate(applied.date_from) : "Start"} – ${applied.date_to ? formatDate(applied.date_to) : "today"}` : "All posted periods"}</p>{currency && <p className="text-ink-muted">Reporting currency: {currency}</p>}</>}
        footerNote="Derived from posted journal lines by the ErgonX ledger. Draft and pending journals are excluded."
      >
        {report === "trial" ? <TrialPanel data={trial.data} loading={trial.loading} error={trial.error} reload={trial.reload} currency={currency} /> : <StatementPanel report={report} data={statement} loading={statementLoading} error={statementError} onRetry={() => setStatementReload((value) => value + 1)} currency={currency} />}
      </DocumentFrame>
    </div>
  );
}

function ReportFilters({ dateFrom, dateTo, setDateFrom, setDateTo, apply, report, currency }: { dateFrom: string; dateTo: string; setDateFrom: (v: string) => void; setDateTo: (v: string) => void; apply: () => void; report: Report; currency?: string }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-elevation-1 lg:flex-row lg:items-end lg:justify-between" aria-label="Report filters">
      <div>
        <p className="text-card-title font-semibold text-ink-strong">Report filters</p>
        <p className="mt-0.5 text-support text-ink-muted">{report === "balance" ? "Balance Sheet uses the end date as its as-of date." : "Choose a period for posted ledger activity."}{currency && ` Reporting currency: ${currency}.`}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {report !== "balance" && <Field label="From"><Input type="date" size="sm" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></Field>}
        <Field label={report === "balance" ? "As of" : "To"}><Input type="date" size="sm" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></Field>
        <Button size="sm" onClick={apply}>Apply</Button>
      </div>
    </section>
  );
}

function TrialPanel({ data, loading, error, reload, currency }: { data: TrialBalance | null; loading: boolean; error: string | null; reload: () => void; currency?: string }) {
  const rows = data?.rows ?? [];
  if (error) return <div className="p-6"><ErrorState variant="inline" message={error} onRetry={reload} /></div>;
  if (loading) return <div className="space-y-3 p-6">{[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-8 rounded-lg" />)}</div>;
  if (!rows.length) return <EmptyState size="compact" icon={FileBarChart} accent="accounting" title="No posted account balances" description="Post journals in the selected period to see balances." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <caption className="sr-only">Trial balance</caption>
        <thead>
          <tr className="border-b border-line bg-surface-muted/60 text-left text-caption font-semibold text-ink-muted">
            <th scope="col" className="px-6 py-3 sm:px-8">Account</th>
            <th scope="col" className="px-4 py-3">Type</th>
            <th scope="col" className="px-4 py-3 text-right">Debit</th>
            <th scope="col" className="px-6 py-3 text-right sm:px-8">Credit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.account_id} className="border-b border-line-soft">
              <td className="px-6 py-3 sm:px-8"><span className="font-mono text-caption text-ink-muted">{row.code}</span> <span className="font-medium text-ink-strong">{row.name}</span></td>
              <td className="px-4 py-3 text-ink-muted">{humanizeEnum(row.account_type)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{Number(row.debit) ? formatAmount(row.debit, currency) : "—"}</td>
              <td className="px-6 py-3 text-right tabular-nums sm:px-8">{Number(row.credit) ? formatAmount(row.credit, currency) : "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-surface-muted/60 font-bold text-ink-strong">
            <th scope="row" colSpan={2} className="px-6 py-3 text-left sm:px-8">Totals {data?.balanced ? <Badge size="sm" tone="success" className="ml-2">Balanced</Badge> : <Badge size="sm" tone="danger" className="ml-2">Out of balance</Badge>}</th>
            <td className="px-4 py-3 text-right tabular-nums">{formatAmount(data?.total_debit, currency)}</td>
            <td className="px-6 py-3 text-right tabular-nums sm:px-8">{formatAmount(data?.total_credit, currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function StatementPanel({ report, data, loading, error, onRetry, currency }: { report: "income" | "balance"; data: IncomeStatement | BalanceSheet | null; loading: boolean; error: string | null; onRetry: () => void; currency?: string }) {
  if (error) return <div className="p-6"><ErrorState variant="inline" title="Unable to load report" message={error} onRetry={onRetry} /></div>;
  if (loading || !data) return <div className="grid gap-3 p-6 sm:grid-cols-3 sm:px-8">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-20 rounded-xl" />)}</div>;
  if (report === "income") {
    const value = data as IncomeStatement;
    return (
      <div className="grid gap-3 p-6 sm:grid-cols-3 sm:px-8">
        <Metric label="Income" value={formatAmount(value.total_income, currency)} />
        <Metric label="Expenses" value={formatAmount(value.total_expenses, currency)} />
        <Metric label="Net income" value={formatAmount(value.net_income, currency)} emphasis={Number(value.net_income) >= 0 ? "positive" : "negative"} />
      </div>
    );
  }
  const value = data as BalanceSheet;
  return (
    <div className="grid gap-3 p-6 sm:grid-cols-3 sm:px-8">
      <Metric label="Assets" value={formatAmount(value.total_assets, currency)} />
      <Metric label="Liabilities" value={formatAmount(value.total_liabilities, currency)} />
      <Metric label="Status" value={value.balanced ? "Balanced" : "Out of balance"} emphasis={value.balanced ? "positive" : "negative"} />
    </div>
  );
}

function Metric({ label, value, emphasis }: { label: string; value: string; emphasis?: "positive" | "negative" }) {
  return (
    <div className="rounded-xl border border-line-soft bg-surface-muted/50 p-4">
      <p className="text-caption font-medium text-ink-muted">{label}</p>
      <p className={cx("mt-1 text-kpi-sm font-bold tabular-nums", emphasis === "positive" ? "text-success-ink" : emphasis === "negative" ? "text-danger-ink" : "text-ink-strong")}>{value}</p>
    </div>
  );
}
