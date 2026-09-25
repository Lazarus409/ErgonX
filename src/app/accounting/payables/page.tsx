"use client";

import { Plus, Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { accountingApi, getApiErrorMessage } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { VendorBill } from "@/types/accounting";
import { MAX_PAGE_SIZE } from "@/types/api";

type BillLineForm = { description: string; expense_account: string; quantity: string; unit_price: string };
type BillForm = { vendor: string; bill_number: string; bill_date: string; due_date: string; currency: string; accounting_period: string; lines: BillLineForm[] };
type BillAction = "submit" | "approve" | "post" | "void";

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): BillLineForm => ({ description: "", expense_account: "", quantity: "1", unit_price: "" });
const emptyForm = (): BillForm => ({ vendor: "", bill_number: "", bill_date: today(), due_date: today(), currency: "", accounting_period: "", lines: [emptyLine()] });
const actionCopy: Record<BillAction, { label: string; title: string; description: string; destructive: boolean }> = {
  submit: { label: "Submit", title: "Submit vendor bill", description: "The backend will validate the draft before it is sent for approval.", destructive: false },
  approve: { label: "Approve", title: "Approve vendor bill", description: "Approve this pending vendor bill for controlled posting.", destructive: false },
  post: { label: "Post", title: "Post vendor bill", description: "Posting creates and posts the linked accounting journal. This operation is controlled by the backend.", destructive: false },
  void: { label: "Void", title: "Void vendor bill", description: "Void this unposted vendor bill. This cannot be undone.", destructive: true },
};

export default function PayablesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<BillForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<{ bill: VendorBill; action: BillAction } | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => Promise.all([
    accountingApi.listVendorBills({ page_size: MAX_PAGE_SIZE, status: status === "ALL" ? undefined : status, ordering: "-bill_date" }),
    accountingApi.listVendors({ page_size: MAX_PAGE_SIZE, is_active: true }),
    accountingApi.listAccounts({ page_size: MAX_PAGE_SIZE, account_type: "EXPENSE", is_active: true, is_postable: true, ordering: "code" }),
    accountingApi.listAccountingPeriods({ page_size: MAX_PAGE_SIZE, status: "OPEN", ordering: "start_date" }),
  ]), [status]);
  const { data, loading, error, reload } = useApiResource(load);
  const bills = useMemo(() => data?.[0].results ?? [], [data]);
  const vendors = useMemo(() => data?.[1].results ?? [], [data]);
  const accounts = useMemo(() => data?.[2].results ?? [], [data]);
  const periods = useMemo(() => data?.[3].results ?? [], [data]);
  const vendorNames = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor.name])), [vendors]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bills.filter((bill) => !query || bill.bill_number.toLowerCase().includes(query) || (vendorNames.get(bill.vendor) ?? bill.vendor).toLowerCase().includes(query));
  }, [bills, search, vendorNames]);
  const pendingCount = bills.filter((bill) => bill.status === "PENDING").length;
  const posted = bills.filter((bill) => bill.status === "POSTED").length;
  const openCreate = () => { setForm(emptyForm()); setFormError(""); setModalOpen(true); };
  const save = async () => {
    if (!form.vendor || !form.bill_number.trim() || !form.bill_date || !form.due_date || !form.currency.trim() || !form.accounting_period || form.lines.some((line) => !line.description.trim() || !line.expense_account || !line.quantity || !line.unit_price)) { setFormError("Complete the bill header and every bill line before saving."); return; }
    setSaving(true); setFormError("");
    try { await accountingApi.createVendorBill({ ...form, bill_number: form.bill_number.trim(), currency: form.currency.trim().toUpperCase(), lines: form.lines.map((line) => ({ ...line, description: line.description.trim() })) }); setModalOpen(false); reload(); } catch (caught) { setFormError(getApiErrorMessage(caught)); } finally { setSaving(false); }
  };
  const runAction = async () => {
    if (!pending) return;
    setActing(true); setActionError("");
    try { const actions: Record<BillAction, (id: string) => Promise<VendorBill>> = { submit: accountingApi.submitVendorBill, approve: accountingApi.approveVendorBill, post: accountingApi.postVendorBill, void: accountingApi.voidVendorBill }; await actions[pending.action](pending.bill.id); setPending(null); reload(); } catch (caught) { setPending(null); setActionError(getApiErrorMessage(caught)); } finally { setActing(false); }
  };

  return <div className="space-y-6"><PageHeader title="Accounts Payable" description="Manage vendors, vendor bills, approvals, posting and payments." actions={<button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New Vendor Bill</button>} />{error && <ErrorState message={error} onRetry={reload} />}{actionError && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}<div className="grid gap-4 sm:grid-cols-3"><Metric label="Vendor Bills" value={String(data?.[0].count ?? 0)} /><Metric label="Pending Approval" value={String(pendingCount)} /><Metric label="Posted" value={String(posted)} /></div><section className="rounded-2xl border bg-white p-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vendor or bill number..." className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border px-3 text-sm"><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="POSTED">Posted</option><option value="VOID">Void</option></select></div><h2 className="mt-5 font-semibold">Vendor Bills</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-3">Vendor</th><th className="pb-3">Bill Number</th><th className="pb-3">Bill Date</th><th className="pb-3">Payable</th><th className="pb-3">Status</th><th className="pb-3">Actions</th></tr></thead><tbody>{filtered.map((bill) => <tr key={bill.id} className="border-b last:border-0"><td className="py-4 font-medium">{vendorNames.get(bill.vendor) ?? bill.vendor}</td><td className="py-4">{bill.bill_number}</td><td className="py-4">{formatDate(bill.bill_date)}</td><td className="py-4 font-semibold">{formatAmount(bill.amount_payable, bill.currency)}</td><td className="py-4"><StatusBadge status={bill.status} /></td><td className="py-4"><BillActions bill={bill} onAction={(action) => { setActionError(""); setPending({ bill, action }); }} /></td></tr>)}</tbody></table>{loading && <p className="py-10 text-center text-sm text-slate-500">Loading vendor bills...</p>}{!loading && !filtered.length && <p className="py-10 text-center text-sm text-slate-500">No vendor bills found.</p>}</div><p className="mt-5 text-xs text-slate-500">Amounts and bill status are calculated and controlled by the backend. Payment allocation is not shown because the backend does not expose it.</p></section>{modalOpen && <BillModal form={form} vendors={vendors} accounts={accounts} periods={periods} error={formError} saving={saving} onChange={setForm} onClose={() => setModalOpen(false)} onSave={() => void save()} />}{pending && <ConfirmDialog open title={actionCopy[pending.action].title} description={actionCopy[pending.action].description} confirmLabel={actionCopy[pending.action].label} destructive={actionCopy[pending.action].destructive} loading={acting} onCancel={() => setPending(null)} onConfirm={() => void runAction()} />}</div>;
}

