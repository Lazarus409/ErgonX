"use client";

import Link from "next/link";
import { useCallback, useState, type ChangeEvent } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Upload, Users } from "lucide-react";

import { useAuth } from "@/components/guards/AuthProvider";
import AccessDenied from "@/components/ui/AccessDenied";
import Alert from "@/components/ui/Alert";
import BackNavigation from "@/components/ui/BackNavigation";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import { operationsApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api/client";
import { saveBlob } from "@/lib/api/policies";
import { useApiResource } from "@/lib/useApiResource";
import type { ImportJob, ImportRowResult } from "@/types/operations";

const STATUS_TONES = { VALID: "success", INVALID: "danger", IMPORTED: "success", SKIPPED: "warning" } as const;
const STATUS_LABELS = { VALID: "Ready", INVALID: "Has errors", IMPORTED: "Imported", SKIPPED: "Skipped" } as const;

function personName(row: ImportRowResult) {
  return [row.raw_data.first_name, row.raw_data.last_name].filter(Boolean).join(" ") || "—";
}

/** Bulk employee import: download the template, upload it, review each row, then confirm. */
export default function EmployeeImportPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const allowed = permissions.includes("*") || (permissions.includes("import_job.create") && permissions.includes("employee.create"));
  const loadColumns = useCallback(() => operationsApi.getEmployeeImportColumns(), []);
  const { data: columns } = useApiResource(loadColumns);
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [rows, setRows] = useState<ImportRowResult[]>([]);
  const [busy, setBusy] = useState<"template" | "upload" | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!allowed) return <AccessDenied />;

  const downloadTemplate = async () => {
    setBusy("template"); setError(null);
    try { await saveBlob(await operationsApi.downloadEmployeeImportTemplate(), "ergonx-employee-import-template.csv"); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(null); }
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    setJob(null); setRows([]); setError(null);
  };

  const upload = async () => {
    if (!file) return;
    setBusy("upload"); setError(null);
    try {
      const checked = await operationsApi.uploadEmployeeImport(file);
      setJob(checked);
      setRows(await operationsApi.listImportRows(checked.id));
    } catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(null); }
  };

  const confirm = async () => {
    if (!job) return;
    setBusy("confirm"); setError(null);
    try {
      const done = await operationsApi.confirmImportJob(job.id);
      setJob(done);
      setRows(await operationsApi.listImportRows(done.id));
    } catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(null); setConfirming(false); }
  };

  const completed = job?.status === "COMPLETED";
  const problems = rows.filter((row) => row.errors.length);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        back={<BackNavigation fallback="/hr/employees" label="Back to employees" />}
        title="Import employees"
       
        icon={Users}
        accent="hr"
      />

      {error && <Alert tone="danger" title="Something went wrong" onDismiss={() => setError(null)}>{error}</Alert>}

      <Card title="1. Fill in the template" description="One row per employee. Departments, positions, grades, locations and salary structures must already exist; match them by name or code." icon={FileSpreadsheet} accent="hr"
        actions={<Button variant="secondary" leadingIcon={<Download className="h-4 w-4" />} loading={busy === "template"} onClick={() => void downloadTemplate()}>Download template</Button>}>
        <p className="px-5 pb-3 text-support text-ink-muted">Open the template in Excel or Google Sheets, replace the example row, then save as CSV or Excel (.xlsx). Up to 1,000 rows per file.</p>
        {columns && (
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[560px] text-left text-support">
              <thead><tr className="border-b border-line text-caption uppercase tracking-[0.06em] text-ink-muted"><th className="py-2 pr-4 font-semibold">Column</th><th className="py-2 font-semibold">What to enter</th></tr></thead>
              <tbody className="divide-y divide-line-soft">
                {columns.map((column) => (
                  <tr key={column.name}>
                    <td className="py-2 pr-4 font-mono text-caption text-ink-strong">{column.name}{column.required && <span className="ml-1 text-danger-ink" aria-label="required">*</span>}</td>
                    <td className="py-2 text-ink">{column.help || "Optional"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="2. Upload and check" description="Nothing is saved yet. You will see any problems row by row." icon={Upload} accent="hr">
        <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
          <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={chooseFile} disabled={busy !== null || completed}
            aria-label="Employee file" className="block max-w-full text-sm text-ink file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink-strong hover:file:bg-surface-muted" />
          <Button leadingIcon={<Upload className="h-4 w-4" />} disabled={!file || completed} loading={busy === "upload"} onClick={() => void upload()}>Check file</Button>
        </div>
      </Card>

      {job && (
        <Card title={completed ? "Import finished" : "3. Review and import"} icon={completed ? CheckCircle2 : Users} accent="hr"
          description={completed ? `${job.valid_rows} employee${job.valid_rows === 1 ? "" : "s"} added.` : `${job.total_rows} row${job.total_rows === 1 ? "" : "s"} checked in ${job.file_reference}.`}
          actions={completed
            ? <Link href="/hr/employees" className={buttonClasses({ variant: "primary" })}>Go to employees</Link>
            : <Button disabled={!job.valid_rows} loading={busy === "confirm"} onClick={() => setConfirming(true)}>Import {job.valid_rows} employee{job.valid_rows === 1 ? "" : "s"}</Button>}>
          <div className="space-y-3 px-5 pb-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="success" dot>{completed ? `${job.valid_rows} imported` : `${job.valid_rows} ready`}</Badge>
              {job.invalid_rows > 0 && <Badge tone="danger" dot>{job.invalid_rows} {completed ? "not imported" : "with errors"}</Badge>}
            </div>
            {!completed && job.invalid_rows > 0 && job.valid_rows > 0 && <Alert tone="warning">Rows with errors will be skipped. To include them, fix the file and check it again before importing.</Alert>}
            {!job.valid_rows && <Alert tone="danger">No row can be imported. Fix the errors below and upload the file again.</Alert>}
            {job.metadata?.salary_warning && <Alert tone="warning">{job.metadata.salary_warning}</Alert>}
            {!!job.metadata?.ignored_columns?.length && <Alert tone="info">These columns are not part of the template and were ignored: {job.metadata.ignored_columns.join(", ")}.</Alert>}
            {completed && <Alert tone="success">New employees have no sign-in yet. Invite them to self-service from their employee record.</Alert>}
          </div>
          <DataTable
            caption="Rows"
            rows={problems.length && !completed ? [...problems, ...rows.filter((row) => !row.errors.length)] : rows}
            rowKey={(row) => row.id}
            minWidth={640}
            columns={[
              { key: "row", header: "Row", numeric: true, cell: (row) => row.row_number },
              { key: "name", header: "Employee", cell: (row) => <span className="font-semibold text-ink-strong">{personName(row)}</span> },
              { key: "number", header: "Number", hideBelow: "md", cell: (row) => row.normalized_data.employee_number || <span className="text-ink-muted">Generated</span> },
              { key: "status", header: "Status", cell: (row) => <Badge size="sm" tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge> },
              { key: "errors", header: "Problems", cell: (row) => row.errors.length ? <ul className="list-disc space-y-0.5 pl-4 text-danger-ink">{row.errors.map((message) => <li key={message}>{message}</li>)}</ul> : <span className="text-ink-muted">None</span> },
            ]}
            empty={{ title: "No rows", description: "The file had no employee rows." }}
          />
        </Card>
      )}

      <ConfirmDialog
        open={confirming}
        title={`Import ${job?.valid_rows ?? 0} employees?`}
        description="Each valid row creates an employee with a current employment record, plus pay and tax ID where given. Rows with errors are skipped."
        confirmLabel="Import"
        loading={busy === "confirm"}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
