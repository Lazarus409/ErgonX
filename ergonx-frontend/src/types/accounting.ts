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
export interface IncomeStatement { income: TrialBalanceRow[]; expenses: TrialBalanceRow[]; total_income: string; total_expenses: string; net_income: string; }
export interface BalanceSheet { assets: TrialBalanceRow[]; liabilities: TrialBalanceRow[]; equity: TrialBalanceRow[]; total_assets: string; total_liabilities: string; retained_result: string; total_equity: string; balanced: boolean; }
export interface AccountingSetupChoice { mode: string; preset_version_id: string | null; preset_code: string | null; version_code: string | null; name: string; institution_type?: string; reporting_framework: string | null; coa_templates?: Array<{ id: string; name: string }>; compliance_warning?: string; }
export interface AccountingSetupChoices { country_code: string; currency: string; choices: AccountingSetupChoice[]; }
export interface AccountingConfiguration { id: string; country_code: string; base_currency: string; accounting_setup_mode: string; selected_accounting_preset_version: string | null; reporting_framework: string; tax_identification_number: string; vat_registered: boolean; is_vat_withholding_agent: boolean; statutory_profile_metadata: Record<string, unknown>; fiscal_year_start_month: number; is_configured: boolean; }
export type AccountingConfigurationPayload = Pick<AccountingConfiguration, "country_code" | "base_currency" | "accounting_setup_mode" | "selected_accounting_preset_version" | "reporting_framework" | "tax_identification_number" | "vat_registered" | "is_vat_withholding_agent" | "statutory_profile_metadata" | "fiscal_year_start_month" | "is_configured">;
export interface AccountingPresetApplicationResult { configuration: AccountingConfiguration; coa_template: { id: string; name: string }; created_count: number; reused_count: number; accounts: Account[]; }
/** Read-only statutory catalogue records attached to an applied accounting preset. */
export interface TaxCode { id: string; preset_version: string; code: string; name: string; tax_treatment: string; effective_from: string; effective_to: string | null; is_active: boolean; }
export interface TaxComponent { id: string; tax_code: string; code: string; name: string; rate: string; input_account_mapping_code: string | null; output_account_mapping_code: string | null; sequence: number; }
export interface WithholdingRule { id: string; preset_version: string; code: string; name: string; residency: string; transaction_category: string; rate: string; threshold: string | null; effective_from: string; effective_to: string | null; is_vat_withholding_rule: boolean; requires_confirmation: boolean; }
export interface GhanaComplianceReminder { id: string; institution: string; code: string; title: string; authority: string; due_date: string; statutory_reference: string; status: "OPEN" | "COMPLETED" | "WAIVED"; completed_by: string | null; completed_at: string | null; notes: string; created_at: string; updated_at: string; }
export interface PayrollAccountMappingTemplate { id: string; accounting_preset_version: string; payroll_component_code: string; debit_account_mapping_code: string | null; credit_account_mapping_code: string | null; description: string; }
export interface PayComponentAccountMapping { id: string; institution: string; pay_component: string; debit_account: string | null; credit_account: string | null; effective_from: string; effective_to: string | null; is_active: boolean; }
export type PayComponentAccountMappingPayload = Pick<PayComponentAccountMapping, "pay_component" | "debit_account" | "credit_account" | "effective_from" | "effective_to" | "is_active">;