function BillActions({ bill, onAction }: { bill: VendorBill; onAction: (action: BillAction) => void }) { const actions: BillAction[] = bill.status === "DRAFT" ? ["submit", "void"] : bill.status === "PENDING" ? ["approve", "void"] : bill.status === "APPROVED" ? ["post"] : []; return <div className="flex gap-2">{actions.map((action) => <button key={action} type="button" onClick={() => onAction(action)} className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50">{actionCopy[action].label}</button>)}</div>; }
function BillModal({ form, vendors, accounts, periods, error, saving, onChange, onClose, onSave }: { form: BillForm; vendors: Array<{ id: string; name: string; vendor_code: string }>; accounts: Array<{ id: string; code: string; name: string }>; periods: Array<{ id: string; name: string; start_date: string; end_date: string }>; error: string; saving: boolean; onChange: (form: BillForm) => void; onClose: () => void; onSave: () => void }) { const setLine = (index: number, change: Partial<BillLineForm>) => onChange({ ...form, lines: form.lines.map((line, itemIndex) => itemIndex === index ? { ...line, ...change } : line) }); return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"><div className="mx-auto my-8 w-full max-w-4xl rounded-2xl bg-white shadow-xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-bold">New Vendor Bill</h2><p className="text-sm text-slate-500">Save a draft first; submission, approval and posting use backend workflow actions.</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close vendor bill form"><X size={19} /></button></div>{error && <p className="mx-5 mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Vendor"><select value={form.vendor} onChange={(event) => onChange({ ...form, vendor: event.target.value })} className="w-full rounded border p-2"><option value="">Select vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.vendor_code} — {vendor.name}</option>)}</select></Field><Field label="Bill number"><input value={form.bill_number} onChange={(event) => onChange({ ...form, bill_number: event.target.value })} className="w-full rounded border p-2" /></Field><Field label="Bill date"><input type="date" value={form.bill_date} onChange={(event) => onChange({ ...form, bill_date: event.target.value })} className="w-full rounded border p-2" /></Field><Field label="Due date"><input type="date" value={form.due_date} onChange={(event) => onChange({ ...form, due_date: event.target.value })} className="w-full rounded border p-2" /></Field><Field label="Currency"><input value={form.currency} onChange={(event) => onChange({ ...form, currency: event.target.value.toUpperCase() })} maxLength={3} placeholder="e.g. GHS" className="w-full rounded border p-2" /></Field><Field label="Open accounting period"><select value={form.accounting_period} onChange={(event) => onChange({ ...form, accounting_period: event.target.value })} className="w-full rounded border p-2"><option value="">Select period</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.name} ({formatDate(period.start_date)} – {formatDate(period.end_date)})</option>)}</select></Field></div><div className="border-t px-5 pb-5 pt-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Bill lines</h3><p className="text-sm text-slate-500">Tax and withholding rules are applied only when configured by the backend.</p></div><button type="button" onClick={() => onChange({ ...form, lines: [...form.lines, emptyLine()] })} className="rounded-lg border px-3 py-2 text-xs font-semibold">Add line</button></div><div className="mt-4 space-y-3">{form.lines.map((line, index) => <div key={index} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,1fr)_110px_130px_auto]"><input value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} placeholder="Description" className="rounded border p-2 text-sm" /><select value={line.expense_account} onChange={(event) => setLine(index, { expense_account: event.target.value })} className="rounded border p-2 text-sm"><option value="">Expense account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select><input type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} placeholder="Quantity" className="rounded border p-2 text-sm" /><input type="number" min="0" step="0.0001" value={line.unit_price} onChange={(event) => setLine(index, { unit_price: event.target.value })} placeholder="Unit price" className="rounded border p-2 text-sm" /><button type="button" disabled={form.lines.length === 1} onClick={() => onChange({ ...form, lines: form.lines.filter((_, itemIndex) => itemIndex !== index) })} className="rounded border px-3 text-xs font-semibold disabled:opacity-40">Remove</button></div>)}</div></div><div className="flex justify-end gap-3 border-t p-5"><button type="button" onClick={onClose} disabled={saving} className="rounded border px-4 py-2">Cancel</button><button type="button" onClick={onSave} disabled={saving} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{saving ? "Saving..." : "Create Draft"}</button></div></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1"><span className="text-sm font-medium">{label}</span>{children}</label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>; }
