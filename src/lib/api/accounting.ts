import { apiAction, apiGet, apiGetList, apiPatch, apiPost } from "./client";
import type { ListParams, PaginatedData } from "@/types/api";
import type { Account, AccountingConfiguration, AccountingPeriod, AccountingSetupChoices, BankAccount, BankStatementLine, Customer, Expense, Invoice, InvoiceLine, JournalEntry, Payment, Receipt, TrialBalance, Vendor, VendorBill, VendorBillLine } from "@/types/accounting";

export type AccountPayload = Pick<Account, "code" | "name" | "account_type" | "parent" | "normal_balance" | "is_postable" | "is_active">;

export function listAccounts(params?: ListParams & { account_type?: string; normal_balance?: string; parent?: string; is_postable?: boolean; is_active?: boolean }): Promise<PaginatedData<Account>> {
  return apiGetList<Account>("/accounts/", params);
}

export function createAccount(payload: AccountPayload): Promise<Account> {
  return apiPost<Account, AccountPayload>("/accounts/", payload);
}

export function updateAccount(id: string, payload: Partial<AccountPayload>): Promise<Account> {
  return apiPatch<Account, Partial<AccountPayload>>(`/accounts/${id}/`, payload);
}

export function listJournalEntries(params?: ListParams & { accounting_period?: string; entry_date?: string; source?: string; status?: string }): Promise<PaginatedData<JournalEntry>> {
  return apiGetList<JournalEntry>("/journal-entries/", params);
}

export function listAccountingPeriods(params?: ListParams & { status?: string }): Promise<PaginatedData<AccountingPeriod>> {
  return apiGetList<AccountingPeriod>("/accounting-periods/", params);
}
export function closeAccountingPeriod(id: string): Promise<AccountingPeriod> { return apiAction<AccountingPeriod>(`/accounting-periods/${id}/close/`); }
export function lockAccountingPeriod(id: string): Promise<AccountingPeriod> { return apiAction<AccountingPeriod>(`/accounting-periods/${id}/lock/`); }
export function reopenAccountingPeriod(id: string): Promise<AccountingPeriod> { return apiAction<AccountingPeriod>(`/accounting-periods/${id}/reopen/`); }

export type JournalEntryPayload = Pick<JournalEntry, "accounting_period" | "entry_date" | "description" | "reference"> & { lines: Array<Pick<JournalEntry["lines"][number], "account" | "description" | "debit" | "credit">> };
export function createJournalEntry(payload: JournalEntryPayload): Promise<JournalEntry> {
  return apiPost<JournalEntry, JournalEntryPayload>("/journal-entries/", payload);
}

