"use client";

import { useCallback, useState } from "react";
import { Edit3, Landmark, Plus, Smartphone } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { employeesApi, getApiErrorMessage, payrollApi } from "@/lib/api";
import type { EmployeePayrollProfilePayload } from "@/lib/api/payroll";
import { useAccess } from "@/lib/access";
import { useApiResource } from "@/lib/useApiResource";
import type { EmployeePayrollProfile, MobileMoneyNetwork, PaymentMethod } from "@/types/payroll";

const METHOD_LABELS: Record<PaymentMethod, string> = { "": "Not set", BANK: "Bank transfer", MOBILE_MONEY: "Mobile money", CASH: "Cash", CHEQUE: "Cheque" };
const NETWORK_LABELS: Record<Exclude<MobileMoneyNetwork, "">, string> = { MTN: "MTN MoMo", TELECEL: "Telecel Cash", AIRTELTIGO: "AT Money" };

const emptyForm = (): EmployeePayrollProfilePayload => ({
  employee: "", tax_residency: "RESIDENT", tax_identification_number: "", social_security_number: "", payment_method: "",
  bank_name: "", bank_branch: "", bank_sort_code: "", account_name: "", account_number: "", mobile_money_network: "", mobile_money_number: "",
});

function payTo(profile: EmployeePayrollProfile) {
  if (profile.payment_method === "BANK") return `${profile.bank_name} ••••${profile.account_number.slice(-4)}`;
  if (profile.payment_method === "MOBILE_MONEY") return `${profile.mobile_money_network ? NETWORK_LABELS[profile.mobile_money_network] : "Wallet"} ••••${profile.mobile_money_number.slice(-4)}`;
  return METHOD_LABELS[profile.payment_method];
}

