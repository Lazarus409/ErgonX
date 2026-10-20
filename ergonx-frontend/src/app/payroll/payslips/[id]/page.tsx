"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Download, FileText, Lock, Printer } from "lucide-react";

import DocumentFrame from "@/components/brand/DocumentFrame";
import HelpTip from "@/components/help/HelpTip";
import { useAuth } from "@/components/guards/AuthProvider";
import BackNavigation from "@/components/ui/BackNavigation";
import { Button } from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { employeesApi, imagesApi, payrollApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api/client";
import { saveBlob } from "@/lib/api/policies";
import { EM_DASH, formatAmount, formatDate, formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { PayslipItem } from "@/types/payroll";

export default function PayslipDetailPage() {
  const { institution } = useAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const load = useCallback(async () => { const payslip = await payrollApi.getPayslip(id); const employee = await employeesApi.getEmployee(payslip.payload.employee_id).catch(() => null); return { payslip, employee }; }, [id]);
  const { data, loading, error, reload } = useApiResource(load);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  if (loading) return <LoadingState variant="detail" label="Loading payslip" />;
  if (error || !data) return <ErrorState title="Unable to load payslip" message={error ?? "This payslip could not be found."} onRetry={reload} />;
  const { payslip, employee } = data;
  const period = payslip.payroll_period;
  if (!period) return <ErrorState title="Payslip details are incomplete" message="The payroll period was not returned by the server." onRetry={reload} />;
  const earnings = payslip.payload.items.filter((item) => item.metadata.effect === "EARNING");
  const deductions = payslip.payload.items.filter((item) => item.metadata.effect === "DEDUCTION" || item.metadata.effect === "EMPLOYEE_CONTRIBUTION");
  const currency = payslip.payload.currency;
  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try { await saveBlob(await payrollApi.downloadPayslipPdf(payslip.id), payrollApi.payslipPdfFilename(period.name)); }
    catch (caught) { setDownloadError(getApiErrorMessage(caught)); }
    finally { setDownloading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          back={<BackNavigation fallback="/payroll/payslips" label="Back to payslips" />}
          title={`Payslip — ${period.name}`}
          description={`Generated ${formatDateTime(payslip.generated_at)} from a finalized payroll record.`}
          icon={FileText}
          accent="payroll"
          actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" leadingIcon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button><Button leadingIcon={<Download className="h-4 w-4" />} loading={downloading} onClick={() => void download()}>Download PDF</Button></div>}
        />
        {downloadError && <p role="alert" className="mt-2 text-sm text-danger-ink">Could not download the PDF: {downloadError}</p>}
      </div>

      <DocumentFrame
        institutionName={institution?.name ?? "Institution"}
        institutionLogoSrc={institution?.logoImageId ? imagesApi.imageContentUrl(institution.logoImageId) : null}
        documentTitle="Employee payslip"
        meta={<><p className="font-semibold text-ink-strong">{period.name}</p><p className="text-ink-muted">Pay date: {formatDate(period.pay_date)}</p></>}
        footerNote={<span className="inline-flex items-center gap-2"><Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Generated from a finalized payroll record. Historical payroll data is immutable.</span>}
      >
        <div className="grid gap-6 border-b border-line-soft px-6 py-6 sm:grid-cols-2 sm:px-8">
          <Detail label="Employee" value={employee ? employeesApi.employeeDisplayName(employee) : EM_DASH} subvalue={employee?.employee_number} />
          <Detail label="Payroll period" value={`${formatDate(period.start_date)} – ${formatDate(period.end_date)}`} />
        </div>
        <div className="grid gap-8 px-6 py-6 md:grid-cols-2 sm:px-8">
          <ItemGroup title="Earnings" items={earnings} currency={currency} totalLabel={<>Gross pay<HelpTip term="gross_pay" /></>} total={payslip.payload.gross_pay} />
          <ItemGroup title="Deductions" items={deductions} currency={currency} totalLabel={<>Total deductions<HelpTip term="deductions" /></>} total={payrollApi.payslipWithheld(payslip.payload)} />
        </div>
        <div className="mx-6 mb-6 flex items-center justify-between rounded-xl bg-brand-navy px-5 py-4 text-white sm:mx-8 print:border print:border-black print:bg-transparent print:text-black">
          <span className="font-semibold">Net pay<span className="print:hidden"><HelpTip term="net_pay" /></span></span>
          <span className="text-kpi-sm font-bold tabular-nums">{formatAmount(payslip.payload.net_pay, currency)}</span>
        </div>
      </DocumentFrame>
    </div>
  );
}

function Detail({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return <div><p className="text-caption font-medium text-ink-muted">{label}</p><p className="mt-1 font-semibold text-ink-strong">{value}</p>{subvalue && <p className="text-support text-ink-muted">{subvalue}</p>}</div>;
}

function ItemGroup({ title, items, currency, totalLabel, total }: { title: string; items: PayslipItem[]; currency: string; totalLabel: React.ReactNode; total: string }) {
  return (
    <div>
      <h3 className="mb-3 text-card-title font-bold text-ink-strong">{title}</h3>
      <dl className="space-y-2.5 text-sm">
        {items.map((item, index) => <div key={`${item.code}-${index}`} className="flex justify-between gap-3"><dt className="text-ink">{item.name}</dt><dd className="tabular-nums text-ink-strong">{formatAmount(item.amount, currency)}</dd></div>)}
        {!items.length && <p className="text-ink-muted">No {title.toLowerCase()} entries.</p>}
      </dl>
      <div className="mt-4 flex justify-between border-t border-line pt-3 font-bold text-ink-strong"><span>{totalLabel}</span><span className="tabular-nums">{formatAmount(total, currency)}</span></div>
    </div>
  );
}
