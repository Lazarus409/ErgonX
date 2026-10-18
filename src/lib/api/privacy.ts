/**
 * Privacy controls: retention, legal holds, data subject requests and consents.
 * Mirrors `apps/privacy`.
 */

import { apiDownload, apiGet, apiGetList, apiPatch, apiPost } from "./client";
import type { PaginatedData } from "@/types/api";

export type RetentionCategory = "CANDIDATES" | "FORMER_EMPLOYEES" | "ATTENDANCE" | "AUDIT";
export type DsrType = "ACCESS" | "RECTIFICATION" | "ERASURE" | "OBJECTION";
export type DsrStatus = "RECEIVED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

export const RETENTION_LABELS: Record<RetentionCategory, string> = {
  CANDIDATES: "Unsuccessful and withdrawn candidates",
  FORMER_EMPLOYEES: "Former employees' personal contact details",
  ATTENDANCE: "Attendance records",
  AUDIT: "Audit trail",
};
export const DSR_TYPE_LABELS: Record<DsrType, string> = { ACCESS: "Copy of my data", RECTIFICATION: "Correct my data", ERASURE: "Erase my data", OBJECTION: "Object to processing" };
export const DSR_STATUS_TONES: Record<DsrStatus, "info" | "warning" | "success" | "neutral"> = { RECEIVED: "info", IN_PROGRESS: "warning", COMPLETED: "success", REJECTED: "neutral" };

export interface RetentionRule { id: string; category: RetentionCategory; category_label: string; keep_months: number; action: "ANONYMISE" | "REVIEW"; is_active: boolean; notes: string; last_run_at: string | null }
export interface RetentionReport { rules: { rule_id: string; category: RetentionCategory; category_label: string; keep_months: number; action: "ANONYMISE" | "REVIEW"; due: number; sample: { id: string; name: string }[]; last_run_at: string | null }[]; legal_holds: number }
export interface LegalHold { id: string; title: string; reason: string; employees: string[]; candidates: string[]; employee_names: string[]; candidate_names: string[]; released_at: string | null; created_at: string }
export interface DataSubjectRequest { id: string; request_type: DsrType; type_label: string; employee: string | null; candidate: string | null; subject: string; requester_name: string; requester_email: string; details: string; status: DsrStatus; status_label: string; received_at: string; due_on: string; overdue: boolean; outcome: string; closed_at: string | null }
export interface ConsentRow { kind: "CAREERS_DATA_USE" | "POLICY_ACKNOWLEDGEMENT"; subject: string; detail: string; given_at: string }

export const listRetentionRules = (): Promise<PaginatedData<RetentionRule>> => apiGetList<RetentionRule>("/privacy/retention-rules/", { page_size: 50 });
export const saveRetentionRule = (rule: Partial<RetentionRule> & { category: RetentionCategory }, id?: string): Promise<RetentionRule> =>
  id ? apiPatch<RetentionRule>(`/privacy/retention-rules/${id}/`, rule) : apiPost<RetentionRule>("/privacy/retention-rules/", rule);
export const retentionReport = (): Promise<RetentionReport> => apiGet<RetentionReport>("/privacy/retention-rules/report/");
export const runRetention = (id: string): Promise<{ processed: number; report: RetentionReport }> => apiPost(`/privacy/retention-rules/${id}/run/`);

export const listLegalHolds = (): Promise<PaginatedData<LegalHold>> => apiGetList<LegalHold>("/privacy/legal-holds/", { page_size: 100 });
export const createLegalHold = (payload: { title: string; reason: string; employees: string[]; candidates: string[] }): Promise<LegalHold> => apiPost<LegalHold>("/privacy/legal-holds/", payload);
export const releaseLegalHold = (id: string): Promise<LegalHold> => apiPost<LegalHold>(`/privacy/legal-holds/${id}/release/`);

export const listRequests = (): Promise<PaginatedData<DataSubjectRequest>> => apiGetList<DataSubjectRequest>("/privacy/requests/", { page_size: 100 });
export const logRequest = (payload: { request_type: DsrType; requester_name: string; requester_email?: string; details?: string; employee?: string | null; candidate?: string | null }): Promise<DataSubjectRequest> => apiPost<DataSubjectRequest>("/privacy/requests/", payload);
export const updateRequest = (id: string, status: DsrStatus, outcome: string): Promise<DataSubjectRequest> => apiPost<DataSubjectRequest>(`/privacy/requests/${id}/status/`, { status, outcome });
export const exportRequest = (id: string): Promise<Blob> => apiDownload(`/privacy/requests/${id}/export/`);
export const eraseCandidate = (id: string): Promise<DataSubjectRequest> => apiPost<DataSubjectRequest>(`/privacy/requests/${id}/erase/`);
export const consents = (): Promise<{ consents: ConsentRow[] }> => apiGet("/privacy/requests/consents/");

export const myRequests = (): Promise<{ requests: DataSubjectRequest[] }> => apiGet("/me/privacy/");
export const makeMyRequest = (request_type: DsrType, details: string): Promise<DataSubjectRequest> => apiPost<DataSubjectRequest>("/me/privacy/", { request_type, details });
