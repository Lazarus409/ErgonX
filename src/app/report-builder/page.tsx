"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, GripVertical, Play, Plus, Save, Table2, Trash2, X } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import { getApiErrorMessage, reportBuilderApi } from "@/lib/api";
import { saveBlob } from "@/lib/api/policies";
import type { BuilderDataset, BuilderDefinition, BuilderFilter, BuilderResult, CustomReport } from "@/lib/api/reportBuilder";
import { cx } from "@/lib/cx";
import { useApiResource } from "@/lib/useApiResource";

const OPS: Record<BuilderFilter["op"], string> = { eq: "is", ne: "is not", contains: "contains", gt: "after / more than", gte: "on or after / at least", lt: "before / less than", lte: "on or before / at most" };
const blank = (): BuilderDefinition => ({ columns: [], filters: [], group_by: null, aggregate: { op: "count" }, sort: {}, limit: 500 });

/** Build a report from a dataset: pick and order columns, filter, optionally group, then export or save. */
export default function ReportBuilderPage() {
  const { showToast } = useToast();
  const load = useCallback(() => Promise.all([reportBuilderApi.datasets(), reportBuilderApi.listCustomReports()]), []);
  const { data, error, reload } = useApiResource(load);
  const datasets = useMemo(() => data?.[0].datasets ?? [], [data]);
  const saved = data?.[1].results ?? [];
  const [datasetKey, setDatasetKey] = useState("");
  const [definition, setDefinition] = useState<BuilderDefinition>(blank);
  const [result, setResult] = useState<BuilderResult | null>(null);
  const [current, setCurrent] = useState<CustomReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const [saving, setSaving] = useState<{ name: string; visibility: "PRIVATE" | "INSTITUTION" } | null>(null);

  const dataset: BuilderDataset | undefined = datasets.find((row) => row.key === datasetKey) ?? datasets[0];
  const fields = dataset?.fields ?? [];
  const fieldLabel = (key: string) => fields.find((field) => field.key === key)?.label ?? key;
  const set = (patch: Partial<BuilderDefinition>) => { setDefinition((value) => ({ ...value, ...patch })); setResult(null); };

  const pickDataset = (key: string) => { setDatasetKey(key); setDefinition(blank()); setResult(null); setCurrent(null); };
  const addColumn = (key: string) => !definition.columns.includes(key) && set({ columns: [...definition.columns, key] });
  const moveColumn = (from: number, to: number) => {
    const columns = [...definition.columns];
    const [moved] = columns.splice(from, 1);
    columns.splice(to, 0, moved);
    set({ columns });
  };

  const run = async () => {
    if (!dataset) return;
    setBusy(true); setRunError("");
    try { setResult(await reportBuilderApi.runReport(dataset.key, definition)); }
    catch (caught) { setRunError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };
  const exportCsv = async () => {
    if (!dataset) return;
    try { await saveBlob(await reportBuilderApi.exportReport(dataset.key, definition), `${current?.name ?? dataset.label}.csv`); }
    catch (caught) { setRunError(getApiErrorMessage(caught)); }
  };
  const open = (report: CustomReport) => { setDatasetKey(report.dataset); setDefinition({ ...blank(), ...report.definition }); setCurrent(report); setResult(null); };
  const save = async () => {
    if (!saving || !dataset) return;
    try {
      const report = await reportBuilderApi.saveCustomReport({ name: saving.name.trim(), description: "", dataset: dataset.key, definition, visibility: saving.visibility }, current?.is_owner ? current.id : undefined);
      setCurrent(report); setSaving(null); reload(); showToast({ tone: "success", message: "Report saved." });
    } catch (caught) { setRunError(getApiErrorMessage(caught)); setSaving(null); }
  };

  if (data && datasets.length === 0) {
    return <div className="mx-auto max-w-4xl"><EmptyState icon={Table2} title="No data to report on" description="The report builder uses the employee, leave, attendance, training and recruitment data your role can already see." /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader eyebrow="Reports" title="Report builder" icon={Table2} accent="brand" />
      {(error || runError) && <Alert tone="danger" onDismiss={runError ? () => setRunError("") : undefined}>{error || runError}</Alert>}
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title="Data" icon={Table2} accent="brand">
            <Field label="Dataset"><Select value={dataset?.key ?? ""} onChange={(event) => pickDataset(event.target.value)}>{datasets.map((row) => <option key={row.key} value={row.key}>{row.label}</option>)}</Select></Field>
            <p className="mt-3 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">Fields</p>
            <ul className="mt-1 space-y-1">
              {fields.map((field) => (
                <li key={field.key}>
                  <button type="button" draggable onDragStart={(event) => event.dataTransfer.setData("text/field", field.key)} onClick={() => addColumn(field.key)} disabled={definition.columns.includes(field.key)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-hover disabled:opacity-40">
                    <span>{field.label}</span><Plus className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {saved.length > 0 && (
            <Card title="Saved reports" icon={Save} accent="brand">
              <ul className="space-y-1">
                {saved.map((report) => (
                  <li key={report.id} className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => open(report)} className={cx("min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-sm hover:bg-surface-hover", current?.id === report.id && "bg-primary-soft font-semibold")}>{report.name}</button>
                    {report.visibility === "INSTITUTION" && <Badge size="sm">Shared</Badge>}
                    {report.is_owner && <IconButton size="sm" label={`Delete ${report.name}`} onClick={() => window.confirm(`Delete "${report.name}"?`) && void reportBuilderApi.deleteCustomReport(report.id).then(() => { if (current?.id === report.id) setCurrent(null); reload(); })}><Trash2 className="h-4 w-4" /></IconButton>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title={current ? current.name : "New report"} icon={Table2} accent="brand"
            actions={<span className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" leadingIcon={<Save className="h-4 w-4" />} disabled={!definition.columns.length} onClick={() => setSaving({ name: current?.is_owner ? current.name : "", visibility: current?.visibility ?? "PRIVATE" })}>{current?.is_owner ? "Save" : "Save as"}</Button><Button size="sm" variant="secondary" leadingIcon={<Download className="h-4 w-4" />} disabled={!definition.columns.length} onClick={() => void exportCsv()}>CSV</Button><Button size="sm" leadingIcon={<Play className="h-4 w-4" />} loading={busy} disabled={!definition.columns.length} onClick={() => void run()}>Run</Button></span>}>
            <div className="space-y-4">
              <section aria-label="Columns">
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">Columns · drag to reorder</p>
                <ol onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const key = event.dataTransfer.getData("text/field"); if (key) addColumn(key); }}
                  className="mt-1 flex min-h-12 flex-wrap gap-2 rounded-lg border border-dashed border-line p-2">
                  {definition.columns.length === 0 && <li className="self-center px-1 text-support text-ink-muted">Click or drag fields here.</li>}
                  {definition.columns.map((key, index) => (
                    <li key={key} draggable onDragStart={() => setDragging(index)} onDragEnd={() => setDragging(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); if (dragging !== null && dragging !== index) moveColumn(dragging, index); setDragging(null); }}
                      className={cx("inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-sm", dragging === index && "opacity-50")}>
                      <GripVertical className="h-3.5 w-3.5 cursor-grab text-ink-muted" aria-hidden="true" />{fieldLabel(key)}
                      <button type="button" aria-label={`Remove ${fieldLabel(key)}`} onClick={() => set({ columns: definition.columns.filter((column) => column !== key), group_by: definition.group_by === key ? null : definition.group_by })}><X className="h-3.5 w-3.5 text-ink-muted" /></button>
                    </li>
                  ))}
                </ol>
              </section>

              <section aria-label="Filters" className="space-y-2">
                <p className="text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted">Filters</p>
                {definition.filters.map((filter, index) => {
                  const type = fields.find((field) => field.key === filter.field)?.type;
                  return (
                    <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                      <Select aria-label="Field" value={filter.field} onChange={(event) => set({ filters: definition.filters.map((row, at) => (at === index ? { ...row, field: event.target.value } : row)) })}>{fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</Select>
                      <Select aria-label="Comparison" value={filter.op} onChange={(event) => set({ filters: definition.filters.map((row, at) => (at === index ? { ...row, op: event.target.value as BuilderFilter["op"] } : row)) })}>
                        {Object.entries(OPS).filter(([op]) => type === "date" || type === "number" || !["gt", "gte", "lt", "lte"].includes(op)).map(([op, label]) => <option key={op} value={op}>{label}</option>)}
                      </Select>
                      <Input aria-label="Value" type={type === "date" ? "date" : type === "number" ? "number" : "text"} value={filter.value} onChange={(event) => set({ filters: definition.filters.map((row, at) => (at === index ? { ...row, value: event.target.value } : row)) })} />
                      <IconButton label="Remove filter" onClick={() => set({ filters: definition.filters.filter((_, at) => at !== index) })}><Trash2 className="h-4 w-4" /></IconButton>
                    </div>
                  );
                })}
                <Button size="sm" variant="ghost" leadingIcon={<Plus className="h-4 w-4" />} disabled={!fields.length} onClick={() => set({ filters: [...definition.filters, { field: fields[0].key, op: "eq", value: "" }] })}>Add filter</Button>
              </section>

              <section aria-label="Grouping" className="grid gap-3 sm:grid-cols-3">
                <Field label="Group by" optional><Select value={definition.group_by ?? ""} onChange={(event) => set({ group_by: event.target.value || null })}><option value="">No grouping</option>{definition.columns.map((key) => <option key={key} value={key}>{fieldLabel(key)}</option>)}</Select></Field>
                {definition.group_by && (
                  <>
                    <Field label="Measure"><Select value={definition.aggregate.op} onChange={(event) => set({ aggregate: { ...definition.aggregate, op: event.target.value as BuilderDefinition["aggregate"]["op"] } })}><option value="count">Count</option><option value="sum">Sum</option><option value="avg">Average</option></Select></Field>
                    {definition.aggregate.op !== "count" && <Field label="Of"><Select value={definition.aggregate.field ?? ""} onChange={(event) => set({ aggregate: { ...definition.aggregate, field: event.target.value } })}><option value="">Choose</option>{fields.filter((field) => field.type === "number").map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</Select></Field>}
                  </>
                )}
              </section>
            </div>
          </Card>

          {result && (
            <Card title="Results" icon={Table2} accent="brand" actions={<Badge>{result.truncated ? `First ${result.rows.length} of ${result.total}` : `${result.total} rows`}</Badge>}>
              {result.rows.length === 0 ? <p className="text-support text-ink-muted">No rows match.</p> : (
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-surface-muted text-caption uppercase tracking-[0.06em] text-ink-muted"><tr>{result.columns.map((column) => <th key={column.key} className={cx("px-3 py-2 font-semibold", column.type === "number" && "text-right")}>{column.label}</th>)}</tr></thead>
                    <tbody className="divide-y divide-line-soft">
                      {result.rows.map((row, index) => <tr key={index}>{result.columns.map((column) => <td key={column.key} className={cx("px-3 py-2", column.type === "number" && "text-right tabular-nums")}>{row[column.key] ?? "—"}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <Dialog open={saving !== null} onClose={() => setSaving(null)} title="Save report" footer={<><Button variant="secondary" onClick={() => setSaving(null)}>Cancel</Button><Button disabled={!saving?.name.trim()} onClick={() => void save()}>Save</Button></>}>
        {saving && (
          <div className="space-y-4">
            <Field label="Name" required><Input value={saving.name} maxLength={150} onChange={(event) => setSaving({ ...saving, name: event.target.value })} data-autofocus /></Field>
            <Field label="Who can use it" helper="Shared reports run with each person's own access, so nobody sees more than they already could."><Select value={saving.visibility} onChange={(event) => setSaving({ ...saving, visibility: event.target.value as "PRIVATE" | "INSTITUTION" })}><option value="PRIVATE">Only me</option><option value="INSTITUTION">Everyone with access to this data</option></Select></Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
