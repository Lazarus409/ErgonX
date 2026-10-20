"use client";

import { useCallback, useMemo, useState } from "react";
import { ClipboardCheck, Edit3, ListChecks, Plus, Trash2 } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { employeesApi, getApiErrorMessage } from "@/lib/api";
import { useAccess } from "@/lib/access";
import { useApiResource } from "@/lib/useApiResource";
import {
  LIFECYCLE_CATEGORY_LABELS,
  LIFECYCLE_TASK_CATEGORIES,
  LIFECYCLE_TASK_OWNERS,
  type LifecycleProcess,
  type LifecycleTaskCategory,
  type LifecycleTaskOwner,
  type LifecycleTaskTemplate,
} from "@/types/hr";

type TemplateForm = { title: string; description: string; category: LifecycleTaskCategory; owner: LifecycleTaskOwner; due_offset_days: string; is_required: boolean; is_active: boolean; sort_order: string };
const emptyForm: TemplateForm = { title: "", description: "", category: "OTHER", owner: "HR", due_offset_days: "0", is_required: true, is_active: true, sort_order: "0" };

function timing(process: LifecycleProcess, days: number) {
  const anchor = process === "ONBOARDING" ? "start date" : "last working day";
  if (days === 0) return `On the ${anchor}`;
  const count = `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  return `${count} ${days < 0 ? "before" : "after"} the ${anchor}`;
}

/** The standard onboarding and offboarding checklists copied onto each employee's record. */
export default function LifecycleChecklistsPage() {
  const canManage = useAccess().can("employee.update");
  const [process, setProcess] = useState<LifecycleProcess>("ONBOARDING");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LifecycleTaskTemplate | null>(null);
  const [removing, setRemoving] = useState<LifecycleTaskTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => employeesApi.listLifecycleTemplates({ ordering: "sort_order" }), []);
  const { data, loading, error, reload } = useApiResource(load);
  const all = useMemo(() => data?.results ?? [], [data]);
  const rows = useMemo(() => all.filter((row) => row.process === process), [all, process]);
  const counts = { ONBOARDING: all.filter((row) => row.process === "ONBOARDING").length, OFFBOARDING: all.filter((row) => row.process === "OFFBOARDING").length };
  const processLabel = process === "ONBOARDING" ? "onboarding" : "offboarding";

  const openCreate = () => {
    const nextOrder = rows.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;
    setEditing(null);
    setForm({ ...emptyForm, sort_order: String(nextOrder) });
    setFormError("");
    setModalOpen(true);
  };
  const openEdit = (row: LifecycleTaskTemplate) => {
    setEditing(row);
    setForm({ title: row.title, description: row.description, category: row.category, owner: row.owner, due_offset_days: String(row.due_offset_days), is_required: row.is_required, is_active: row.is_active, sort_order: String(row.sort_order) });
    setFormError("");
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { setFormError("Enter what needs to be done."); return; }
    setSaving(true);
    setFormError("");
    const payload = {
      process, title: form.title.trim(), description: form.description.trim(), category: form.category, owner: form.owner,
      due_offset_days: Number(form.due_offset_days) || 0, is_required: form.is_required, is_active: form.is_active, sort_order: Number(form.sort_order) || 0,
    };
    try {
      if (editing) await employeesApi.updateLifecycleTemplate(editing.id, payload);
      else await employeesApi.createLifecycleTemplate(payload);
      setModalOpen(false);
      reload();
    } catch (caught) {
      setFormError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setSaving(true);
    try { await employeesApi.deleteLifecycleTemplate(removing.id); setRemoving(null); reload(); }
    catch (caught) { setPageError(getApiErrorMessage(caught)); setRemoving(null); }
    finally { setSaving(false); }
  };

  const installStandard = async () => {
    setSaving(true);
    setPageError("");
    try { await employeesApi.installStandardLifecycleChecklists(); reload(); }
    catch (caught) { setPageError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };

  const emptyAction = canManage ? (
    <div className="flex flex-wrap justify-center gap-2">
      <Button onClick={() => void installStandard()} loading={saving} leadingIcon={<ListChecks className="h-4 w-4" />}>Use the standard checklist</Button>
      <Button variant="secondary" onClick={openCreate} leadingIcon={<Plus className="h-4 w-4" />}>Add item</Button>
    </div>
  ) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Human Resources"
        title="Onboarding & offboarding checklists"
       
        icon={ClipboardCheck}
        accent="hr"
        actions={canManage ? <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add item</Button> : null}
      />

      {pageError && <Alert tone="danger" onDismiss={() => setPageError("")}>{pageError}</Alert>}
      <Alert tone="info">Changes apply to onboarding and offboarding started from now on. Checklists already in progress keep their items.</Alert>

      <Tabs label="Checklist" value={process} onChange={(value) => setProcess(value as LifecycleProcess)} items={[{ value: "ONBOARDING", label: `Onboarding (${counts.ONBOARDING})` }, { value: "OFFBOARDING", label: `Offboarding (${counts.OFFBOARDING})` }]} />

      <DataTable<LifecycleTaskTemplate>
        caption={`${process === "ONBOARDING" ? "Onboarding" : "Offboarding"} checklist`}
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        minWidth={760}
        empty={{ title: `No ${processLabel} checklist yet`, description: "Start from the standard checklist and adjust it, or add your own items.", icon: ClipboardCheck, action: emptyAction }}
        columns={[
          { key: "order", header: "#", numeric: true, cell: (row) => row.sort_order },
          { key: "title", header: "Item", cell: (row) => <span><span className="block font-semibold text-ink-strong">{row.title}</span>{row.description && <span className="block max-w-md truncate text-caption text-ink-muted" title={row.description}>{row.description}</span>}</span> },
          { key: "category", header: "Category", hideBelow: "md", cell: (row) => <Badge size="sm" accent="hr">{row.category_label}</Badge> },
          { key: "owner", header: "Responsible", cell: (row) => row.owner_label },
          { key: "due", header: "Due", cell: (row) => timing(row.process, row.due_offset_days) },
          { key: "type", header: "Type", cell: (row) => <span className="flex flex-wrap gap-1"><Badge size="sm" tone={row.is_required ? "brand" : "neutral"}>{row.is_required ? "Required" : "Optional"}</Badge>{!row.is_active && <Badge size="sm" tone="warning">Paused</Badge>}</span> },
          { key: "actions", header: <span className="sr-only">Actions</span>, cell: (row) => canManage ? <div className="flex justify-end gap-1"><IconButton size="sm" label={`Edit ${row.title}`} onClick={() => openEdit(row)}><Edit3 className="h-4 w-4" /></IconButton><IconButton size="sm" label={`Remove ${row.title}`} className="text-danger-ink hover:bg-danger-soft" onClick={() => setRemoving(row)}><Trash2 className="h-4 w-4" /></IconButton></div> : null },
        ]}
      />

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        dismissible={!saving}
        size="lg"
        title={editing ? "Edit checklist item" : `Add ${processLabel} item`}
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} loading={saving} loadingLabel="Saving…">{editing ? "Save changes" : "Add item"}</Button></>}
      >
        <div className="space-y-5">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="What needs to be done" required><Input value={form.title} maxLength={150} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={process === "ONBOARDING" ? "e.g. Create email account" : "e.g. Return laptop"} data-autofocus /></Field>
          <Field label="Details" optional><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category"><Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as LifecycleTaskCategory })}>{LIFECYCLE_TASK_CATEGORIES[process].map((value) => <option key={value} value={value}>{LIFECYCLE_CATEGORY_LABELS[value]}</option>)}</Select></Field>
            <Field label="Responsible"><Select value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value as LifecycleTaskOwner })}>{Object.entries(LIFECYCLE_TASK_OWNERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due (days)" helper={`${timing(process, Number(form.due_offset_days) || 0)}. Use a negative number for before.`}><Input type="number" min={-365} max={365} value={form.due_offset_days} onChange={(event) => setForm({ ...form, due_offset_days: event.target.value })} /></Field>
            <Field label="Display order" optional><Input type="number" min={0} value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} /></Field>
          </div>
          <Checkbox label="Required" description={`Required items must be done or skipped with a reason before ${processLabel} can complete.`} checked={form.is_required} onChange={(event) => setForm({ ...form, is_required: event.target.checked })} />
          <Checkbox label="Active" description="Paused items are not added to new checklists." checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
        </div>
      </Dialog>

      <ConfirmDialog open={removing !== null} title="Remove checklist item" description={removing ? `Remove "${removing.title}" from the standard ${processLabel} checklist? Employees who already have it keep it.` : ""} confirmLabel="Remove" destructive loading={saving} onCancel={() => setRemoving(null)} onConfirm={() => void remove()} />
    </div>
  );
}
