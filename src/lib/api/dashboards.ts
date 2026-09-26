/**
 * Dashboard service.
 *
 * The backend exposes plural `/dashboards/<name>/` routes. The older singular
 * paths (`/dashboard/executive/`, `/payroll/dashboard/`, ...) do not exist.
 * The accounting screen reads the `finance` rollup; there is no
 * `/accounting/dashboard/` endpoint.
 *
 * Each route requires the `dashboard.<name>.view` permission.
 */

import { apiGet } from "./client";
import type {
  AttendanceDashboard,
  DepartmentDashboard,
  ExecutiveDashboard,
  FinanceDashboard,
  HrDashboard,
  LeaveDashboard,
  PayrollDashboard,
  RecruitmentDashboard,
} from "@/types/dashboards";

export async function getExecutiveDashboard(): Promise<ExecutiveDashboard> {
  return apiGet<ExecutiveDashboard>("/dashboards/executive/");
}

/** Roster, today's attendance and leave for the departments the user heads. */
export async function getDepartmentDashboard(): Promise<DepartmentDashboard> {
  return apiGet<DepartmentDashboard>("/dashboards/department/");
}

export async function getHrDashboard(): Promise<HrDashboard> {
  return apiGet<HrDashboard>("/dashboards/hr/");
}

export async function getLeaveDashboard(): Promise<LeaveDashboard> {
  return apiGet<LeaveDashboard>("/dashboards/leave/");
}

export async function getAttendanceDashboard(): Promise<AttendanceDashboard> {
  return apiGet<AttendanceDashboard>("/dashboards/attendance/");
}

export async function getPayrollDashboard(): Promise<PayrollDashboard> {
  return apiGet<PayrollDashboard>("/dashboards/payroll/");
}

export async function getRecruitmentDashboard(): Promise<RecruitmentDashboard> { return apiGet<RecruitmentDashboard>("/dashboards/recruitment/"); }

/** Used by the accounting dashboard screen. */
export async function getFinanceDashboard(): Promise<FinanceDashboard> {
  return apiGet<FinanceDashboard>("/dashboards/finance/");
}
