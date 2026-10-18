/** Custom report builder. Mirrors `apps/reports/builder.py`. */

import { apiDelete, apiGet, apiGetList, apiPatch, apiPost } from "./client";
import type { PaginatedData } from "@/types/api";

export type FieldType = "text" | "choice" | "date" | "number";
export interface BuilderField { key: string; label: string; type: FieldType }
export interface BuilderDataset { key: string; label: string; fields: BuilderField[] }
export interface BuilderFilter { field: string; op: "eq" | "ne" | "contains" | "gt" | "gte" | "lt" | "lte"; value: string }
export interface BuilderDefinition {
  columns: string[];
  filters: BuilderFilter[];
  group_by: string | null;
  aggregate: { op: "count" | "sum" | "avg"; field?: string };
  sort: { field?: string; desc?: boolean };
  limit: number;
}
export interface BuilderResult { dataset: string; columns: BuilderField[]; rows: Record<string, string | number | null>[]; total: number; truncated: boolean }
export interface CustomReport { id: string; name: string; description: string; dataset: string; definition: BuilderDefinition; visibility: "PRIVATE" | "INSTITUTION"; owner_name: string; is_owner: boolean; updated_at: string }

export const datasets = (): Promise<{ datasets: BuilderDataset[] }> => apiGet("/report-builder/datasets/");
export const runReport = (dataset: string, definition: BuilderDefinition): Promise<BuilderResult> => apiPost<BuilderResult>("/report-builder/run/", { dataset, definition });
export function exportReport(dataset: string, definition: BuilderDefinition): Promise<Blob> {
  return apiPost<Blob>("/report-builder/run/", { dataset, definition, format: "csv" }, { responseType: "blob" });
}
export const listCustomReports = (): Promise<PaginatedData<CustomReport>> => apiGetList<CustomReport>("/custom-reports/", { page_size: 100 });
export const saveCustomReport = (payload: Pick<CustomReport, "name" | "description" | "dataset" | "definition" | "visibility">, id?: string): Promise<CustomReport> =>
  id ? apiPatch<CustomReport>(`/custom-reports/${id}/`, payload) : apiPost<CustomReport>("/custom-reports/", payload);
export const deleteCustomReport = (id: string): Promise<void> => apiDelete(`/custom-reports/${id}/`);
