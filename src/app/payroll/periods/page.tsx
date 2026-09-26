"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DataTable, DataToolbar } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, payrollApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";
import { useAccess } from "@/lib/access";

const ALL = "ALL";
const emptyForm = { name: "", start_date: "", end_date: "", pay_date: "" };

export default function PayrollPeriodsPage() {
  const { can } = useAccess();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(
    () => payrollApi.listPayrollPeriods({ page_size: MAX_PAGE_SIZE, status: status === ALL ? undefined : status, ordering: "-start_date" }),
    [status],
  );
  const { data, loading, error, reload } = useApiResource(load);

  const periods = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.results ?? []).filter((period) => !query || period.name.toLowerCase().includes(query));
  }, [data, search]);

  const createPeriod = async () => {
    setFormError("");
    if (!form.name.trim() || !form.start_date || !form.end_date || !form.pay_date) {
      setFormError("Complete the name, period dates, and pay date.");
      return;
    }
    if (form.end_date < form.start_date) {
      setFormError("The end date must not be before the start date.");
      return;
    }
    setSaving(true);
    try {
      await payrollApi.createPayrollPeriod({ ...form, name: form.name.trim() });
      setFormOpen(false);
      setForm(emptyForm);
      reload();
    } catch (caught) {
      setFormError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payroll" title="Payroll periods" description="Manage payroll periods and their processing status." icon={CalendarDays} accent="payroll" actions={can("payroll.prepare") ? <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => { setFormError(""); setFormOpen(true); }}>New period</Button> : null} />
      <DataTable
        caption="Payroll periods"
        rows={periods}
        rowKey={(period) => period.id}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        minWidth={640}
        toolbar={
          <DataToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search payroll periods…"
            filters={<Select size="sm" aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><option value={ALL}>All statuses</option><option value="OPEN">Open</option><option value="PROCESSING">Processing</option><option value="CLOSED">Closed</option></Select>}
            onClear={search || status !== ALL ? () => { setSearch(""); setStatus(ALL); } : undefined}
          />
        }
        empty={{ title: "No payroll periods found", description: "Open a period to begin processing payroll.", icon: CalendarDays, action: can("payroll.prepare") ? <Button variant="secondary" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => { setFormError(""); setFormOpen(true); }}>New period</Button> : undefined }}
        footer={<p className="flex items-center gap-2 text-caption text-ink-muted"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Period dates and processing status are controlled by the payroll backend. Closed periods cannot be changed.</p>}
        columns={[
          { key: "name", header: "Period", sortValue: (period) => period.name, cell: (period) => <span className="font-semibold text-ink-strong">{period.name}</span> },
          { key: "start", header: "Start", sortValue: (period) => period.start_date, cell: (period) => formatDate(period.start_date) },
          { key: "end", header: "End", sortValue: (period) => period.end_date, cell: (period) => formatDate(period.end_date) },
          { key: "pay", header: "Pay date", sortValue: (period) => period.pay_date, cell: (period) => formatDate(period.pay_date) },
          { key: "status", header: "Status", cell: (period) => <StatusBadge status={period.status} size="sm" /> },
        ]}
      />

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        dismissible={!saving}
        title="New payroll period"
        description="Open a period for an already configured payroll institution."
        footer={<><Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void createPeriod()} loading={saving} loadingLabel="Creating…">Create period</Button></>}
      >
        <div className="space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="Period name" required><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. September 2026" data-autofocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" required><Input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></Field>
            <Field label="End date" required><Input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} /></Field>
          </div>
          <Field label="Pay date" required><Input type="date" value={form.pay_date} onChange={(event) => setForm({ ...form, pay_date: event.target.value })} /></Field>
        </div>
      </Dialog>
    </div>
  );
}
