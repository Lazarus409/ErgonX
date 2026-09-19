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
