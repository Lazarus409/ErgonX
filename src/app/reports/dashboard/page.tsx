"use client";

import { BarChart3, Briefcase, CalendarDays, Clock3, Download, FileBarChart, Receipt, Scale, Users, WalletCards, type LucideIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import ChartCard from "@/components/charts/ChartCard";
import { BarsChart } from "@/components/charts/Charts";
import { Button } from "@/components/ui/Button";
import { DataTable, DataToolbar } from "@/components/ui/DataTable";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { apiDownload, getApiErrorMessage, reportsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import { useAuth } from "@/components/guards/AuthProvider";
import { hasModule } from "@/types/institutions";
import { cx } from "@/lib/cx";
import { moduleAccents, type ModuleAccent } from "@/lib/moduleTheme";
import { humanizeEnum } from "@/lib/format";

const reports = [
  { id: "workforce-cost", title: "Workforce Cost", group: "Workforce", module: "CORE_HR" },
  { id: "recruitment", title: "Recruitment Activity", group: "Recruitment", module: "RECRUITMENT" },
  { id: "leave", title: "Leave Activity", group: "Leave", module: "LEAVE" },
  { id: "attendance", title: "Attendance", group: "Attendance", module: "ATTENDANCE" },
  { id: "payroll", title: "Payroll", group: "Payroll", module: "PAYROLL" },
  { id: "accounting", title: "Journal Activity", group: "Accounting", module: "ACCOUNTING" },
  { id: "ap-ar", title: "AP / AR", group: "Accounting", module: "ACCOUNTING" },
  { id: "expenses", title: "Expenses", group: "Accounting", module: "ACCOUNTING" },
] as const;
type ReportId = typeof reports[number]["id"];

const reportVisuals: Record<ReportId, { icon: LucideIcon; accent: ModuleAccent }> = {
  "workforce-cost": { icon: Users, accent: "hr" },
  recruitment: { icon: Briefcase, accent: "recruitment" },
  leave: { icon: CalendarDays, accent: "leave" },
  attendance: { icon: Clock3, accent: "attendance" },
  payroll: { icon: WalletCards, accent: "payroll" },
  accounting: { icon: Scale, accent: "accounting" },
  "ap-ar": { icon: FileBarChart, accent: "accounting" },
  expenses: { icon: Receipt, accent: "accounting" },
};

type ReportRow = Record<string, string | number | null>;

export default function ReportsDashboardPage() {
  const { institution, user } = useAuth();
  const visibleReports = useMemo(() => reports.filter((item) => hasModule(institution?.enabledModules, item.module) && (user?.permissions.includes("*") || user?.permissions.includes("report.view"))), [institution?.enabledModules, user?.permissions]);
  const [selected, setSelected] = useState<ReportId>("workforce-cost");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const activeSelected = visibleReports.some((item) => item.id === selected) ? selected : (visibleReports[0]?.id ?? selected);
  const supportsStatus = activeSelected !== "ap-ar";
  const filters = useMemo(() => ({ ...(supportsStatus ? { status: status || undefined } : {}), date_from: dateFrom || undefined, date_to: dateTo || undefined }), [supportsStatus, status, dateFrom, dateTo]);
  const load = useCallback(() => visibleReports.length ? reportsApi.getReport(activeSelected, filters) : Promise.resolve({ report: activeSelected, rows: [] }), [activeSelected, filters, visibleReports.length]);
  const { data, loading, error, reload } = useApiResource(load);
  const columns = useMemo(() => Array.from(new Set((data?.rows ?? []).flatMap((row) => Object.keys(row)))), [data]);
  const report = visibleReports.find((item) => item.id === activeSelected) ?? visibleReports[0];
  const download = async () => {
    setDownloading(true); setDownloadError(null);
    try {
      const blob = await apiDownload(`/reports/${activeSelected}/`, { export: "csv", ...filters });
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `ergonx-${activeSelected}${status ? `-${status.toLowerCase()}` : ""}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (caught) { setDownloadError(getApiErrorMessage(caught)); }
    finally { setDownloading(false); }
  };
  const isNumericColumn = (column: string) => (data?.rows ?? []).length > 0 && (data?.rows ?? []).every((row) => row[column] === null || row[column] === undefined || typeof row[column] === "number" || (typeof row[column] === "string" && /^-?\d+(\.\d+)?$/.test(String(row[column]))));

  // At-a-glance visual: the first descriptive column against the first measure.
  const labelColumn = columns.find((column) => !isNumericColumn(column));
  const valueColumn = columns.find((column) => isNumericColumn(column) && !/(^|_)(id|year|month|day)$/.test(column));
  const chartRows = labelColumn && valueColumn
    ? (data?.rows ?? []).filter((row) => row[valueColumn] !== null && row[valueColumn] !== undefined).slice(0, 12).map((row) => ({ label: String(row[labelColumn] ?? "—"), value: Number(row[valueColumn]) }))
    : [];
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Reports & Analytics"
        title="Reports & analytics"
        description="Institution-scoped operational summaries. CSV is the currently supported export format."
        icon={BarChart3}
        accent="reports"
        actions={<Button disabled={!visibleReports.length} loading={downloading} loadingLabel="Preparing CSV…" onClick={() => void download()} leadingIcon={<Download className="h-4 w-4" />}>Download CSV</Button>}
      />
      {downloadError && <ErrorState variant="inline" title="Unable to export this report" message={downloadError} />}
      {!visibleReports.length ? (
        <EmptyState icon={BarChart3} accent="reports" title="No reports available" description="No reports are available for your current permissions and enabled modules." />
      ) : (
        <>
          <section aria-label="Choose a report" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleReports.map((item) => {
              const visual = reportVisuals[item.id];
              const Icon = visual.icon;
              const active = activeSelected === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={active}
                  onClick={() => { setSelected(item.id); setStatus(""); }}
                  className={cx(
                    "group relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-surface p-4 text-left shadow-elevation-1 transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:shadow-elevation-2",
                    active ? "border-mod-reports ring-4 ring-mod-reports/12" : "border-line",
                  )}
                >
                  <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", moduleAccents[visual.accent].tile)} aria-hidden="true"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-caption font-medium text-ink-muted">{item.group}</span>
                    <span className="block truncate text-sm font-semibold text-ink-strong">{item.title}</span>
                  </span>
                </button>
              );
            })}
          </section>

          {labelColumn && valueColumn && chartRows.length >= 2 && (
            <ChartCard
              title={`${report?.title ?? "Report"} at a glance`}
              description={`${humanizeEnum(valueColumn)} by ${humanizeEnum(labelColumn).toLowerCase()}${(data?.rows.length ?? 0) > chartRows.length ? `, first ${chartRows.length} rows` : ""}.`}
              accent="reports"
              icon={BarChart3}
              data={{ columns: [humanizeEnum(labelColumn), humanizeEnum(valueColumn)], rows: chartRows.map((row) => [row.label, row.value]) }}
            >
              <BarsChart data={chartRows} xKey="label" layout="horizontal" height={Math.max(160, chartRows.length * 36)} series={[{ key: "value", label: humanizeEnum(valueColumn), color: "var(--mod-reports)" }]} />
            </ChartCard>
          )}

          <DataTable<ReportRow>
            caption={report?.title ?? "Report"}
            rows={data?.rows}
            rowKey={(_, index) => `${activeSelected}-${index}`}
            loading={loading}
            error={error}
            onRetry={reload}
            minWidth={Math.max(600, columns.length * 140)}
            empty={{ title: "No report rows", description: "No report rows found for this institution and filter selection.", icon: FileBarChart }}
            toolbar={
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-card-title font-semibold text-ink-strong">{report?.title}</h2>
                    <p className="text-support text-ink-muted">Live server-owned summary. CSV includes the selected filters.</p>
                  </div>
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-caption font-semibold text-ink-muted tabular-nums">{data?.rows.length ?? 0} rows</span>
                </div>
                <DataToolbar
                  filters={
                    <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto">
                      {supportsStatus && <Field label="Status"><Input size="sm" value={status} onChange={(event) => setStatus(event.target.value.toUpperCase())} placeholder="e.g. APPROVED" /></Field>}
                      <Field label="From"><Input size="sm" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></Field>
                      <Field label="To"><Input size="sm" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></Field>
                    </div>
                  }
                  onClear={status || dateFrom || dateTo ? () => { setStatus(""); setDateFrom(""); setDateTo(""); } : undefined}
                />
              </div>
            }
            columns={columns.map((column) => ({
              key: column,
              header: humanizeEnum(column),
              numeric: isNumericColumn(column),
              sortValue: (row: ReportRow) => {
                const value = row[column];
                return typeof value === "number" ? value : value !== null && /^-?\d+(\.\d+)?$/.test(String(value)) ? Number(value) : value;
              },
              cell: (row: ReportRow) => (row[column] ?? "—") as React.ReactNode,
            }))}
          />
        </>
      )}
    </div>
  );
}