/** Each employee's tax identity and where their net pay goes; used by payslips and the run's payment files. */
export default function EmployeePayrollProfilesPage() {
  const { can } = useAccess();
  const canEdit = can("payroll.configure");
  const load = useCallback(async () => Promise.all([payrollApi.listEmployeePayrollProfiles({ page_size: 100 }), employeesApi.listEmployees({ page_size: 100 })]), []);
  const { data, loading, error, reload } = useApiResource(load);
  const [form, setForm] = useState<EmployeePayrollProfilePayload>(emptyForm());
  const [editing, setEditing] = useState<EmployeePayrollProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const profiles = data?.[0].results ?? [];
  const employees = data?.[1].results ?? [];
  const employeeNames = new Map(employees.map((employee) => [employee.id, `${employee.employee_number} — ${employee.full_name}`]));
  const withoutProfile = employees.filter((employee) => !profiles.some((profile) => profile.employee === employee.id));
  const set = <K extends keyof EmployeePayrollProfilePayload>(key: K, value: EmployeePayrollProfilePayload[K]) => setForm((current) => ({ ...current, [key]: value }));

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setFormError(""); setOpen(true); };
  const openEdit = (profile: EmployeePayrollProfile) => {
    const next = emptyForm();
    for (const key of Object.keys(next) as Array<keyof EmployeePayrollProfilePayload>) Object.assign(next, { [key]: profile[key] ?? "" });
    setEditing(profile); setForm(next); setFormError(""); setOpen(true);
  };
  const save = async () => {
    setSaving(true); setFormError("");
    try {
      if (editing) await payrollApi.updateEmployeePayrollProfile(editing.id, form);
      else await payrollApi.createEmployeePayrollProfile(form);
      setOpen(false); reload();
    } catch (caught) { setFormError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee payroll profiles"
        description="Tax identity and payment details for each employee. Payment details feed the bank and mobile-money files of each finalized run."
        actions={canEdit ? <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add profile</Button> : null}
      />
      {canEdit && withoutProfile.length > 0 && !loading && <Alert tone="warning">{withoutProfile.length} employee{withoutProfile.length === 1 ? " has" : "s have"} no payroll profile, so they can&apos;t be paid by transfer.</Alert>}
      <DataTable
        caption="Payroll profiles"
        rows={profiles}
        rowKey={(profile) => profile.id}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        minWidth={760}
        empty={{ title: "No payroll profiles yet", description: "Add a profile to record an employee's tax and payment details." }}
        columns={[
          { key: "employee", header: "Employee", cell: (profile) => <span className="font-semibold text-ink-strong">{employeeNames.get(profile.employee) ?? profile.employee}</span> },
          { key: "residency", header: "Tax residency", hideBelow: "md", cell: (profile) => profile.tax_residency === "NON_RESIDENT" ? "Non-resident" : "Resident" },
          { key: "ids", header: "TIN / SSNIT", hideBelow: "lg", cell: (profile) => <span className="text-ink-muted">{profile.tax_identification_number || "—"} / {profile.social_security_number || "—"}</span> },
          { key: "pay", header: "Paid to", cell: (profile) => profile.payment_method ? <span className="inline-flex items-center gap-1.5">{profile.payment_method === "BANK" ? <Landmark className="h-4 w-4 text-ink-muted" aria-hidden="true" /> : profile.payment_method === "MOBILE_MONEY" ? <Smartphone className="h-4 w-4 text-ink-muted" aria-hidden="true" /> : null}{payTo(profile)}</span> : <Badge size="sm" tone="warning">Not set</Badge> },
          ...(canEdit ? [{ key: "edit", header: <span className="sr-only">Edit</span>, cell: (profile: EmployeePayrollProfile) => <div className="flex justify-end"><IconButton label="Edit payroll profile" onClick={() => openEdit(profile)}><Edit3 className="h-4 w-4" /></IconButton></div> }] : []),
        ]}
      />

      <Dialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={editing ? "Edit payroll profile" : "Add payroll profile"}
        description="Changes to payment details are recorded in the audit trail. You can't change your own."
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void save()} loading={saving} disabled={!form.employee}>Save profile</Button></>}
      >
        {formError && <Alert tone="danger" className="mb-4">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employee" required className="sm:col-span-2">
            <Select value={form.employee} onChange={(event) => set("employee", event.target.value)} disabled={Boolean(editing)}>
              <option value="">Select employee</option>
              {(editing ? employees : withoutProfile).map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_number} — {employee.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Tax residency" required>
            <Select value={form.tax_residency} onChange={(event) => set("tax_residency", event.target.value)}><option value="RESIDENT">Resident</option><option value="NON_RESIDENT">Non-resident</option></Select>
          </Field>
          <Field label="Tax identification number (TIN)"><Input value={form.tax_identification_number} onChange={(event) => set("tax_identification_number", event.target.value)} /></Field>
          <Field label="SSNIT number"><Input value={form.social_security_number} onChange={(event) => set("social_security_number", event.target.value)} /></Field>
          <Field label="Pay by">
            <Select value={form.payment_method} onChange={(event) => set("payment_method", event.target.value as PaymentMethod)}>
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((method) => <option key={method} value={method}>{METHOD_LABELS[method]}</option>)}
            </Select>
          </Field>
          {form.payment_method === "BANK" && (
            <>
              <Field label="Bank" required><Input value={form.bank_name} onChange={(event) => set("bank_name", event.target.value)} placeholder="e.g. GCB Bank" /></Field>
              <Field label="Branch"><Input value={form.bank_branch} onChange={(event) => set("bank_branch", event.target.value)} /></Field>
              <Field label="Sort code"><Input value={form.bank_sort_code} onChange={(event) => set("bank_sort_code", event.target.value)} /></Field>
              <Field label="Account name" required><Input value={form.account_name} onChange={(event) => set("account_name", event.target.value)} /></Field>
              <Field label="Account number" required className="sm:col-span-2"><Input value={form.account_number} inputMode="numeric" onChange={(event) => set("account_number", event.target.value)} /></Field>
            </>
          )}
          {form.payment_method === "MOBILE_MONEY" && (
            <>
              <Field label="Network" required>
                <Select value={form.mobile_money_network} onChange={(event) => set("mobile_money_network", event.target.value as MobileMoneyNetwork)}>
                  <option value="">Select network</option>
                  {Object.entries(NETWORK_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Wallet number" required helper="e.g. 0241234567"><Input value={form.mobile_money_number} inputMode="tel" onChange={(event) => set("mobile_money_number", event.target.value)} /></Field>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
