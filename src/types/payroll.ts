/** Payroll API shapes used by the progressively connected payroll screens. */

export type PayrollRunStatus =
  | "DRAFT"
  | "CALCULATING"
  | "CALCULATED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "FINALIZED"
  | "CANCELLED";

export interface PayrollPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  pay_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollConfiguration { id: string; country_code: string; currency: string; payroll_frequency: string; payroll_setup_mode: string; selected_payroll_preset_version: string | null; pay_day_rule: Record<string, unknown>; rounding_rule: Record<string, unknown>; is_configured: boolean; configured_at: string | null; }
export interface PayrollSetupChoice { mode: string; preset_version_id: string | null; preset_code: string | null; version_code: string | null; name: string; recommended: boolean; compliance_warning: string | null; }
export interface PayrollSetupChoices { country_code: string; currency: string; choices: PayrollSetupChoice[]; }
export interface ContributionRule { id: string; preset_version: string; code: string; name: string; basis: string; employee_rate: string; employer_rate: string; minimum_basis: string | null; maximum_basis: string | null; effective_from: string; effective_to: string | null; }
export interface StatutoryThreshold { id: string; preset_version: string; code: string; name: string; amount: string; unit: string; effective_from: string; effective_to: string | null; }

export interface PayrollRun {
  id: string;
  payroll_period: string;
  preset_version: string | null;
  run_number: number;
  status: PayrollRunStatus | string;
  started_by: string;
  started_at: string;
  approved_by: string | null;
  approved_at: string | null;
  finalized_by: string | null;
  finalized_at: string | null;
  statutory_snapshot: Record<string, unknown>;
  accounting_journal_entry: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollRunFilters {
  payroll_period?: string;
  preset_version?: string;
  status?: PayrollRunStatus | string;
  run_number?: number;
}

export interface PayrollRecord {
  id: string;
  payroll_run: string;
  employee: string;
  gross_pay: string;
  taxable_income: string;
  total_deductions: string;
  employee_contributions: string;
  employer_contributions: string;
  net_pay: string;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PayslipItem {
  code: string;
  name: string;
  source: string;
  quantity: string | null;
  rate: string | null;
  amount: string;
  metadata: Record<string, unknown>;
}

export interface PayslipPayload {
  payroll_run_id: string;
  payroll_record_id: string;
  employee_id: string;
  currency: string;
  gross_pay: string;
  taxable_income: string;
  total_deductions: string;
  employee_contributions: string;
  employer_contributions: string;
  net_pay: string;
  items: PayslipItem[];
}

export interface PayslipPeriodSummary {
  name: string;
  start_date: string;
  end_date: string;
  pay_date: string;
}

export interface Payslip {
  id: string;
  payroll_record: string;
  generated_at: string;
  document_reference: string | null;
  checksum: string;
  payroll_period: PayslipPeriodSummary;
  payload: PayslipPayload;
  created_at: string;
  updated_at: string;
}

export interface PayrollReconciliation {
  payroll_run_id: string;
  status: string;
  record_count: number;
  totals: {
    gross_pay: string;
    total_deductions: string;
    net_pay: string;
  };
  discrepancy_count: number;
  discrepancies: Array<Record<string, unknown>>;
}

export type PayComponentType = "EARNING" | "DEDUCTION" | "EMPLOYER_CONTRIBUTION";
export type PayComponentCalculationType = "FIXED" | "PERCENTAGE";
export type PayComponentCashOrKind = "CASH" | "KIND";

export interface PayComponent {
  id: string;
  name: string;
  code: string;
  component_type: PayComponentType;
  calculation_type: PayComponentCalculationType;
  taxable: boolean;
  pensionable: boolean;
  cash_or_kind: PayComponentCashOrKind;
  recurring: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalaryStructure {
  id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalaryStructureComponent {
  id: string;
  salary_structure: string;
  pay_component: string;
  default_amount: string | null;
  default_percentage: string | null;
  percentage_base_component: string | null;
  sequence: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}
export interface PayrollAdjustment { id: string; employee: string; payroll_period: string; pay_component: string; amount: string; reason: string; status: string; created_by: string; approved_by: string | null; applied_run: string | null; created_at: string; updated_at: string; }
