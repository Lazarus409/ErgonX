import { apiGet } from "./client";

export interface ReportResult { report: string; rows: Array<Record<string, string | number | null>>; }

export function getReport(name: "workforce-cost" | "recruitment" | "leave" | "attendance" | "payroll" | "accounting" | "ap-ar" | "expenses", filters: { status?: string; date_from?: string; date_to?: string } = {}): Promise<ReportResult> {
  return apiGet<ReportResult>(`/reports/${name}/`, { params: filters });
}
