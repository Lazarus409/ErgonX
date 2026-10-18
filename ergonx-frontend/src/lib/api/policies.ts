/**
 * Workplace policies and employee acknowledgements. Mirrors `apps/documents/policies.py`.
 *
 * HR:        /policies/ (+ publish/, new-version/, retire/, file/, acknowledgements/)
 * Employee:  /employees/me/policies/ (+ {id}/, {id}/file/, {id}/acknowledge/)
 */

import { apiDelete, apiDownload, apiGet, apiGetList, apiPatch, apiPost, apiPostMultipart } from "./client";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { ListParams, PaginatedData } from "@/types/api";

export type PolicyStatus = "DRAFT" | "PUBLISHED" | "RETIRED";
export type PolicyCategory = "CODE_OF_CONDUCT" | "HR" | "HEALTH_SAFETY" | "IT_SECURITY" | "DATA_PROTECTION" | "FINANCE" | "OTHER";
export type AcknowledgementStatus = "ACKNOWLEDGED" | "PENDING" | "OVERDUE" | "READ_ONLY";

export const POLICY_CATEGORY_LABELS: Record<PolicyCategory, string> = {
  CODE_OF_CONDUCT: "Code of conduct",
  HR: "HR & employment",
  HEALTH_SAFETY: "Health & safety",
  IT_SECURITY: "IT & security",
  DATA_PROTECTION: "Data protection",
  FINANCE: "Finance",
  OTHER: "Other",
};

export const ACKNOWLEDGEMENT_STATUS_LABELS: Record<AcknowledgementStatus, string> = {
  ACKNOWLEDGED: "Acknowledged",
  PENDING: "To acknowledge",
  OVERDUE: "Overdue",
  READ_ONLY: "For information",
};

export const ACKNOWLEDGEMENT_STATUS_TONES: Record<AcknowledgementStatus, "success" | "warning" | "danger" | "neutral"> = {
  ACKNOWLEDGED: "success",
  PENDING: "warning",
  OVERDUE: "danger",
  READ_ONLY: "neutral",
};

export interface PolicyFile {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface AcknowledgementSummary {
  applicable: number;
  acknowledged: number;
  pending: number;
  overdue: number;
  rate: number;
}

export interface Policy {
  id: string;
  title: string;
  category: PolicyCategory;
  category_label: string;
  summary: string;
  body: string;
  document: PolicyFile | null;
  employment_types: string[];
  requires_acknowledgement: boolean;
  acknowledge_within_days: number;
  version: number;
  status: PolicyStatus;
  published_at: string | null;
  published_by_name: string;
  change_summary: string;
  /** Only for published policies, within the caller's employee scope. */
  acknowledgement_summary: AcknowledgementSummary | null;
  created_at: string;
  updated_at: string;
}

export interface PolicyPayload {
  title: string;
  category: PolicyCategory;
  summary: string;
  body: string;
  employment_types: string[];
  requires_acknowledgement: boolean;
  acknowledge_within_days: number;
}

export interface PolicyAcknowledgement {
  id: string;
  version: number;
  signed_name: string;
  acknowledged_at: string;
}

export interface PolicyAcknowledgementRow {
  employee_id: string;
  employee: string;
  employee_number: string;
  status: AcknowledgementStatus;
  due_date: string;
  acknowledgement: PolicyAcknowledgement | null;
}

export interface PolicyAcknowledgementReport {
  policy_id: string;
  version: number;
  summary: AcknowledgementSummary;
  employees: PolicyAcknowledgementRow[];
}

/** A policy as the signed-in employee sees it. */
export interface MyPolicy {
  id: string;
  title: string;
  category: PolicyCategory;
  category_label: string;
  summary: string;
  body?: string;
  version: number;
  published_at: string | null;
  change_summary: string;
  requires_acknowledgement: boolean;
  document: PolicyFile | null;
  status: AcknowledgementStatus;
  due_date: string;
  acknowledgement: PolicyAcknowledgement | null;
}

function toForm(payload: Partial<PolicyPayload> & { change_summary?: string }, file: File) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) value.forEach((item) => form.append(key, item));
    else form.append(key, String(value));
  });
  form.append("uploaded_file", file);
  return form;
}

export function listPolicies(params: ListParams = {}): Promise<PaginatedData<Policy>> {
  return apiGetList<Policy>("/policies/", { page_size: MAX_PAGE_SIZE, ...params });
}

export function getPolicy(id: string): Promise<Policy> {
  return apiGet<Policy>(`/policies/${id}/`);
}

export async function createPolicy(payload: PolicyPayload, file?: File | null): Promise<Policy> {
  if (!file) return apiPost<Policy, PolicyPayload>("/policies/", payload);
  return apiPostMultipart<Policy>("/policies/", toForm(payload, file));
}

export async function updatePolicy(id: string, payload: Partial<PolicyPayload>, file?: File | null): Promise<Policy> {
  const policy = await apiPatch<Policy, Partial<PolicyPayload>>(`/policies/${id}/`, payload);
  if (!file) return policy;
  const form = new FormData();
  form.append("uploaded_file", file);
  return apiPostMultipart<Policy>(`/policies/${id}/file/`, form);
}

export function deletePolicy(id: string): Promise<void> {
  return apiDelete(`/policies/${id}/`);
}

export function publishPolicy(id: string): Promise<Policy> {
  return apiPost<Policy>(`/policies/${id}/publish/`);
}

export function retirePolicy(id: string): Promise<Policy> {
  return apiPost<Policy>(`/policies/${id}/retire/`);
}

export function publishNewVersion(id: string, payload: Partial<PolicyPayload> & { change_summary: string }, file?: File | null): Promise<Policy> {
  if (!file) return apiPost<Policy>(`/policies/${id}/new-version/`, payload);
  return apiPostMultipart<Policy>(`/policies/${id}/new-version/`, toForm(payload, file));
}

export function downloadPolicyFile(id: string): Promise<Blob> {
  return apiDownload(`/policies/${id}/file/`);
}

export function getPolicyAcknowledgements(id: string): Promise<PolicyAcknowledgementReport> {
  return apiGet<PolicyAcknowledgementReport>(`/policies/${id}/acknowledgements/`);
}

export function getMyPolicies(): Promise<{ summary: AcknowledgementSummary; policies: MyPolicy[] }> {
  return apiGet(`/employees/me/policies/`);
}

export function getMyPolicy(id: string): Promise<MyPolicy> {
  return apiGet<MyPolicy>(`/employees/me/policies/${id}/`);
}

export function downloadMyPolicyFile(id: string): Promise<Blob> {
  return apiDownload(`/employees/me/policies/${id}/file/`);
}

export function acknowledgePolicy(id: string, signedName: string): Promise<MyPolicy> {
  return apiPost<MyPolicy>(`/employees/me/policies/${id}/acknowledge/`, { signed_name: signedName, confirm: true });
}

export async function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
