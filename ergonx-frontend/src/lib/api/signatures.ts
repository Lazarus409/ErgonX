/**
 * Document signature requests: HR sends a document to one employee, who signs it
 * by typing their name. Mirrors `apps/documents/signatures.py`.
 */

import { apiDownload, apiGet, apiGetList, apiPost } from "./client";
import type { PaginatedData } from "@/types/api";

export type SignatureStatus = "PENDING" | "SIGNED" | "DECLINED" | "CANCELLED";
export const SIGNATURE_STATUS_TONES: Record<SignatureStatus, "warning" | "success" | "danger" | "neutral"> = { PENDING: "warning", SIGNED: "success", DECLINED: "danger", CANCELLED: "neutral" };

export interface SignatureRequest {
  id: string;
  document: string;
  document_name: string;
  employee: string;
  employee_name: string;
  title: string;
  message: string;
  due_date: string | null;
  status: SignatureStatus;
  status_label: string;
  requested_by_name: string;
  document_sha256: string;
  signed_name: string;
  signed_at: string | null;
  decline_reason: string;
  created_at: string;
}

export function listSignatureRequests(params: { employee?: string; status?: SignatureStatus } = {}): Promise<PaginatedData<SignatureRequest>> {
  return apiGetList<SignatureRequest>("/signature-requests/", { page_size: 100, ...params });
}

export function requestSignature(payload: { document: string; employee: string; title?: string; message?: string; due_date?: string | null }): Promise<SignatureRequest> {
  return apiPost<SignatureRequest>("/signature-requests/", payload);
}

export function cancelSignatureRequest(id: string): Promise<SignatureRequest> {
  return apiPost<SignatureRequest>(`/signature-requests/${id}/cancel/`);
}

export function downloadSignatureRecord(id: string): Promise<Blob> {
  return apiDownload(`/signature-requests/${id}/certificate/`);
}

export function listMySignatureRequests(): Promise<SignatureRequest[]> {
  return apiGet<SignatureRequest[]>("/employees/me/signature-requests/");
}

export function downloadMySignatureDocument(id: string): Promise<Blob> {
  return apiDownload(`/employees/me/signature-requests/${id}/file/`);
}

export function downloadMySignatureRecord(id: string): Promise<Blob> {
  return apiDownload(`/employees/me/signature-requests/${id}/certificate/`);
}

export function signDocument(id: string, signedName: string): Promise<SignatureRequest> {
  return apiPost<SignatureRequest>(`/employees/me/signature-requests/${id}/sign/`, { signed_name: signedName, confirm: true });
}

export function declineSignature(id: string, reason: string): Promise<SignatureRequest> {
  return apiPost<SignatureRequest>(`/employees/me/signature-requests/${id}/decline/`, { reason });
}
