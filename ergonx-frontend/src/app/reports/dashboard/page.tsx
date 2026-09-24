"use client";

import { Download, FileBarChart } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { apiDownload, getApiErrorMessage, reportsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import { useAuth } from "@/components/guards/AuthProvider";
import { hasModule } from "@/types/institutions";

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
  return <main className="mx-auto max-w-7xl space-y-6"><PageHeader title="Reports & analytics" description="Institution-scoped operational summaries. CSV is the currently supported export format." actions={<button type="button" disabled={downloading || !visibleReports.length} onClick={() => void download()} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" />{downloading ? "Preparing CSV…" : "Download CSV"}</button>} />{(error || downloadError) && <ErrorState message={error ?? downloadError ?? "Unable to load reports."} onRetry={reload} />}{!visibleReports.length ? <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">No reports are available for your current permissions and enabled modules.</p> : <><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{visibleReports.map((item) => <button type="button" key={item.id} onClick={() => { setSelected(item.id); setStatus(""); }} className={`rounded-2xl border bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm ${selected === item.id ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`}><FileBarChart className={`h-5 w-5 ${selected === item.id ? "text-indigo-700" : "text-slate-500"}`} /><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{item.group}</p><p className="mt-1 font-semibold text-slate-950">{item.title}</p></button>)}</section><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-end"><div><h2 className="font-semibold text-slate-950">{report?.title}</h2><p className="mt-1 text-sm text-slate-500">Live server-owned summary. CSV includes the selected filters.</p></div><div className="flex flex-wrap items-end gap-3">{supportsStatus && <label className="text-sm font-medium text-slate-700">Status<input value={status} onChange={(event) => setStatus(event.target.value.toUpperCase())} placeholder="Filter status" className="mt-1 block h-10 rounded-xl border border-slate-300 px-3 text-sm font-normal" /></label>}<label className="text-sm font-medium text-slate-700">From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="mt-1 block h-10 rounded-xl border border-slate-300 px-3 text-sm font-normal" /></label><label className="text-sm font-medium text-slate-700">To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="mt-1 block h-10 rounded-xl border border-slate-300 px-3 text-sm font-normal" /></label></div><span className="text-sm text-slate-500">{data?.rows.length ?? 0} rows</span></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead className="bg-slate-50"><tr className="text-left text-xs uppercase tracking-wide text-slate-500">{columns.map((column) => <th key={column} className="px-5 py-3 font-semibold">{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data?.rows.map((row, index) => <tr key={index} className="hover:bg-slate-50">{columns.map((column) => <td key={column} className="px-5 py-4 text-slate-700">{row[column] ?? "—"}</td>)}</tr>)}</tbody></table></div>{loading && <p className="py-10 text-center text-sm text-slate-500">Loading report…</p>}{!loading && !data?.rows.length && <p className="py-10 text-center text-sm text-slate-500">No report rows found for this institution.</p>}</section></> }</main>;
}
