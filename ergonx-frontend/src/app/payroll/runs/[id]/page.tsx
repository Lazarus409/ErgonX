"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Calculator, CheckCircle2, Lock, Send, XCircle } from "lucide-react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { useAuth } from "@/components/guards/AuthProvider";
import { getApiErrorMessage, payrollApi } from "@/lib/api";
import { EM_DASH, formatAmount, formatDateTime } from "@/lib/format";
import { MAX_PAGE_SIZE } from "@/types/api";
import { hasModule } from "@/types/institutions";
import type { PayrollPeriod, PayrollRecord, PayrollReconciliation, PayrollRun } from "@/types/payroll";

type Action = "calculate" | "submit" | "approve" | "finalize" | "cancel" | "generateJournal";

const workflow = ["DRAFT", "CALCULATING", "CALCULATED", "UNDER_REVIEW", "APPROVED", "FINALIZED"];

const actionCopy: Record<Action, { label: string; title: string; description: string; destructive?: boolean }> = {
  calculate: { label: "Calculate", title: "Calculate payroll run", description: "Calculate eligible employee records using the configured backend rules." },
  submit: { label: "Submit for Review", title: "Submit payroll run for review", description: "Move this calculated run into the approval workflow." },
  approve: { label: "Approve", title: "Approve payroll run", description: "Approve this run after the backend validates reconciliation." },
  finalize: { label: "Finalize", title: "Finalize payroll run", description: "Finalization closes the period and makes payroll records immutable.", destructive: true },
  cancel: { label: "Cancel Run", title: "Cancel payroll run", description: "Cancel this pre-approval run. This action cannot be undone.", destructive: true },
  generateJournal: { label: "Generate Accounting Journal", title: "Generate accounting journal", description: "Create the linked draft journal. It must still go through the Accounting approval and posting workflow." },
};

