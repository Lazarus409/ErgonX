"use client";

import { useCallback } from "react";
import { ArrowDownLeft, ArrowUpRight, Building2, FileBarChart, FileText, Landmark, Plus, Receipt, Scale, WalletCards } from "lucide-react";

import ChartCard from "@/components/charts/ChartCard";
import { BarsChart, ComposedTrendChart, DonutChart, donutLegend } from "@/components/charts/Charts";
import { useAuth } from "@/components/guards/AuthProvider";
import { ButtonLink } from "@/components/ui/Button";
import { Sparkline } from "@/components/charts/Visuals";
import { ActionCard, AttentionItem, Card, MetricCard, SummaryList } from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { dashboardsApi } from "@/lib/api";
import { EM_DASH, formatAmount, formatNumber, humanizeEnum, formatCount } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { hasModule } from "@/types/institutions";

const journalStatusColors: Record<string, string> = {
  DRAFT: "var(--ink-subtle)",
  PENDING_APPROVAL: "var(--warning)",
  APPROVED: "var(--chart-5)",
  POSTED: "var(--success)",
  REVERSED: "var(--chart-3)",
  VOID: "var(--danger)",
};

export default function AccountingDashboard() {
  const { institution, user } = useAuth();
  const can = (permission: string) => hasModule(institution?.enabledModules, "ACCOUNTING") && (user?.permissions.includes("*") || user?.permissions.includes(permission));
  const { data, loading, error, reload } = useApiResource(useCallback(() => dashboardsApi.getFinanceDashboard(), []));
  const initial = loading && !data;
  const currency = data?.currency;
  const pnl = data?.profit_and_loss_trend ?? [];
  const cash = data?.cash_flow_trend ?? [];
  const latestPnl = pnl.at(-1);
  const latestCash = cash.at(-1);
  const buckets = Array.from(new Set([...(data?.accounts_receivable_aging ?? []).map((item) => item.bucket), ...(data?.accounts_payable_aging ?? []).map((item) => item.bucket)]));
  const aging = buckets.map((bucket) => ({
    bucket,
    receivable: Number(data?.accounts_receivable_aging.find((item) => item.bucket === bucket)?.amount ?? 0),
    payable: Number(data?.accounts_payable_aging.find((item) => item.bucket === bucket)?.amount ?? 0),
  }));
  const journals = (data?.journals_by_status ?? []).map((item) => ({ label: humanizeEnum(item.status), value: item.count, color: journalStatusColors[item.status.toUpperCase()] }));
  const journalTotal = journals.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accounting"
        title="Accounting Dashboard"
        description="Posted-ledger performance, cash movement, aging and journal controls."
        icon={Scale}
        accent="accounting"
        actions={
          <>
            {can("financial_report.view") && <ButtonLink href="/accounting/reports" variant="secondary" leadingIcon={<FileBarChart className="h-4 w-4" />}>Financial reports</ButtonLink>}
            {can("journal.create") && <ButtonLink href="/accounting/journals/new" leadingIcon={<Plus className="h-4 w-4" />}>New journal</ButtonLink>}
          </>
        }
      />
      {error && <ErrorState variant="inline" title="Unable to load accounting dashboard" message={error} onRetry={reload} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Financial position">
        <MetricCard size="sm" label="Bank balance" value={data ? formatAmount(data.bank_balance, currency) : EM_DASH} description={data ? formatCount(data.registered_bank_accounts, "registered account") : undefined} icon={Landmark} accent="accounting" loading={initial} />
        <MetricCard size="sm" label="Accounts receivable" value={data ? formatAmount(data.accounts_receivable, currency) : EM_DASH} description="Outstanding from customers" icon={ArrowDownLeft} accent="attendance" loading={initial} href={can("invoice.view") ? "/accounting/receivables" : undefined} />
        <MetricCard size="sm" label="Accounts payable" value={data ? formatAmount(data.accounts_payable, currency) : EM_DASH} description="Owed to vendors" icon={ArrowUpRight} accent="payroll" loading={initial} href={can("vendor_bill.view") ? "/accounting/payables" : undefined} />
        <MetricCard size="sm" label="Posted expenses" value={data ? formatAmount(data.expenses, currency) : EM_DASH} description="Posted to the ledger" icon={Receipt} accent="audit" loading={initial} href={can("expense.view") ? "/accounting/expenses" : undefined} chart={<Sparkline values={pnl.map((point) => point.expenses)} color="var(--mod-audit)" height={32} label="Expenses by month" />} />
      </section>

      <ChartCard
        title="Profit and loss"
        description="Monthly income and expenses from posted journals, with the net result."
        accent="accounting"
        loading={initial}
        error={!data && error ? "This data is unavailable right now." : null}
        empty={!pnl.length}
        emptyDescription="Posted income or expense journals will appear here when available."
        legend={[{ label: "Income", color: "var(--chart-2)", shape: "square", value: latestPnl ? formatAmount(latestPnl.income, currency) : undefined }, { label: "Expenses", color: "var(--chart-6)", shape: "square", value: latestPnl ? formatAmount(latestPnl.expenses, currency) : undefined }, { label: "Net result", color: "var(--chart-1)", shape: "line", value: latestPnl ? formatAmount(latestPnl.net_income, currency) : undefined }]}
        summary={latestPnl ? `Latest posted month: income ${formatAmount(latestPnl.income, currency)}, expenses ${formatAmount(latestPnl.expenses, currency)}, net result ${formatAmount(latestPnl.net_income, currency)}.` : undefined}
        data={{ columns: ["Month", "Income", "Expenses", "Net result"], rows: pnl.map((point) => [point.month, formatAmount(point.income, currency), formatAmount(point.expenses, currency), formatAmount(point.net_income, currency)]) }}
        footer="Posted journals only. Legend values show the latest posted month."
      >
        <ComposedTrendChart data={pnl} xKey="month" format="currency" currency={currency} height={280} series={[{ key: "income", label: "Income", color: "var(--chart-2)", type: "bar" }, { key: "expenses", label: "Expenses", color: "var(--chart-6)", type: "bar" }, { key: "net_income", label: "Net result", color: "var(--chart-1)", type: "line" }]} />
      </ChartCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Bank cash movement"
          description="Posted bank-ledger inflow and outflow for registered bank accounts."
          accent="accounting"
          icon={WalletCards}
          loading={initial}
          error={!data && error ? "This data is unavailable right now." : null}
          empty={!cash.length}
          emptyDescription="Post bank journals to see cash movement."
          legend={[{ label: "Inflow", color: "var(--success)", shape: "square" }, { label: "Outflow", color: "var(--warning)", shape: "square" }]}
          footer={latestCash ? <span>Latest net movement: <strong className={Number(latestCash.net_movement) >= 0 ? "text-success-ink" : "text-danger-ink"}>{formatAmount(latestCash.net_movement, currency)}</strong></span> : undefined}
          data={{ columns: ["Month", "Inflow", "Outflow", "Net"], rows: cash.map((point) => [point.month, formatAmount(point.inflow, currency), formatAmount(point.outflow, currency), formatAmount(point.net_movement, currency)]) }}
        >
          <BarsChart data={cash} xKey="month" xFormat="month" format="currency" currency={currency} height={240} series={[{ key: "inflow", label: "Inflow", color: "var(--success)" }, { key: "outflow", label: "Outflow", color: "var(--warning)" }]} />
        </ChartCard>
        <ChartCard
          title="Receivable and payable aging"
          description="Outstanding balances by age bucket."
          accent="accounting"
          loading={initial}
          error={!data && error ? "This data is unavailable right now." : null}
          empty={!aging.length}
          emptyDescription="Aging appears once invoices or bills are outstanding."
          legend={[{ label: "Receivable", color: "var(--chart-5)", shape: "square" }, { label: "Payable", color: "var(--mod-payroll)", shape: "square" }]}
          data={{ columns: ["Bucket", "Receivable", "Payable"], rows: aging.map((row) => [row.bucket, formatAmount(row.receivable, currency), formatAmount(row.payable, currency)]) }}
        >
          <BarsChart data={aging} xKey="bucket" layout="horizontal" format="currency" currency={currency} height={240} series={[{ key: "receivable", label: "Receivable", color: "var(--chart-5)" }, { key: "payable", label: "Payable", color: "var(--mod-payroll)" }]} />
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-2"
          title="Journal status"
          description="Tenant-scoped journal workflow composition."
          accent="accounting"
          icon={FileText}
          loading={initial}
          error={!data && error ? "This data is unavailable right now." : null}
          empty={!journals.length}
          emptyDescription="Journals will appear here once created."
          data={{ columns: ["Status", "Journals"], rows: journals.map((item) => [item.label, item.value]) }}
        >
          <div className="grid items-center gap-5 sm:grid-cols-[160px_1fr] xl:grid-cols-1 2xl:grid-cols-[160px_1fr]">
            <DonutChart data={journals} height={160} centerValue={formatNumber(journalTotal)} centerLabel="journals" />
            <SummaryList items={donutLegend(journals).map((item) => ({ label: <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label}</span>, value: item.value }))} />
          </div>
        </ChartCard>
        <Card className="xl:col-span-3" title="Controls and exceptions" description="Items that need review before the period can close cleanly." icon={Scale} accent="accounting">
          <div className="-mx-3 -mb-2 space-y-1">
            <AttentionItem title="Journals pending approval" description={`${formatCount(data?.pending_journals, "journal")} in the approval workflow.`} severity={data?.pending_journals ? "warning" : "info"} href={can("journal.view") ? "/accounting/journals?status=PENDING_APPROVAL" : undefined} />
            {data && Number(data.accounts_payable) > 0 && Number(data.accounts_payable) > Number(data.bank_balance) && <AttentionItem title="Payables exceed bank balance" description={`Outstanding payables of ${formatAmount(data.accounts_payable, currency)} exceed the registered bank balance.`} severity="high" href={can("vendor_bill.view") ? "/accounting/payables" : undefined} />}
            {data && !(Number(data.accounts_payable) > 0) && Number(data.bank_balance) < 0 && <AttentionItem title="Bank balance is negative" description={`The registered bank ledger balance is ${formatAmount(data.bank_balance, currency)}.`} severity="high" href={can("bank_account.view") ? "/accounting/banking" : undefined} />}
            {latestPnl && Number(latestPnl.net_income) < 0 && <AttentionItem title="Net loss in the latest posted month" description={`Net result of ${formatAmount(latestPnl.net_income, currency)}.`} severity="high" href={can("financial_report.view") ? "/accounting/reports" : undefined} />}
            {can("bank_reconciliation.view") && <AttentionItem title="Bank reconciliation" description="Match statement lines against posted cash movements." severity="info" href="/accounting/banking" />}
          </div>
        </Card>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Accounting areas">
        {can("journal.view") && <ActionCard href="/accounting/journals" title="Journals" description="Create, approve, post and reverse" icon={FileText} accent="accounting" />}
        {can("invoice.view") && <ActionCard href="/accounting/receivables" title="Receivables" description="Customers, invoices and receipts" icon={ArrowDownLeft} accent="accounting" />}
        {can("vendor_bill.view") && <ActionCard href="/accounting/payables" title="Payables" description="Vendors, bills and payments" icon={Building2} accent="accounting" />}
        {can("bank_account.view") && <ActionCard href="/accounting/banking" title="Banking" description="Accounts and reconciliation" icon={Landmark} accent="accounting" />}
      </section>
    </div>
  );
}
