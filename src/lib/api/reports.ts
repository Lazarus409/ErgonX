import { apiGet } from "./client";

export interface ReportResult { report: string; rows: Array<Record<string, string | number | null>>; }

export function getReport(name: "workforce-cost" | "leave" | "attendance" | "payroll" | "accounting" | "ap-ar" | "expenses"): Promise<ReportResult> {
  return apiGet<ReportResult>(`/reports/${name}/`);
}
