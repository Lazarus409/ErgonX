export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type NormalBalance = "DEBIT" | "CREDIT";

export interface Account {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  parent: string | null;
  normal_balance: NormalBalance;
  is_postable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalLine {
  id: string;
  account: string;
  description: string;
  debit: string;
  credit: string;
  department: string | null;
  location: string | null;
  employee: string | null;
  cost_centre: string;
  project: string;
  fund: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  journal_number: string;
  accounting_period: string;
  entry_date: string;
  description: string;
  source: string;
  reference: string;
  status: string;
  created_by: string;
  approved_by: string | null;
  posted_by: string | null;
  posted_at: string | null;
  reversal_of: string | null;
  lines: JournalLine[];
  created_at: string;
  updated_at: string;
}

export interface AccountingPeriod {
  id: string;
  fiscal_year: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vendor { id: string; name: string; vendor_code: string; email: string; phone: string; address: string; country_code: string; tax_identification_number: string; tax_residency: string; taxpayer_type: string; vat_registered: boolean; withholding_category: string; statutory_profile_metadata: Record<string, unknown>; is_active: boolean; created_at: string; updated_at: string; }
export interface VendorBillLine {
  id: string;
  description: string;
  expense_account: string;
  quantity: string;
  unit_price: string;
  tax_code: string | null;
  withholding_rule: string | null;
  line_total: string;
  created_at: string;
  updated_at: string;
}

export interface VendorBill { id: string; vendor: string; bill_number: string; bill_date: string; due_date: string | null; currency: string; subtotal: string; tax_total: string; withholding_total: string; total_amount: string; amount_payable: string; status: string; accounting_period: string; journal_entry: string | null; lines: VendorBillLine[]; created_at: string; updated_at: string; }
export interface Customer { id: string; customer_code: string; name: string; email: string; phone: string; address: string; country_code: string; tax_identification_number: string; tax_residency: string; taxpayer_type: string; vat_registered: boolean; withholding_category: string; statutory_profile_metadata: Record<string, unknown>; is_active: boolean; created_at: string; updated_at: string; }
export interface InvoiceLine {
  id: string;
  description: string;
  income_account: string;
  quantity: string;
  unit_price: string;
  tax_code: string | null;
  line_total: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice { id: string; customer: string; invoice_number: string; invoice_date: string; due_date: string | null; currency: string; subtotal: string; tax_total: string; total_amount: string; status: string; accounting_period: string; journal_entry: string | null; external_tax_reference: string | null; lines: InvoiceLine[]; created_at: string; updated_at: string; }
export interface BankAccount { id: string; name: string; bank_name: string; masked_account_number: string; currency: string; ledger_account: string; is_active: boolean; created_at: string; updated_at: string; }
export interface Expense { id: string; expense_date: string; account: string; amount: string; currency: string; description: string; attachment: string | null; status: string; created_by: string; approved_by: string | null; journal_entry: string | null; created_at: string; updated_at: string; }
export interface Payment { id: string; payment_number: string; payment_date: string; amount: string; currency: string; payment_method: string; bank_account: string | null; vendor_bill: string; journal_entry: string | null; status: string; created_at: string; updated_at: string; }
export interface Receipt { id: string; receipt_number: string; receipt_date: string; amount: string; currency: string; payment_method: string; bank_account: string | null; invoice: string; journal_entry: string | null; status: string; created_at: string; updated_at: string; }
export interface BankStatementLine { id: string; bank_account: string; statement_date: string; external_id: string; reference: string; description: string; amount: string; currency: string; journal_entry: string | null; status: string; reconciled_by: string | null; reconciled_at: string | null; created_at: string; updated_at: string; }
export interface TrialBalanceRow { account_id: string; code: string; name: string; account_type: string; normal_balance: string; debit: string; credit: string; }
export interface TrialBalance { rows: TrialBalanceRow[]; total_debit: string; total_credit: string; balanced: boolean; }
export interface AccountingSetupChoice { mode: string; preset_version_id: string | null; preset_code: string | null; version_code: string | null; name: string; reporting_framework: string | null; compliance_warning?: string; }
export interface AccountingSetupChoices { country_code: string; currency: string; choices: AccountingSetupChoice[]; }
export interface AccountingConfiguration { id: string; country_code: string; base_currency: string; accounting_setup_mode: string; selected_accounting_preset_version: string | null; reporting_framework: string; tax_identification_number: string; vat_registered: boolean; is_vat_withholding_agent: boolean; fiscal_year_start_month: number; is_configured: boolean; }