export function getJournalEntry(id: string): Promise<JournalEntry> { return apiGet<JournalEntry>(`/journal-entries/${id}/`); }
export function submitJournalEntry(id: string): Promise<JournalEntry> { return apiAction<JournalEntry>(`/journal-entries/${id}/submit/`); }
export function approveJournalEntry(id: string): Promise<JournalEntry> { return apiAction<JournalEntry>(`/journal-entries/${id}/approve/`); }
export function postJournalEntry(id: string): Promise<JournalEntry> { return apiAction<JournalEntry>(`/journal-entries/${id}/post/`); }
export function voidJournalEntry(id: string): Promise<JournalEntry> { return apiAction<JournalEntry>(`/journal-entries/${id}/void/`); }
export interface JournalReversalPayload {
  accounting_period: string;
  entry_date: string;
  description?: string;
}
export function reverseJournalEntry(id: string, payload: JournalReversalPayload): Promise<JournalEntry> { return apiPost<JournalEntry, JournalReversalPayload>(`/journal-entries/${id}/reverse/`, payload); }
export function listVendors(params?: ListParams & { is_active?: boolean }): Promise<PaginatedData<Vendor>> { return apiGetList<Vendor>("/vendors/", params); }
export function listVendorBills(params?: ListParams & { vendor?: string; status?: string; currency?: string; accounting_period?: string }): Promise<PaginatedData<VendorBill>> { return apiGetList<VendorBill>("/vendor-bills/", params); }
export type VendorBillPayload = Pick<VendorBill, "vendor" | "bill_number" | "bill_date" | "due_date" | "currency" | "accounting_period"> & {
  lines: Array<Pick<VendorBillLine, "description" | "expense_account" | "quantity" | "unit_price">>;
};
export function createVendorBill(payload: VendorBillPayload): Promise<VendorBill> { return apiPost<VendorBill, VendorBillPayload>("/vendor-bills/", payload); }
export function submitVendorBill(id: string): Promise<VendorBill> { return apiAction<VendorBill>(`/vendor-bills/${id}/submit/`); }
export function approveVendorBill(id: string): Promise<VendorBill> { return apiAction<VendorBill>(`/vendor-bills/${id}/approve/`); }
export function postVendorBill(id: string): Promise<VendorBill> { return apiAction<VendorBill>(`/vendor-bills/${id}/post/`); }
export function voidVendorBill(id: string): Promise<VendorBill> { return apiAction<VendorBill>(`/vendor-bills/${id}/void/`); }
export function listCustomers(params?: ListParams & { is_active?: boolean }): Promise<PaginatedData<Customer>> { return apiGetList<Customer>("/customers/", params); }
export function listInvoices(params?: ListParams & { customer?: string; status?: string; currency?: string; accounting_period?: string }): Promise<PaginatedData<Invoice>> { return apiGetList<Invoice>("/invoices/", params); }
export type InvoicePayload = Pick<Invoice, "customer" | "invoice_number" | "invoice_date" | "due_date" | "currency" | "accounting_period" | "external_tax_reference"> & {
  lines: Array<Pick<InvoiceLine, "description" | "income_account" | "quantity" | "unit_price">>;
};
export function createInvoice(payload: InvoicePayload): Promise<Invoice> { return apiPost<Invoice, InvoicePayload>("/invoices/", payload); }
export function issueInvoice(id: string): Promise<Invoice> { return apiAction<Invoice>(`/invoices/${id}/issue/`); }
export function voidInvoice(id: string): Promise<Invoice> { return apiAction<Invoice>(`/invoices/${id}/void/`); }
export function listBankAccounts(params?: ListParams & { is_active?: boolean; currency?: string; ledger_account?: string }): Promise<PaginatedData<BankAccount>> { return apiGetList<BankAccount>("/bank-accounts/", params); }
export type BankAccountPayload = Pick<BankAccount, "name" | "bank_name" | "masked_account_number" | "currency" | "ledger_account" | "is_active">;
export function createBankAccount(payload: BankAccountPayload): Promise<BankAccount> { return apiPost<BankAccount, BankAccountPayload>("/bank-accounts/", payload); }
export function listExpenses(params?: ListParams & { status?: string; currency?: string; account?: string; expense_date?: string }): Promise<PaginatedData<Expense>> { return apiGetList<Expense>("/expenses/", params); }
export type ExpensePayload = Pick<Expense, "expense_date" | "account" | "amount" | "currency" | "description" | "attachment">;
export function createExpense(payload: ExpensePayload): Promise<Expense> { return apiPost<Expense, ExpensePayload>("/expenses/", payload); }
export function submitExpense(id: string): Promise<Expense> { return apiAction<Expense>(`/expenses/${id}/submit/`); }
export function approveExpense(id: string): Promise<Expense> { return apiAction<Expense>(`/expenses/${id}/approve/`); }
export function rejectExpense(id: string): Promise<Expense> { return apiAction<Expense>(`/expenses/${id}/reject/`); }
export function postExpense(id: string): Promise<Expense> { return apiAction<Expense>(`/expenses/${id}/post/`); }
export function listPayments(params?: ListParams & { status?: string; currency?: string; bank_account?: string; vendor_bill?: string }): Promise<PaginatedData<Payment>> { return apiGetList<Payment>("/payments/", params); }
export function listReceipts(params?: ListParams & { status?: string; currency?: string; bank_account?: string; invoice?: string }): Promise<PaginatedData<Receipt>> { return apiGetList<Receipt>("/receipts/", params); }
export type PaymentPayload = Pick<Payment, "payment_number" | "payment_date" | "amount" | "currency" | "payment_method" | "bank_account" | "vendor_bill">;
export type ReceiptPayload = Pick<Receipt, "receipt_number" | "receipt_date" | "amount" | "currency" | "payment_method" | "bank_account" | "invoice">;
export function createPayment(payload: PaymentPayload): Promise<Payment> { return apiPost<Payment, PaymentPayload>("/payments/", payload); }
export function createReceipt(payload: ReceiptPayload): Promise<Receipt> { return apiPost<Receipt, ReceiptPayload>("/receipts/", payload); }
export function voidPayment(id: string, void_date: string): Promise<Payment> { return apiPost<Payment, { void_date: string }>(`/payments/${id}/void/`, { void_date }); }
export function voidReceipt(id: string, void_date: string): Promise<Receipt> { return apiPost<Receipt, { void_date: string }>(`/receipts/${id}/void/`, { void_date }); }
export type BankStatementLinePayload = Pick<BankStatementLine, "bank_account" | "statement_date" | "external_id" | "reference" | "description" | "amount" | "currency">;
export function listBankStatementLines(params?: ListParams & { bank_account?: string; status?: string; currency?: string; statement_date?: string }): Promise<PaginatedData<BankStatementLine>> { return apiGetList<BankStatementLine>("/bank-statement-lines/", params); }
export function createBankStatementLine(payload: BankStatementLinePayload): Promise<BankStatementLine> { return apiPost<BankStatementLine, BankStatementLinePayload>("/bank-statement-lines/", payload); }
export function matchBankStatementLine(id: string, journal_entry: string): Promise<BankStatementLine> { return apiPost<BankStatementLine, { journal_entry: string }>(`/bank-statement-lines/${id}/match/`, { journal_entry }); }
export function unmatchBankStatementLine(id: string): Promise<BankStatementLine> { return apiAction<BankStatementLine>(`/bank-statement-lines/${id}/unmatch/`); }
export function getTrialBalance(params?: { date_from?: string; date_to?: string }): Promise<TrialBalance> { return apiGet<TrialBalance>("/accounting-reports/trial-balance/", { params }); }
export function listAccountingConfigurations(): Promise<PaginatedData<AccountingConfiguration>> { return apiGetList<AccountingConfiguration>("/accounting-configurations/"); }
export function getAccountingSetupChoices(): Promise<AccountingSetupChoices> { return apiGet<AccountingSetupChoices>("/accounting-configurations/choices/"); }
