"use client";

import { Plus, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/components/guards/AuthProvider";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { accountingApi, getApiErrorMessage } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import type { Expense } from "@/types/accounting";
import { MAX_PAGE_SIZE } from "@/types/api";

type Action = "submit" | "approve" | "reject" | "post";
const copy: Record<Action, { title: string; description: string; destructive?: boolean }> = {
  submit: { title: "Submit expense", description: "Send this draft for controlled approval." },
  approve: { title: "Approve expense", description: "Approve this expense for controlled posting." },
  reject: { title: "Reject expense", description: "Rejected expenses are immutable.", destructive: true },
  post: { title: "Post expense", description: "The backend will create and post the expense journal." },
};
const labels: Record<Action, string> = { submit: "Submit", approve: "Approve", reject: "Reject", post: "Post" };

export default function ExpensesPage() {
  const { user } = useAuth();
  const allowed = (permission: string) => Boolean(user?.permissions.includes("*") || user?.permissions.includes(permission));
  const [status, setStatus] = useState("ALL"); const [search, setSearch] = useState(""); const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<{ expense: Expense; action: Action } | null>(null); const [acting, setActing] = useState(false); const [actionError, setActionError] = useState("");
  const load = useCallback(() => accountingApi.listExpenses({ page_size: MAX_PAGE_SIZE, status: status === "ALL" ? undefined : status, ordering: "-expense_date" }), [status]);
  const { data, loading, error, reload } = useApiResource(load); const expenses = data?.results ?? [];
  const shown = useMemo(() => { const query = search.trim().toLowerCase(); return expenses.filter((expense) => !query || expense.description.toLowerCase().includes(query)); }, [expenses, search]);
  const actionsFor = (expense: Expense): Action[] => {
    const candidates: Action[] = expense.status === "DRAFT" ? ["submit"] : expense.status === "PENDING" ? ["approve", "reject"] : expense.status === "APPROVED" ? ["post"] : [];
    return candidates.filter((action) => allowed(action === "submit" ? "expense.create" : action === "post" ? "expense.post" : "expense.approve"));
  };
  const run = async () => { if (!pending) return; setActing(true); setActionError(""); try { await ({ submit: accountingApi.submitExpense, approve: accountingApi.approveExpense, reject: accountingApi.rejectExpense, post: accountingApi.postExpense }[pending.action])(pending.expense.id); setPending(null); reload(); } catch (caught) { setPending(null); setActionError(getApiErrorMessage(caught)); } finally { setActing(false); } };
  return <main className="space-y-6"><PageHeader title="Expenses" description="Create, approve and post institutional expenses." actions={allowed("expense.create") ? <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New Expense</button> : undefined} />{error && <ErrorState message={error} onRetry={reload} />}{actionError && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}{creating && <ExpenseForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}<section className="rounded-2xl border bg-white p-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expense description..." className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border px-3 text-sm"><option value="ALL">All statuses</option>{["DRAFT", "PENDING", "APPROVED", "POSTED", "REJECTED"].map((value) => <option key={value}>{value}</option>)}</select></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="pb-3">Date</th><th className="pb-3">Description</th><th className="pb-3">Amount</th><th className="pb-3">Status</th><th className="pb-3">Actions</th></tr></thead><tbody>{shown.map((expense) => <tr key={expense.id} className="border-b last:border-0"><td className="py-4">{formatDate(expense.expense_date)}</td><td className="py-4 font-medium">{expense.description}</td><td className="py-4 font-semibold">{formatAmount(expense.amount, expense.currency)}</td><td className="py-4"><StatusBadge status={expense.status} /></td><td className="py-4"><div className="flex gap-2">{actionsFor(expense).map((action) => <button key={action} type="button" onClick={() => { setActionError(""); setPending({ expense, action }); }} className="rounded border px-3 py-2 text-xs font-semibold">{labels[action]}</button>)}</div></td></tr>)}</tbody></table>{loading && <p className="py-10 text-center text-sm text-slate-500">Loading expenses...</p>}{!loading && !shown.length && <p className="py-10 text-center text-sm text-slate-500">No expenses found.</p>}</div></section>{pending && <ConfirmDialog open title={copy[pending.action].title} description={copy[pending.action].description} confirmLabel={labels[pending.action]} destructive={copy[pending.action].destructive} loading={acting} onCancel={() => setPending(null)} onConfirm={() => void run()} />}</main>;
}

function ExpenseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ expense_date: new Date().toISOString().slice(0, 10), account: "", amount: "", currency: "", description: "", attachment: null as string | null }); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const { data } = useApiResource(() => accountingApi.listAccounts({ page_size: MAX_PAGE_SIZE, account_type: "EXPENSE", is_active: true, is_postable: true }));
  const save = async () => { if (!form.account || !form.amount || !form.currency || !form.description.trim()) { setError("Expense account, amount, currency, and description are required."); return; } setSaving(true); try { await accountingApi.createExpense({ ...form, currency: form.currency.toUpperCase(), description: form.description.trim() }); onSaved(); } catch (caught) { setError(getApiErrorMessage(caught)); } finally { setSaving(false); } };
  return <section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">New Expense</h2>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><input type="date" value={form.expense_date} onChange={(event) => setForm({ ...form, expense_date: event.target.value })} className="rounded border p-2" /><select value={form.account} onChange={(event) => setForm({ ...form, account: event.target.value })} className="rounded border p-2"><option value="">Expense account</option>{(data?.results ?? []).map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="Amount" className="rounded border p-2" /><input value={form.currency} maxLength={3} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} placeholder="Currency" className="rounded border p-2" /><input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" className="rounded border p-2 sm:col-span-2" /></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded border px-3 py-2">Cancel</button><button type="button" disabled={saving} onClick={() => void save()} className="rounded bg-slate-900 px-3 py-2 text-white">{saving ? "Saving..." : "Create Draft"}</button></div></section>;
}
