/** Procurement: requisitions, purchase orders, goods received and bills from orders. Mirrors `apps/procurement`. */

import { apiDownload, apiGet, apiGetList, apiPatch, apiPost } from "./client";
import type { ListParams, PaginatedData } from "@/types/api";

export type RequisitionStatus = "DRAFT" | "PENDING" | "RETURNED" | "APPROVED" | "ORDERED" | "REJECTED" | "CANCELLED";
export type OrderStatus = "DRAFT" | "PENDING" | "ISSUED" | "PART_RECEIVED" | "RECEIVED" | "CLOSED" | "CANCELLED";
type Tone = "neutral" | "info" | "warning" | "success" | "danger";

export const REQUISITION_TONES: Record<RequisitionStatus, Tone> = { DRAFT: "neutral", PENDING: "info", RETURNED: "warning", APPROVED: "success", ORDERED: "success", REJECTED: "danger", CANCELLED: "neutral" };
export const ORDER_TONES: Record<OrderStatus, Tone> = { DRAFT: "neutral", PENDING: "info", ISSUED: "info", PART_RECEIVED: "warning", RECEIVED: "success", CLOSED: "neutral", CANCELLED: "neutral" };

export interface RequisitionLine { id: string; sequence: number; description: string; quantity: string; unit: string; estimated_unit_price: string; line_total: string; expense_account: string | null; expense_account_label: string }
export interface RequisitionStep { id: string; sequence: number; step_name: string; approver: string | null; approver_name: string; status: "PENDING" | "APPROVED" | "RETURNED" | "REJECTED"; status_label: string; decided_by_name: string; comment: string; acted_at: string | null }
export interface Requisition {
  id: string; requisition_number: string; title: string; justification: string; requested_by: string; requested_by_name: string;
  department: string | null; department_name: string; needed_by: string | null; preferred_vendor: string | null; preferred_vendor_name: string;
  currency: string; estimated_total: string; status: RequisitionStatus; status_label: string; submitted_at: string | null; decided_at: string | null;
  decision_note: string; lines: RequisitionLine[]; approvals: RequisitionStep[];
  orders: { id: string; order_number: string; status: OrderStatus; status_label: string }[];
  viewer: { is_requester?: boolean; can_edit?: boolean; can_decide?: boolean };
  created_at: string;
}
export interface RequisitionLineInput { description: string; quantity: string; unit?: string; estimated_unit_price?: string; expense_account?: string | null }
export interface RequisitionInput { title: string; justification?: string; needed_by?: string | null; preferred_vendor?: string | null; lines: RequisitionLineInput[] }

export interface OrderLine { id: string; sequence: number; description: string; quantity: string; unit: string; unit_price: string; line_total: string; expense_account: string | null; expense_account_label: string; tax_code: string | null; tax_code_label: string; requisition_line: string | null }
export interface GoodsReceipt { id: string; receipt_number: string; order: string; order_number: string; vendor_name: string; received_date: string; received_by_name: string; delivery_note: string; notes: string; lines: { id: string; order_line: string; description: string; quantity: string; rejected_quantity: string; note: string }[]; created_at: string }
export interface OrderSummary { id: string; order_number: string; vendor: string; vendor_name: string; requisition: string | null; requisition_number: string; order_date: string; expected_date: string | null; currency: string; total_amount: string; status: OrderStatus; status_label: string; created_at: string }
export interface Order extends OrderSummary {
  department: string | null; department_name: string; delivery_address: string; terms: string; notes: string; subtotal: string; tax_total: string;
  created_by_name: string; submitted_by_name: string; submitted_at: string | null; approved_by_name: string; approved_at: string | null;
  rejection_reason: string; closed_at: string | null; close_reason: string; lines: OrderLine[]; receipts: GoodsReceipt[];
  vendor_details: { code: string; email: string; phone: string; address: string; tax_identification_number: string };
  viewer: { approval_blocked_reason?: string };
}
export interface OrderLineInput { description: string; quantity: string; unit?: string; unit_price: string; expense_account?: string | null; tax_code?: string | null; requisition_line?: string | null }
export interface OrderInput { vendor: string; requisition?: string | null; order_date?: string; expected_date?: string | null; delivery_address?: string; terms?: string; notes?: string; lines?: OrderLineInput[] }

