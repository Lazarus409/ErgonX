"use client";

import Link from "next/link";
import { ArrowRight, CircleDollarSign, FileText } from "lucide-react";
import { useCallback } from "react";

import { DataTable } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import { payrollApi } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";

export default function MyPayslipsPage() {
  const load = useCallback(() => payrollApi.listPayslips({ page_size: MAX_PAGE_SIZE, ordering: "-generated_at" }), []);
  const { data, loading, error, reload } = useApiResource(load);
  const payslips = data?.results ?? [];
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="My payslips" description="View your available payroll statements." icon={CircleDollarSign} accent="payroll" />
      <DataTable
        caption="My payslips"
        rows={payslips}
        rowKey={(item) => item.id}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        minWidth={560}
        empty={{ title: "No payslips yet", description: "Your payslips appear here after your first finalized payroll.", icon: FileText }}
        columns={[
          { key: "period", header: "Period", sortValue: (item) => item.payroll_period.pay_date, cell: (item) => <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-mod-payroll-soft text-mod-payroll" aria-hidden="true"><FileText className="h-4 w-4" /></span><span className="font-semibold text-ink-strong">{item.payroll_period.name}</span></span> },
          { key: "paydate", header: "Pay date", sortValue: (item) => item.payroll_period.pay_date, cell: (item) => formatDate(item.payroll_period.pay_date) },
          { key: "net", header: "Net pay", numeric: true, sortValue: (item) => Number(item.payload.net_pay), cell: (item) => <span className="font-semibold text-ink-strong">{formatAmount(item.payload.net_pay, item.payload.currency)}</span> },
          { key: "view", header: <span className="sr-only">View</span>, cell: (item) => <div className="flex justify-end"><Link href={`/payroll/payslips/${item.id}`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-support font-semibold text-primary-ink hover:bg-primary-soft">View<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></div> },
        ]}
      />
    </div>
  );
}