export default function PayrollRunDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, institution } = useAuth();
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [reconciliation, setReconciliation] = useState<PayrollReconciliation | null>(null);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReconciliationError(null);
    try {
      const nextRun = await payrollApi.getPayrollRun(params.id);
      const [nextPeriod, recordPage, nextReconciliation] = await Promise.all([
        payrollApi.getPayrollPeriod(nextRun.payroll_period),
        payrollApi.listPayrollRecords({ payroll_run: nextRun.id, page_size: MAX_PAGE_SIZE, ordering: "employee" }),
        payrollApi.getPayrollRunReconciliation(nextRun.id).catch((caught) => {
          setReconciliationError(getApiErrorMessage(caught));
          return null;
        }),
      ]);
      setRun(nextRun);
      setPeriod(nextPeriod);
      setRecords(recordPage.results);
      setReconciliation(nextReconciliation);
      if (nextReconciliation) setReconciliationError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const executeAction = async () => {
    if (!pendingAction || !run) return;
    setActing(true);
    try {
      const actions: Record<Exclude<Action, "generateJournal">, (id: string) => Promise<PayrollRun>> = {
        calculate: payrollApi.calculatePayrollRun,
        submit: payrollApi.submitPayrollRunForReview,
        approve: payrollApi.approvePayrollRun,
        finalize: payrollApi.finalizePayrollRun,
        cancel: payrollApi.cancelPayrollRun,
      };
      if (pendingAction === "generateJournal") {
        await payrollApi.generatePayrollAccountingJournal(run.id);
      } else {
        await actions[pendingAction](run.id);
      }
      setPendingAction(null);
      await load();
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setPendingAction(null);
    } finally {
      setActing(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !run) return <ErrorState title="Unable to load payroll run" message={error} onRetry={() => void load()} />;
  if (!run) return <ErrorState message="The payroll run could not be found." />;

  const statusIndex = workflow.indexOf(run.status);
  const hasPermission = (permission: string) => user?.permissions.includes("*") || user?.permissions.includes(permission);
  const isReconciled = reconciliation?.discrepancy_count === 0;
  const canGenerateJournal = hasPermission("journal.create") && hasModule(institution?.enabledModules, "ACCOUNTING");
  const actionCandidates: Action[] = run.status === "DRAFT" ? ["calculate", "cancel"] : run.status === "CALCULATED" ? ["submit", "cancel"] : run.status === "UNDER_REVIEW" ? ["approve", "cancel"] : run.status === "APPROVED" && isReconciled ? ["finalize"] : [];
  const actions = actionCandidates.filter((action) => {
    const permission = action === "approve" ? "payroll.approve" : action === "finalize" ? "payroll.finalize" : action === "generateJournal" ? "journal.create" : "payroll.prepare";
    return hasPermission(permission);
  });

  return (
    <main className="space-y-6">
      <PageHeader title={`Payroll Run #${run.run_number}`} description={period ? `${period.name} · Started ${formatDateTime(run.started_at)}` : "Review payroll results and workflow status."} actions={<Link href="/payroll/runs" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Back</Link>} />
      {error && <ErrorState title="Payroll action failed" message={error} onRetry={() => void load()} />}

      <div className="grid gap-4 md:grid-cols-5">
        <Metric label="Period" value={period?.name ?? EM_DASH} />
        <Metric label="Status" value={run.status} />
        <Metric label="Employees" value={String(reconciliation?.record_count ?? records.length)} />
        <Metric label="Gross Pay" value={reconciliation ? formatAmount(reconciliation.totals.gross_pay) : EM_DASH} />
        <Metric label="Net Pay" value={reconciliation ? formatAmount(reconciliation.totals.net_pay) : EM_DASH} />
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Payroll Workflow</h2><p className="mt-1 text-sm text-slate-500">Lifecycle state reported by the backend.</p></div><StatusBadge status={run.status} /></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-6">{workflow.map((step, index) => <div key={step} className={`rounded-xl border p-3 text-center text-xs font-semibold ${index === statusIndex ? "bg-slate-900 text-white" : index < statusIndex ? "bg-slate-100" : "bg-slate-50"}`}>{step.replace("_", " ")}</div>)}</div>
        {actions.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{actions.map((action) => { const icon = action === "calculate" ? <Calculator className="h-4 w-4" /> : action === "submit" ? <Send className="h-4 w-4" /> : action === "approve" || action === "finalize" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />; return <button key={action} type="button" onClick={() => setPendingAction(action)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">{icon}{actionCopy[action].label}</button>; })}</div>}
        {run.status === "APPROVED" && !isReconciled && <p className="mt-4 text-sm text-amber-700">Finalization remains unavailable until reconciliation completes without discrepancies.</p>}
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Reconciliation</h2><p className="mt-1 text-sm text-slate-500">Derived totals are checked by the backend before approval and finalization.</p></div>{reconciliation && <StatusBadge status={isReconciled ? "RECONCILED" : "DISCREPANCY"} />}</div>
        {reconciliationError ? <p className="mt-4 text-sm text-amber-700">Unable to load reconciliation: {reconciliationError}</p> : reconciliation ? <div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Records" value={String(reconciliation.record_count)} /><Metric label="Discrepancies" value={String(reconciliation.discrepancy_count)} /><Metric label="Result" value={isReconciled ? "Ready" : "Requires review"} /></div> : <p className="mt-4 text-sm text-slate-500">Reconciliation is not yet available for this run.</p>}
      </section>

      <section className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Employee Payroll Results</h2><p className="mt-1 text-sm text-slate-500">Read-only records calculated by the backend.</p></div>{run.status === "FINALIZED" && <span className="inline-flex items-center gap-2 text-xs font-semibold"><Lock className="h-4 w-4" />Read-only</span>}</div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-3">Employee</th><th className="pb-3">Gross</th><th className="pb-3">Deductions</th><th className="pb-3">Net Pay</th><th className="pb-3">Status</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b last:border-0"><td className="py-4 font-medium">{record.employee}</td><td className="py-4">{formatAmount(record.gross_pay, record.currency)}</td><td className="py-4">{formatAmount(record.total_deductions, record.currency)}</td><td className="py-4 font-semibold">{formatAmount(record.net_pay, record.currency)}</td><td className="py-4"><StatusBadge status={record.status} /></td></tr>)}</tbody></table>{records.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No payroll records have been calculated for this run.</p>}</div></section>

      <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Payroll to Accounting</h2><p className="mt-1 text-sm text-slate-500">{run.accounting_journal_entry ? "An accounting journal is linked to this payroll run." : run.status === "FINALIZED" && canGenerateJournal ? "Generate the idempotent draft journal, then submit, approve, and post it through Accounting." : "A draft accounting journal can only be generated from a finalized run by a user with Accounting journal-create access."}</p>{run.accounting_journal_entry && <Link href={`/accounting/journals/${run.accounting_journal_entry}`} className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:underline">Open accounting journal</Link>}{run.status === "FINALIZED" && !run.accounting_journal_entry && canGenerateJournal && <button type="button" onClick={() => setPendingAction("generateJournal")} className="mt-4 inline-flex rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">Generate Accounting Journal</button>}</section>

      {pendingAction && <ConfirmDialog open title={actionCopy[pendingAction].title} description={actionCopy[pendingAction].description} confirmLabel={actionCopy[pendingAction].label} destructive={actionCopy[pendingAction].destructive} loading={acting} onCancel={() => setPendingAction(null)} onConfirm={() => void executeAction()} />}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 break-words font-bold">{value}</p></div>; }
