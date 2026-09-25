/**
 * Dashboard rollup types.
 *
 * Mirrors `apps/dashboards/views.py`. Note the API paths are plural
 * (`/dashboards/...`) and the accounting screen reads the `finance` rollup;
 * there is no dedicated accounting dashboard endpoint.
 */

export interface StatusCount {
  status: string;
  count: number;
}

export interface HireYearCount {
  year: number | null;
  count: number;
}

export interface NamedCount {
  count: number;
  department__name?: string;
  grade__name?: string;
  location__name?: string;
  employment_type?: string;
}

export interface RecentHire {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  hire_date: string;
  employments__department__name: string;
  employments__position__title: string;
}

export interface EmployeeMetrics {
  total_employees: number;
  active_employees: number;
  by_status: StatusCount[];
}

export interface ExecutiveDashboard extends EmployeeMetrics {
  executive_title?: string;
  currency: string;
  pending_leave_requests?: number;
  pending_journals?: number;
  payroll_cost?: string | number;
  attendance_today?: {
    present: number;
    late: number;
    absent: number;
    on_leave: number;
  };
  financial_position?: {
    bank_balance: string | number;
    registered_bank_accounts: number;
    accounts_payable: string | number;
    accounts_receivable: string | number;
    posted_expenses: string | number;
  };
  recruitment_summary?: {
    open_jobs: number;
    active_candidates: number;
    applications: number;
    scheduled_interviews: number;
    offers_extended: number;
  };
  payroll_by_period?: Array<{
    label: string;
    period_end: string;
    gross_pay: string | number;
  }>;
  profit_and_loss_trend?: ProfitAndLossPoint[];
  cash_flow_trend?: CashFlowPoint[];
}

export interface ProfitAndLossPoint {
  month: string;
  income: string | number;
  expenses: string | number;
  net_income: string | number;
}

export interface CashFlowPoint {
  month: string;
  inflow: string | number;
  outflow: string | number;
  net_movement: string | number;
}

export interface HrDashboard extends EmployeeMetrics {
  by_hire_year: HireYearCount[];
  by_department: NamedCount[];
  by_grade: NamedCount[];
  by_location: NamedCount[];
  by_employment_type: NamedCount[];
  recent_hires: RecentHire[];
}

export interface LeaveDashboard {
  pending: number;
  currently_on_leave: number;
  upcoming: number;
  by_leave_type: Array<{
    leave_type__name: string;
    request_count: number;
    requested_days: string | number;
  }>;
  monthly_approved_leave: Array<{
    month: string;
    request_count: number;
    requested_days: string | number;
  }>;
  balance_utilisation: {
    year: number;
    entitlement_days: string | number;
    used_days: string | number;
    available_days: string | number;
    utilisation_percent: string | number | null;
  };
  /** Current-year approved leave days by current department (top 8). */
  approved_days_by_department?: Array<{ department: string; requested_days: string | number; request_count: number }>;
  /** 28 consecutive days from today: approved requests covering each day. */
  leave_calendar?: Array<{ date: string; on_leave: number }>;
}

export interface AttendanceDashboard {
  present: number;
  late: number;
  absent: number;
  overtime_minutes: number;
  weekly_attendance: Array<{
    date: string;
    present: number;
    late: number;
    absent: number;
    on_leave: number;
    overtime_minutes: number;
  }>;
  by_department: Array<{
    employee__employments__department__name: string;
    present: number;
    late: number;
    absent: number;
    on_leave: number;
    total: number;
  }>;
  repeated_lateness: Array<{
    employee_id: string;
    employee__first_name: string;
    employee__last_name: string;
    employee__employee_number: string;
    employee__employments__department__name: string;
    late_occurrences: number;
    total_minutes_late: number;
  }>;
  lateness_trend: Array<{ month: string; late_occurrences: number; total_minutes_late: number }>;
  lateness_by_department: Array<{ employee__employments__department__name: string; late_occurrences: number; total_minutes_late: number }>;
}

export interface PayrollDashboard {
  latest_run_id: string | null;
  latest_run_status: string | null;
  pending_runs: number;
  finalized_gross_pay: string | number;
  finalized_net_pay: string | number;
  finalized_deductions: string | number;
  employer_contributions: string | number;
  runs_by_status: StatusCount[];
  payroll_by_period: Array<{
    label: string;
    period_end: string;
    gross_pay: string | number;
    net_pay: string | number;
    total_deductions: string | number;
  }>;
  /** Gross pay by current department for the latest finalized run. */
  cost_by_department?: { period: string | null; departments: Array<{ department: string; gross_pay: string | number }> };
}

export interface FinanceDashboard {
  currency: string;
  pending_journals: number;
  accounts_payable: string | number;
  accounts_receivable: string | number;
  expenses: string | number;
  bank_balance: string | number;
  registered_bank_accounts: number;
  accounts_payable_aging: Array<{ bucket: string; amount: string | number }>;
  accounts_receivable_aging: Array<{ bucket: string; amount: string | number }>;
  journals_by_status: StatusCount[];
  profit_and_loss_trend: ProfitAndLossPoint[];
  cash_flow_trend: CashFlowPoint[];
  /** Posted expenses by expense account: top five plus "Other". */
  expenses_by_account?: Array<{ label: string; value: string | number }>;
  unreconciled_bank_lines?: {
    count: number;
    latest: Array<{ id: string; statement_date: string; bank_account: string; reference: string; description: string; amount: string | number; currency: string; status: string }>;
  };
}

export interface RecruitmentDashboard {
  open_jobs: number;
  active_candidates: number;
  applications: number;
  scheduled_interviews: number;
  offers_extended: number;
  pipeline: Array<{ name: string; count: number }>;
  applications_by_status?: Array<{ status: string; count: number }>;
  /** Six calendar months ending with the current month, by application date. */
  applications_trend?: Array<{ month: string; applications: number }>;
  top_open_jobs?: Array<{ title: string; application_count: number }>;
  applications_by_source?: Array<{ source: string; count: number }>;
  interviews_by_status?: Array<{ status: string; count: number }>;
  /** Accepted offers bucketed by days from application to acceptance. */
  time_to_hire?: Array<{ bucket: string; hires: number }>;
}
