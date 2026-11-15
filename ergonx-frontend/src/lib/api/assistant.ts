/** The ErgonX assistant. Mirrors `apps/assistant`. */

import { apiDelete, apiGet, apiGetList, apiPost } from "./client";
import type { PaginatedData } from "@/types/api";

// An answer can take several tool rounds; allow longer than the default request timeout.
const ASK_TIMEOUT_MS = 150_000;

export interface AssistantStatus { configured: boolean; enabled: boolean; daily_limit: number; remaining_today: number; retention_days: number; model: string }
export interface AssistantMessage { id: string; role: "user" | "assistant"; text: string; tools_used: string[]; created_at: string }
export interface AssistantConversation { id: string; title: string; created_at: string; updated_at: string; messages: AssistantMessage[] | null }

export const getStatus = (): Promise<AssistantStatus> => apiGet<AssistantStatus>("/assistant/status/");
export const listConversations = (): Promise<PaginatedData<AssistantConversation>> => apiGetList<AssistantConversation>("/assistant/conversations/", { page_size: 30 });
export const getConversation = (id: string): Promise<AssistantConversation> => apiGet<AssistantConversation>(`/assistant/conversations/${id}/`);
export const startConversation = (text: string): Promise<AssistantConversation> => apiPost<AssistantConversation>("/assistant/conversations/", { text }, { timeout: ASK_TIMEOUT_MS });
export const ask = (id: string, text: string): Promise<AssistantMessage> => apiPost<AssistantMessage>(`/assistant/conversations/${id}/ask/`, { text }, { timeout: ASK_TIMEOUT_MS });
export const deleteConversation = (id: string): Promise<void> => apiDelete(`/assistant/conversations/${id}/`);
