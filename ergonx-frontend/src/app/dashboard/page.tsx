"use client";

import Link from "next/link";
import { useCallback } from "react";
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Landmark,
  LineChart as LineChartIcon,
  ShieldAlert,
  UserCheck,
  Users,
  WalletCards,
} from "lucide-react";

import ChartCard from "@/components/charts/ChartCard";
import { TrendChart } from "@/components/charts/Charts";
import { FunnelChart, SegmentedBar } from "@/components/charts/Visuals";
import { Badge } from "@/components/ui/Badge";
import { Card, MetricCard, SummaryCard } from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import { dashboardsApi } from "@/lib/api";
import { useAccess } from "@/lib/access";
import { useApiResource } from "@/lib/useApiResource";
import { EM_DASH, formatAmount, formatNumber, humanizeEnum, formatCount } from "@/lib/format";
import { cx } from "@/lib/cx";
import { moduleAccents, type ModuleAccent } from "@/lib/moduleTheme";

const statusColors: Record<string, string> = {
  ACTIVE: "var(--success)",
  ON_LEAVE: "var(--mod-leave)",
  PROBATION: "var(--chart-1)",
  SUSPENDED: "var(--warning)",
  TERMINATED: "var(--danger)",
  INACTIVE: "var(--ink-subtle)",
};

/**
 * Organization-wide Executive Dashboard. Every figure comes from the
 * tenant-scoped executive rollup; disabled modules contribute neither data
 * nor UI. It summarizes across modules rather than duplicating them.
 */
