export interface ApprovalWorkflow {
  id: string;
  code: string;
  name: string;
  workflow_type: string;
  entity_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequest {
  id: string;
  workflow: string;
  entity_type: string;
  entity_id: string;
  requested_by: string;
  current_step: string | null;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApprovalAction {
  id: string;
  request: string;
  step: string;
  actor: string;
  action: string;
  comments: string;
  acted_at: string;
}

export type InboxModule = "LEAVE" | "ATTENDANCE" | "PAYROLL" | "RECRUITMENT" | "ACCOUNTING" | "WORKFLOW";

export interface InboxAction {
  code: "approve" | "reject" | "return";
  label: string;
  /** Module endpoint (relative to /api/v1) that records this decision. */
  path: string;
  /** Body key the endpoint reads the note from; null when it takes none. */
  comment_key: string | null;
  comment_required: boolean;
  tone: "success" | "danger" | "warning" | "neutral";
}

export interface InboxItem {
  kind: string;
  module: InboxModule;
  id: string;
  reference: string;
  title: string;
  subtitle: string;
  requested_by: string;
  submitted_at: string;
  amount: string | null;
  currency: string;
  route: string;
  actions: InboxAction[];
  /** Set when the module will refuse this caller's decision (e.g. own submission). */
  blocked_reason: string;
  /** Set for records that are decided on their own page (payroll runs). */
  note: string;
}

export interface InboxDecision {
  id: string;
  kind: string;
  module: InboxModule;
  label: string;
  entity_id: string | null;
  outcome: string;
  actor_name: string;
  is_mine: boolean;
  acted_at: string;
  comment: string;
  route: string;
}

export interface ApprovalInbox {
  generated_at: string;
  summary: {
    total: number;
    actionable: number;
    needs_review: number;
    blocked: number;
    waiting_over_3_days: number;
    oldest_submitted_at: string | null;
    by_module: Array<{ module: InboxModule; count: number }>;
  };
  items: InboxItem[];
  decisions: InboxDecision[];
}
