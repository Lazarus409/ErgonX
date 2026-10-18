/**
 * API keys, webhooks and personal calendar feeds. Mirrors `apps/integrations`.
 */

import { apiDelete, apiGet, apiGetList, apiPatch, apiPost } from "./client";
import type { PaginatedData } from "@/types/api";

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_by_name: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface WebhookRow {
  id: string;
  url: string;
  description: string;
  events: string[];
  is_active: boolean;
  consecutive_failures: number;
  recent_failures: number;
  created_at: string;
}

export interface WebhookDeliveryRow {
  id: string;
  event: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  last_status_code: number | null;
  last_error: string;
  next_attempt_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface IntegrationCatalogue {
  events: string[];
  scopes: { value: string; label: string }[];
}

export function getCatalogue(): Promise<IntegrationCatalogue> {
  return apiGet<IntegrationCatalogue>("/integrations/catalogue/");
}

export function listApiKeys(): Promise<PaginatedData<ApiKeyRow>> {
  return apiGetList<ApiKeyRow>("/integrations/api-keys/", { page_size: 100 });
}

export function createApiKey(payload: { name: string; scopes: string[]; expires_at?: string | null }): Promise<ApiKeyRow & { key: string }> {
  return apiPost("/integrations/api-keys/", payload);
}

export function revokeApiKey(id: string): Promise<ApiKeyRow> {
  return apiPost<ApiKeyRow>(`/integrations/api-keys/${id}/revoke/`);
}

export function listWebhooks(): Promise<PaginatedData<WebhookRow>> {
  return apiGetList<WebhookRow>("/integrations/webhooks/", { page_size: 100 });
}

export function createWebhook(payload: { url: string; events: string[]; description?: string }): Promise<WebhookRow & { secret: string }> {
  return apiPost("/integrations/webhooks/", payload);
}

export function updateWebhook(id: string, payload: Partial<Pick<WebhookRow, "events" | "is_active" | "description">>): Promise<WebhookRow> {
  return apiPatch<WebhookRow>(`/integrations/webhooks/${id}/`, payload);
}

export function deleteWebhook(id: string): Promise<void> {
  return apiDelete(`/integrations/webhooks/${id}/`);
}

export function webhookDeliveries(id: string): Promise<WebhookDeliveryRow[]> {
  return apiGet<WebhookDeliveryRow[]>(`/integrations/webhooks/${id}/deliveries/`);
}

export function pingWebhook(id: string): Promise<WebhookDeliveryRow> {
  return apiPost<WebhookDeliveryRow>(`/integrations/webhooks/${id}/ping/`);
}

export function retryDelivery(webhookId: string, deliveryId: string): Promise<WebhookDeliveryRow> {
  return apiPost<WebhookDeliveryRow>(`/integrations/webhooks/${webhookId}/deliveries/${deliveryId}/retry/`);
}

export function getMyCalendarFeed(): Promise<{ active: boolean; created_at: string | null; last_used_at: string | null }> {
  return apiGet("/me/calendar-feed/");
}

export function createMyCalendarFeed(): Promise<{ active: boolean; path: string }> {
  return apiPost("/me/calendar-feed/");
}

export function revokeMyCalendarFeed(): Promise<void> {
  return apiDelete("/me/calendar-feed/");
}
