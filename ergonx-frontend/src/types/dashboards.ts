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

export interface EmployeeMetrics {
  total_employees: number;
  active_employees: number;
  by_status: StatusCount[];
}

export interface ExecutiveDashboard extends EmployeeMetrics {
  pending_leave_requests: number;
  pending_journals: number;
  payroll_cost: string | number;
}

export interface HrDashboard extends EmployeeMetrics {
  by_hire_year: HireYearCount[];
}

export interface LeaveDashboard {
  pending: number;
  currently_on_leave: number;
  upcoming: number;
}

export interface AttendanceDashboard {
  present: number;
  late: number;
  absent: number;
  overtime_minutes: number;
}

export interface PayrollDashboard {
  latest_run_id: string | null;
  latest_run_status: string | null;
  pending_runs: number;
  finalized_gross_pay: string | number;
}

export interface FinanceDashboard {
  pending_journals: number;
  accounts_payable: string | number;
  accounts_receivable: string | number;
  expenses: string | number;
}
