/**
 * Employee complaints (grievances): filed by employees, handled by HR.
 * Mirrors `apps/complaints`.
 */

import { apiGet, apiGetList, apiPost } from "./client";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { ListParams, PaginatedData } from "@/types/api";

export type ComplaintCategory = "HARASSMENT" | "BULLYING" | "DISCRIMINATION" | "MISCONDUCT" | "HEALTH_SAFETY" | "PAY_BENEFITS" | "WORKING_CONDITIONS" | "MANAGEMENT" | "OTHER";
export type ComplaintStatus = "SUBMITTED" | "UNDER_REVIEW" | "INVESTIGATING" | "RESOLVED" | "CLOSED" | "WITHDRAWN";
export type ComplaintPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  HARASSMENT: "Harassment (including sexual harassment)",
  BULLYING: "Bullying or intimidation",
  DISCRIMINATION: "Discrimination",
  MISCONDUCT: "Misconduct or unethical behaviour",
  HEALTH_SAFETY: "Health and safety",
  PAY_BENEFITS: "Pay, allowances or benefits",
  WORKING_CONDITIONS: "Working conditions or hours",
  MANAGEMENT: "Management or supervision",
  OTHER: "Other",
};
export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = { SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", INVESTIGATING: "Investigating", RESOLVED: "Resolved", CLOSED: "Closed", WITHDRAWN: "Withdrawn" };
export const COMPLAINT_STATUS_TONES: Record<ComplaintStatus, "info" | "warning" | "success" | "danger" | "neutral"> = { SUBMITTED: "info", UNDER_REVIEW: "warning", INVESTIGATING: "warning", RESOLVED: "success", CLOSED: "neutral", WITHDRAWN: "neutral" };
export const COMPLAINT_PRIORITY_LABELS: Record<ComplaintPriority, string> = { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" };
export const COMPLAINT_PRIORITY_TONES: Record<ComplaintPriority, "info" | "warning" | "danger" | "neutral"> = { LOW: "neutral", NORMAL: "info", HIGH: "warning", URGENT: "danger" };
export const OPEN_COMPLAINT_STATUSES: ComplaintStatus[] = ["SUBMITTED", "UNDER_REVIEW", "INVESTIGATING"];

export interface ComplaintSummary {
  id: string;
  code: string;
  category: ComplaintCategory;
  category_label: string;
  subject: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  complainant: string;
  complainant_name: string;
  complainant_number: string;
  respondent: string | null;
  respondent_name: string;
  assigned_to: string | null;
  assigned_to_name: string;
  incident_date: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ComplaintNote {
  id: string;
  body: string;
  is_internal: boolean;
  author_name: string;
  from_hr: boolean;
  created_at: string;
}

export interface Complaint extends ComplaintSummary {
  description: string;
  incident_location: string;
  respondent_description: string;
  resolution: string;
  resolved_by_name: string;
  closed_at: string | null;
  withdrawn_at: string | null;
  notes: ComplaintNote[];
  viewer: { is_complainant: boolean; is_staff: boolean; can_manage: boolean; can_withdraw: boolean; can_message: boolean };
  updated_at: string;
}

export interface ComplaintOverview {
  total: number;
  open: number;
  urgent_open: number;
  overdue: number;
  overdue_days: number;
  resolved_this_year: number;
  average_days_to_resolve: number | null;
  by_status: Record<ComplaintStatus, number>;
  by_category: Array<{ category: ComplaintCategory; label: string; count: number }>;
}

export interface FileComplaintPayload {
  category: ComplaintCategory;
  subject: string;
  description: string;
  incident_date?: string | null;
  incident_location?: string;
  respondent?: string | null;
  respondent_description?: string;
}

export interface Colleague { id: string; name: string; employee_number: string; department: string }
export interface ComplaintHandler { id: string; name: string; email: string }

export function listComplaints(params?: ListParams & { mine?: string; assigned?: string }): Promise<PaginatedData<ComplaintSummary>> {
  return apiGetList<ComplaintSummary>("/complaints/", { page_size: MAX_PAGE_SIZE, ...params });
}
export function getComplaint(id: string): Promise<Complaint> {
  return apiGet<Complaint>(`/complaints/${id}/`);
}
export function fileComplaint(payload: FileComplaintPayload): Promise<Complaint> {
  return apiPost<Complaint, FileComplaintPayload>("/complaints/", payload);
}
export function getOverview(): Promise<ComplaintOverview> {
  return apiGet<ComplaintOverview>("/complaints/overview/");
}
export function listHandlers(): Promise<ComplaintHandler[]> {
  return apiGet<ComplaintHandler[]>("/complaints/handlers/");
}
export function searchColleagues(search: string): Promise<Colleague[]> {
  return apiGet<Colleague[]>("/complaints/colleagues/", { params: { search } });
}
export function assign(id: string, assignee: string): Promise<Complaint> {
  return apiPost<Complaint, { assignee: string }>(`/complaints/${id}/assign/`, { assignee });
}
export function setPriority(id: string, priority: ComplaintPriority): Promise<Complaint> {
  return apiPost<Complaint, { priority: ComplaintPriority }>(`/complaints/${id}/priority/`, { priority });
}
export function investigate(id: string): Promise<Complaint> {
  return apiPost<Complaint, Record<string, never>>(`/complaints/${id}/investigate/`, {});
}
export function resolve(id: string, text: string): Promise<Complaint> {
  return apiPost<Complaint, { text: string }>(`/complaints/${id}/resolve/`, { text });
}
export function reopen(id: string, text: string): Promise<Complaint> {
  return apiPost<Complaint, { text: string }>(`/complaints/${id}/reopen/`, { text });
}
export function close(id: string): Promise<Complaint> {
  return apiPost<Complaint, Record<string, never>>(`/complaints/${id}/close/`, {});
}
export function withdraw(id: string, text: string): Promise<Complaint> {
  return apiPost<Complaint, { text: string }>(`/complaints/${id}/withdraw/`, { text });
}
export function addNote(id: string, body: string, isInternal: boolean): Promise<Complaint> {
  return apiPost<Complaint, { body: string; is_internal: boolean }>(`/complaints/${id}/notes/`, { body, is_internal: isInternal });
}
