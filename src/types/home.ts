/**
 * Personalised workspace payload returned by `GET /api/v1/home/`.
 *
 * The backend determines both the greeting timezone and the actions the
 * active membership is allowed to use. Route hints are therefore treated as
 * backend-owned navigation rather than reconstructed in the browser.
 */

export interface HomeGreetingContext {
  greeting: string;
  user_display_name: string;
  institution_name: string;
  institution_timezone: string;
  local_time: string;
}

export interface HomeQuickAction {
  code: string;
  label: string;
  route_hint: string;
  is_pinned: boolean;
}

export interface HomeRecentWork {
  type: string;
  id: string;
  reference: string;
  title: string;
  status: string;
  resume_action: string;
  resume_route: string;
  updated_at: string;
  can_resume: boolean;
}

export interface HomeAttentionItem {
  code: string;
  severity: string;
  title: string;
  description: string;
  action_code: string;
  entity_type: string;
  entity_id: string | null;
  reference: string;
  due_at: string | null;
}

export interface HomeNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  created_at: string;
}

export interface HomePayload {
  greeting_context: HomeGreetingContext;
  quick_actions: HomeQuickAction[];
  recent_work: HomeRecentWork[];
  attention_items: HomeAttentionItem[];
  notifications_summary: {
    unread_count: number;
    latest: HomeNotification[];
  };
  optional_personal_snapshot: Record<string, unknown> | null;
}
