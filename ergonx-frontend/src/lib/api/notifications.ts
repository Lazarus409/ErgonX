import { apiGetList, apiPost } from "./client";
import type { AppNotification } from "@/types/notifications";

export async function getNotifications(params: { unread?: boolean } = {}): Promise<AppNotification[]> {
  const page = await apiGetList<AppNotification>("/notifications/", params.unread ? { unread: "true" } : undefined);
  return page.results;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  return apiPost<AppNotification>(`/notifications/${id}/mark-read/`);
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiPost<{ updated: number }>("/notifications/mark-all-read/");
}
