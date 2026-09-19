import { apiAction, apiGetList } from "./client";
import type { PaginatedData } from "@/types/api";
import type { ApprovalAction, ApprovalRequest, ApprovalWorkflow } from "@/types/workflows";

export function listApprovalWorkflows(): Promise<PaginatedData<ApprovalWorkflow>> { return apiGetList<ApprovalWorkflow>("/approval-workflows/", { ordering: "name" }); }
export function listApprovalRequests(): Promise<PaginatedData<ApprovalRequest>> { return apiGetList<ApprovalRequest>("/approval-requests/", { ordering: "-created_at" }); }
export function listApprovalActions(): Promise<PaginatedData<ApprovalAction>> { return apiGetList<ApprovalAction>("/approval-actions/", { ordering: "-acted_at" }); }
export function decideApprovalRequest(id: string, action: "approve" | "reject" | "cancel", comments: string): Promise<ApprovalRequest> { return apiAction<ApprovalRequest, { comments: string }>(`/approval-requests/${id}/${action}/`, { comments }); }
