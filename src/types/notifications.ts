export interface AppNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  status: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  metadata: Record<string, unknown>;
  route_hint?: string | null;
}
