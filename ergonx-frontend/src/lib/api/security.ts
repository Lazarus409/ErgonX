/** Security overview, compliance evidence and platform restore tests. Mirrors `apps/security`. */

import { apiDownload, apiGet, apiGetList, apiPatch, apiPost } from "./client";
import type { PaginatedData } from "@/types/api";

export type CheckStatus = "CRITICAL" | "WARNING" | "INFO" | "OK";
export const CHECK_TONES: Record<CheckStatus, "danger" | "warning" | "info" | "success"> = { CRITICAL: "danger", WARNING: "warning", INFO: "info", OK: "success" };

export interface SecurityCheck { code: string; title: string; status: CheckStatus; detail: string; items: Record<string, string | number | null>[]; route: string }
export interface SecurityOverview { generated_at: string; score: { critical: number; warning: number }; checks: SecurityCheck[]; events: { action: string; actor: string; ip_address: string | null; at: string }[] }
export interface RestoreTest { id: string; performed_on: string; backup_reference: string; environment: string; result: "PASSED" | "PARTIAL" | "FAILED"; result_label: string; duration_minutes: number | null; checks: string; issues: string; performed_by_name: string; created_at: string }

export const getSecurityOverview = (): Promise<SecurityOverview> => apiGet<SecurityOverview>("/security/overview/");
export const downloadEvidence = (from: string, to: string): Promise<Blob> => apiDownload("/security/evidence/", { from, to });
export const listRestoreTests = (): Promise<PaginatedData<RestoreTest>> => apiGetList<RestoreTest>("/platform/restore-tests/", { page_size: 50 });
export const recordRestoreTest = (payload: Omit<RestoreTest, "id" | "result_label" | "performed_by_name" | "created_at">): Promise<RestoreTest> => apiPost<RestoreTest>("/platform/restore-tests/", payload);

export type IncidentStatus = "DETECTED" | "INVESTIGATING" | "CONTAINED" | "RECOVERED" | "CLOSED";
export type IncidentSeverity = "SEV1" | "SEV2" | "SEV3";
export type IncidentKind = "OUTAGE" | "ATTACK" | "ACCOUNT_COMPROMISE" | "DATA_LOSS" | "DATA_EXPOSURE" | "VULNERABILITY" | "OTHER";
export const INCIDENT_KINDS: Record<IncidentKind, string> = {
  OUTAGE: "Outage or degraded service", ATTACK: "Attack or intrusion attempt", ACCOUNT_COMPROMISE: "Compromised account",
  DATA_LOSS: "Data loss or corruption", DATA_EXPOSURE: "Data exposed to the wrong people", VULNERABILITY: "Vulnerability found", OTHER: "Other",
};
export const INCIDENT_STATUS_ORDER: IncidentStatus[] = ["DETECTED", "INVESTIGATING", "CONTAINED", "RECOVERED", "CLOSED"];
export const INCIDENT_STATUS_TONES: Record<IncidentStatus, "danger" | "warning" | "info" | "success" | "neutral"> = { DETECTED: "danger", INVESTIGATING: "warning", CONTAINED: "info", RECOVERED: "success", CLOSED: "neutral" };
export interface IncidentUpdate { id: string; note: string; status: IncidentStatus | ""; status_label: string; author_name: string; created_at: string }
export interface SecurityIncident {
  id: string; title: string; summary: string; kind: IncidentKind; kind_label: string; severity: IncidentSeverity; severity_label: string;
  status: IncidentStatus; status_label: string; detected_at: string; contained_at: string | null; recovered_at: string | null; closed_at: string | null;
  personal_data_affected: boolean; affected_institutions: string[]; affected_names: string[]; root_cause: string; lessons_learned: string;
  lead: string | null; lead_name: string | null; updates: IncidentUpdate[]; created_at: string;
  timings: { minutes_to_contain: number | null; minutes_to_recover: number | null; minutes_open: number | null; within_rto: boolean | null };
}
export type IncidentInput = Partial<Pick<SecurityIncident, "title" | "summary" | "kind" | "severity" | "detected_at" | "personal_data_affected" | "affected_institutions" | "root_cause" | "lessons_learned">>;
export const listIncidents = (): Promise<PaginatedData<SecurityIncident> & { targets: { rto_hours: number; rpo_hours: number } }> =>
  apiGet<PaginatedData<SecurityIncident> & { targets: { rto_hours: number; rpo_hours: number } }>("/platform/incidents/", { params: { page_size: 100 } });
export const recordIncident = (payload: IncidentInput): Promise<SecurityIncident> => apiPost<SecurityIncident>("/platform/incidents/", payload);
export const updateIncident = (id: string, payload: IncidentInput): Promise<SecurityIncident> => apiPatch<SecurityIncident>(`/platform/incidents/${id}/`, payload);
export const addIncidentUpdate = (id: string, note: string, status?: IncidentStatus): Promise<SecurityIncident> => apiPost<SecurityIncident>(`/platform/incidents/${id}/updates/`, { note, status: status ?? "" });
