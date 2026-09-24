import { apiGetList } from "./client";
import type { PaginatedData } from "@/types/api";

export interface AuditLogEntry {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_email: string | null;
  ip_address: string | null;
  user_agent: string;
  metadata: Record<string, unknown>;
}

export interface AuditLogFilters { [key: string]: string | number | boolean | undefined; from?: string; to?: string; actor?: string; action?: string; entity_type?: string; entity_id?: string; q?: string; page?: number; }

/** Read-only tenant audit history. Sensitive values are redacted by the API. */
export function listAuditLogs(filters: AuditLogFilters = {}): Promise<PaginatedData<AuditLogEntry>> {
  return apiGetList<AuditLogEntry>("/audit/", filters);
}