export default function DashboardPage() {
  const load = useCallback(() => dashboardsApi.getExecutiveDashboard(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const { moduleEnabled } = useAccess();
  const enabled = {
    hr: moduleEnabled("HR"),
    leave: moduleEnabled("LEAVE"),
    attendance: moduleEnabled("ATTENDANCE"),
    payroll: moduleEnabled("PAYROLL"),
    accounting: moduleEnabled("ACCOUNTING"),
    recruitment: moduleEnabled("RECRUITMENT"),
  };
  const currency = data?.currency;
  const initial = loading && !data;
  const pnl = data?.profit_and_loss_trend ?? [];
  const latestPnl = pnl.at(-1);
  const previousPnl = pnl.at(-2);
  const payrollTrend = data?.payroll_by_period ?? [];

  const netDelta = latestPnl && previousPnl ? Number(latestPnl.net_income) - Number(previousPnl.net_income) : null;

  const risks: Array<{ area: string; accent: ModuleAccent; signal: string; value: string; severity: "danger" | "warning" | "info"; href: string }> = [];
  if (data) {
    if (enabled.leave && (data.pending_leave_requests ?? 0) > 0) risks.push({ area: "Leave", accent: "leave", signal: "Requests awaiting a decision", value: formatNumber(data.pending_leave_requests), severity: "warning", href: "/leave/requests?status=PENDING" });
    if (enabled.accounting && (data.pending_journals ?? 0) > 0) risks.push({ area: "Accounting", accent: "accounting", signal: "Journals pending approval", value: formatNumber(data.pending_journals), severity: "warning", href: "/accounting/journals?status=PENDING_APPROVAL" });
    if (enabled.attendance && data.attendance_today && data.attendance_today.absent > 0) risks.push({ area: "Attendance", accent: "attendance", signal: "Employees absent today", value: formatNumber(data.attendance_today.absent), severity: data.attendance_today.absent > data.attendance_today.present * 0.1 ? "danger" : "info", href: "/attendance/dashboard" });
    if (enabled.attendance && data.attendance_today && data.attendance_today.late > 0) risks.push({ area: "Attendance", accent: "attendance", signal: "Late arrivals today", value: formatNumber(data.attendance_today.late), severity: "info", href: "/attendance/dashboard" });
    if (enabled.accounting && data.financial_position) {
      const payable = Number(data.financial_position.accounts_payable);
      const bank = Number(data.financial_position.bank_balance);
      if (payable > 0 && payable > bank) risks.push({ area: "Accounting", accent: "accounting", signal: "Payables exceed registered bank balance", value: formatAmount(data.financial_position.accounts_payable, currency), severity: "danger", href: "/accounting/payables" });
      else if (bank < 0) risks.push({ area: "Accounting", accent: "accounting", signal: "Registered bank balance is negative", value: formatAmount(data.financial_position.bank_balance, currency), severity: "danger", href: "/accounting/banking" });
    }
    if (enabled.accounting && latestPnl && Number(latestPnl.net_income) < 0) risks.push({ area: "Accounting", accent: "accounting", signal: "Net loss in the latest posted month", value: formatAmount(latestPnl.net_income, currency), severity: "danger", href: "/accounting/reports" });
  }

  const statusTotal = data?.by_status.reduce((total, item) => total + item.count, 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-brand-navy px-6 py-6 text-white shadow-elevation-2 sm:px-8 dark:bg-[#0b1a36] dark:ring-1 dark:ring-white/5">
        <span aria-hidden="true" className="bg-signature absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-support font-semibold text-accent-aqua">{data?.executive_title ?? "Executive"} dashboard</p>
            <h1 className="mt-1 text-title font-bold tracking-tight">Organization overview</h1>
            <p className="mt-1.5 max-w-2xl text-body text-white/70">Institution-wide workforce, operations and financial position from live tenant data.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-caption font-semibold text-white/90 ring-1 ring-inset ring-white/15">
            <span className={cx("h-2 w-2 rounded-full", loading ? "animate-pulse bg-warning" : "bg-success")} aria-hidden="true" />
            {loading ? "Refreshing" : "Live data"}
          </span>
        </div>
      </header>

      {error && <ErrorState variant="inline" title="Unable to load the executive dashboard" message={error} onRetry={reload} />}

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key indicators">
        <MetricCard label="Workforce" value={data ? formatNumber(data.total_employees) : EM_DASH} description={data ? `${formatNumber(data.active_employees)} active` : "Employee records"} icon={Users} accent="hr" loading={initial} href={enabled.hr ? "/hr/dashboard" : undefined} />
        {enabled.payroll && <MetricCard label="Finalized payroll cost" value={data ? formatAmount(data.payroll_cost, currency) : EM_DASH} description="Gross pay, finalized runs" icon={WalletCards} accent="payroll" loading={initial} size="sm" href="/payroll/dashboard" />}
        {enabled.accounting && (
          <MetricCard
            label="Net result"
            value={latestPnl ? formatAmount(latestPnl.net_income, currency) : EM_DASH}
            description="Latest posted month"
            icon={LineChartIcon}
            accent="accounting"
            loading={initial}
            size="sm"
            href="/accounting/dashboard"
            trend={netDelta !== null ? { direction: netDelta > 0 ? "up" : netDelta < 0 ? "down" : "flat", label: `${netDelta >= 0 ? "+" : ""}${formatAmount(netDelta, currency)} vs prior` } : undefined}
          />
        )}
        {enabled.leave && <MetricCard label="Pending leave" value={data ? formatNumber(data.pending_leave_requests) : EM_DASH} description="Awaiting a decision" icon={CalendarDays} accent="leave" loading={initial} href="/leave/dashboard" />}
        {!enabled.leave && enabled.recruitment && <MetricCard label="Open roles" value={data?.recruitment_summary ? formatNumber(data.recruitment_summary.open_jobs) : EM_DASH} description="Published job postings" icon={Briefcase} accent="recruitment" loading={initial} href="/recruitment/dashboard" />}
      </section>

      {/* Financial + payroll trends */}
      {(enabled.accounting || enabled.payroll) && (
        <div className={cx("grid gap-5", enabled.accounting && enabled.payroll && "xl:grid-cols-5")}>
          {enabled.accounting && (
            <ChartCard
              className="xl:col-span-3"
              title="Financial performance"
              description="Monthly revenue, expenses and net result from posted ledger entries."
              accent="accounting"
              loading={initial}
              error={!data && error ? "This data is unavailable right now." : null}
              empty={!pnl.length}
              emptyDescription="Posted income and expense journals will appear here."
              legend={[{ label: "Revenue", color: "var(--chart-2)", shape: "line" }, { label: "Expenses", color: "var(--chart-6)", shape: "line" }, { label: "Net result", color: "var(--chart-1)", shape: "line" }]}
              summary={latestPnl ? `In the latest posted month revenue was ${formatAmount(latestPnl.income, currency)}, expenses ${formatAmount(latestPnl.expenses, currency)} and net result ${formatAmount(latestPnl.net_income, currency)}.` : undefined}
              data={{ columns: ["Month", "Revenue", "Expenses", "Net result"], rows: pnl.map((point) => [point.month, formatAmount(point.income, currency), formatAmount(point.expenses, currency), formatAmount(point.net_income, currency)]) }}
            >
              <TrendChart data={pnl} xKey="month" format="currency" currency={currency} height={260} zeroLine series={[{ key: "income", label: "Revenue", color: "var(--chart-2)" }, { key: "expenses", label: "Expenses", color: "var(--chart-6)" }, { key: "net_income", label: "Net result", color: "var(--chart-1)", dashed: true }]} />
            </ChartCard>
          )}
          {enabled.payroll && (
            <ChartCard
              className={enabled.accounting ? "xl:col-span-2" : undefined}
              title="Payroll cost"
              description="Gross pay by finalized payroll period."
              accent="payroll"
              loading={initial}
              error={!data && error ? "This data is unavailable right now." : null}
              empty={!payrollTrend.length}
              emptyDescription="Finalized payroll runs will appear here."
              data={{ columns: ["Period", "Gross pay"], rows: payrollTrend.map((point) => [point.label, formatAmount(point.gross_pay, currency)]) }}
            >
              <TrendChart variant="area" data={payrollTrend} xKey="label" xFormat="label" format="currency" currency={currency} height={260} series={[{ key: "gross_pay", label: "Gross pay", color: "var(--mod-payroll)" }]} />
            </ChartCard>
          )}
        </div>
      )}

      {/* Workforce, operations, hiring */}
      {/* Three cards fill one xl row; two or four balance better as a 2-column grid than leaving an orphan. */}
      <div className={cx("grid gap-5 lg:grid-cols-2", 1 + Number(Boolean(enabled.attendance)) + Number(Boolean(enabled.recruitment)) + Number(Boolean(enabled.accounting)) === 3 && "xl:grid-cols-3")}>
        <Card title="Workforce composition" description="Employee records by current status." icon={UserCheck} accent="hr">
          {initial ? <div className="skeleton h-24 rounded-xl" /> : statusTotal ? (
            <SegmentedBar height="h-3.5" segments={(data?.by_status ?? []).map((item) => ({ label: humanizeEnum(item.status), value: item.count, color: statusColors[item.status.toUpperCase()] }))} />
          ) : <p className="text-support text-ink-muted">No employee records yet.</p>}
        </Card>

        {enabled.attendance && (
          <Card title="Attendance today" description="Recorded attendance across the institution." icon={ClipboardList} accent="attendance">
            {initial ? <div className="skeleton h-24 rounded-xl" /> : data?.attendance_today ? (
              <SegmentedBar height="h-3.5" segments={[
                { label: "Present", value: data.attendance_today.present, color: "var(--success)" },
                { label: "Late", value: data.attendance_today.late, color: "var(--warning)" },
                { label: "Absent", value: data.attendance_today.absent, color: "var(--danger)" },
                { label: "On leave", value: data.attendance_today.on_leave, color: "var(--mod-leave)" },
              ]} />
            ) : <p className="text-support text-ink-muted">Attendance is unavailable.</p>}
          </Card>
        )}

        {enabled.recruitment && (
          <Card title="Hiring activity" description="Applications through to offers." icon={Briefcase} accent="recruitment" actions={<Link href="/recruitment/dashboard" className="text-support font-semibold text-primary-ink hover:underline">Details</Link>}>
            {initial ? <div className="skeleton h-28 rounded-xl" /> : data?.recruitment_summary ? (
              <>
                <FunnelChart stages={[
                  { label: "Applications", value: data.recruitment_summary.applications },
                  { label: "Interviews", value: data.recruitment_summary.scheduled_interviews },
                  { label: "Offers", value: data.recruitment_summary.offers_extended },
                ]} />
                <p className="mt-3 text-caption text-ink-muted">{formatNumber(data.recruitment_summary.open_jobs)} open roles · {formatNumber(data.recruitment_summary.active_candidates)} active candidates</p>
              </>
            ) : <p className="text-support text-ink-muted">Recruitment activity is unavailable.</p>}
          </Card>
        )}

        {enabled.accounting && (
          <SummaryCard
            title="Financial position"
            description="Operational balances and registered-bank ledger balance."
            icon={Landmark}
            accent="accounting"
            items={data?.financial_position ? [
              { label: "Bank balance", value: formatAmount(data.financial_position.bank_balance, currency), hint: formatCount(data.financial_position.registered_bank_accounts, "active account") },
              { label: "Accounts receivable", value: formatAmount(data.financial_position.accounts_receivable, currency) },
              { label: "Accounts payable", value: formatAmount(data.financial_position.accounts_payable, currency) },
              { label: "Posted expenses", value: formatAmount(data.financial_position.posted_expenses, currency) },
            ] : [{ label: initial ? "Loading…" : "Financial position is unavailable.", value: "" }]}
          />
        )}
      </div>

      {/* Attention & risk */}
      <Card title="Attention & risk" description="Signals from enabled modules that may need an executive decision." icon={ShieldAlert} accent="audit" padding="none" className="[&>div:first-child]:px-5 [&>div:first-child]:pt-5">
        {initial ? (
          <div className="space-y-2 p-5 pt-0">{[0, 1, 2].map((index) => <div key={index} className="skeleton h-11 rounded-lg" />)}</div>
        ) : risks.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Attention and risk signals</caption>
              <thead>
                <tr className="border-y border-line-soft bg-surface-muted/60 text-left text-caption font-semibold text-ink-muted">
                  <th scope="col" className="px-5 py-2.5">Area</th>
                  <th scope="col" className="px-5 py-2.5">Signal</th>
                  <th scope="col" className="px-5 py-2.5">Severity</th>
                  <th scope="col" className="px-5 py-2.5 text-right">Value</th>
                  <th scope="col" className="px-5 py-2.5"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {risks.map((risk) => (
                  <tr key={`${risk.area}-${risk.signal}`} className="border-b border-line-soft last:border-0 hover:bg-surface-hover">
                    <td className="px-5 py-3"><span className="inline-flex items-center gap-2 font-medium text-ink-strong"><span aria-hidden="true" className={cx("h-2 w-2 rounded-full", moduleAccents[risk.accent].solid)} />{risk.area}</span></td>
                    <td className="px-5 py-3 text-ink">{risk.signal}</td>
                    <td className="px-5 py-3"><Badge tone={risk.severity} size="sm">{risk.severity === "danger" ? "High" : risk.severity === "warning" ? "Medium" : "Watch"}</Badge></td>
                    <td className="px-5 py-3 text-right font-semibold text-ink-strong tabular-nums">{risk.value}</td>
                    <td className="px-5 py-3 text-right"><Link href={risk.href} className="inline-flex items-center gap-1 text-support font-semibold text-primary-ink hover:underline">Review<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 pb-5 text-support text-ink-muted">No risk signals from enabled modules right now.</p>
        )}
      </Card>
    </div>
  );
}
