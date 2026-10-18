/** Security overview, compliance evidence and platform restore tests. Mirrors `apps/security`. */

import { apiDownload, apiGet, apiGetList, apiPost } from "./client";
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