export interface MatchLine { line_id: string; sequence: number; description: string; unit: string; ordered_quantity: string; received_quantity: string; rejected_quantity: string; billed_quantity: string; outstanding_quantity: string; billable_quantity: string; ordered_value: string; received_value: string; billed_value: string }
export interface MatchSummary {
  lines: MatchLine[]; totals: { ordered: string; received: string; billed: string }; fully_received: boolean; fully_billed: boolean; mismatched_bills: number;
  bills: { id: string; bill_number: string; status: string; status_label: string; bill_date: string; subtotal: string; total_amount: string; expected_subtotal: string; matches: boolean }[];
}
export interface BudgetCheck { fiscal_year: string | null; over_budget: boolean; rows: { account_id: string; account: string; amount: string; allocated: string; remaining: string; status: "NO_BUDGET" | "OVER_BUDGET" | "WITHIN_BUDGET" }[] }
export interface Commitments {
  currency: string; total: string; late_orders: number;
  by_vendor: { vendor_id: string; vendor: string; orders: number; amount: string }[];
  by_account: { account_id: string; account: string; amount: string }[];
  orders: { id: string; order_number: string; vendor: string; status: OrderStatus; status_label: string; expected_date: string | null; late: boolean; unbilled: string }[];
}
export interface SupplierScore { vendor_id: string; vendor: string; orders: number; spend: string; delivered: number; on_time: number; on_time_rate: number | null; rejected_lines: number }
export interface FormOptions { currency: string; accounts: { id: string; label: string }[]; tax_codes: { id: string; label: string }[] }

const R = "/procurement/requisitions/";
const O = "/procurement/orders/";

export const listRequisitions = (params?: ListParams & { status?: string; mine?: "1" }): Promise<PaginatedData<Requisition>> => apiGetList<Requisition>(R, params);
export const getRequisition = (id: string): Promise<Requisition> => apiGet<Requisition>(`${R}${id}/`);
export const createRequisition = (payload: RequisitionInput): Promise<Requisition> => apiPost<Requisition>(R, payload);
export const updateRequisition = (id: string, payload: Partial<RequisitionInput>): Promise<Requisition> => apiPatch<Requisition>(`${R}${id}/`, payload);
export const submitRequisition = (id: string): Promise<Requisition> => apiPost<Requisition>(`${R}${id}/submit/`, {});
export const decideRequisition = (id: string, decision: "approve" | "return" | "reject", comment = ""): Promise<Requisition> => apiPost<Requisition>(`${R}${id}/${decision}/`, { comment });
export const cancelRequisition = (id: string, reason = ""): Promise<Requisition> => apiPost<Requisition>(`${R}${id}/cancel/`, { reason });
export const requisitionBudgetCheck = (id: string): Promise<BudgetCheck> => apiGet<BudgetCheck>(`${R}${id}/budget-check/`);

export const listOrders = (params?: ListParams & { status?: string; vendor?: string }): Promise<PaginatedData<OrderSummary>> => apiGetList<OrderSummary>(O, params);
export const getOrder = (id: string): Promise<Order> => apiGet<Order>(`${O}${id}/`);
export const createOrder = (payload: OrderInput): Promise<Order> => apiPost<Order>(O, payload);
export const orderFromRequisition = (payload: OrderInput): Promise<Order> => apiPost<Order>(`${O}from-requisition/`, payload);
export const updateOrder = (id: string, payload: Partial<OrderInput>): Promise<Order> => apiPatch<Order>(`${O}${id}/`, payload);
export const orderAction = (id: string, action: "submit" | "approve" | "reject" | "cancel" | "close", reason = ""): Promise<Order> => apiPost<Order>(`${O}${id}/${action}/`, { reason });
export const receiveGoods = (id: string, payload: { received_date?: string; delivery_note?: string; notes?: string; lines: { order_line: string; quantity: string; rejected_quantity?: string; note?: string }[] }): Promise<GoodsReceipt> =>
  apiPost<GoodsReceipt>(`${O}${id}/receive/`, payload);
export const billOrder = (id: string, payload: { bill_number: string; bill_date: string; due_date: string; lines?: { order_line: string; quantity: string }[] }): Promise<{ id: string; bill_number: string; status: string; subtotal: string; total_amount: string }> =>
  apiPost(`${O}${id}/bill/`, payload);
export const getMatch = (id: string): Promise<MatchSummary> => apiGet<MatchSummary>(`${O}${id}/match/`);
export const orderBudgetCheck = (id: string): Promise<BudgetCheck> => apiGet<BudgetCheck>(`${O}${id}/budget-check/`);
export const downloadOrder = (id: string): Promise<Blob> => apiDownload(`${O}${id}/document/`, { export: "pdf" });
export const getCommitments = (): Promise<Commitments> => apiGet<Commitments>(`${O}commitments/`);
export const getSupplierScores = (): Promise<{ results: SupplierScore[] }> => apiGet<{ results: SupplierScore[] }>(`${O}suppliers/`);
export const getFormOptions = (): Promise<FormOptions> => apiGet<FormOptions>(`${O}form-options/`);
export const listReceipts = (params?: ListParams & { order?: string }): Promise<PaginatedData<GoodsReceipt>> => apiGetList<GoodsReceipt>("/procurement/receipts/", params);
