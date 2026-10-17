/**
 * Performance reviews: competencies, review cycles and reviews.
 * Mirrors `apps/performance`.
 */

import { apiAction, apiDelete, apiGet, apiGetList, apiPatch, apiPost } from "./client";
import { MAX_PAGE_SIZE } from "@/types/api";
import type { ListParams, PaginatedData } from "@/types/api";

export type CycleStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type ReviewStatus = "SELF_ASSESSMENT" | "MANAGER_REVIEW" | "HR_REVIEW" | "COMPLETED" | "CANCELLED";

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = { DRAFT: "Draft", ACTIVE: "In progress", CLOSED: "Closed" };
export const CYCLE_STATUS_TONES: Record<CycleStatus, "neutral" | "info" | "success"> = { DRAFT: "neutral", ACTIVE: "info", CLOSED: "success" };
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = { SELF_ASSESSMENT: "Self-assessment", MANAGER_REVIEW: "Manager review", HR_REVIEW: "HR sign-off", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export const REVIEW_STATUS_TONES: Record<ReviewStatus, "info" | "warning" | "violet" | "success" | "neutral"> = { SELF_ASSESSMENT: "info", MANAGER_REVIEW: "warning", HR_REVIEW: "violet", COMPLETED: "success", CANCELLED: "neutral" };
export const RATING_LABELS: Record<number, string> = { 1: "Unsatisfactory", 2: "Needs improvement", 3: "Meets expectations", 4: "Exceeds expectations", 5: "Outstanding" };

export interface Competency { id: string; name: string; description: string; sort_order: number; is_active: boolean; created_at: string }

export interface ReviewCycle {
  id: string;
  name: string;
  description: string;
  period_start: string;
  period_end: string;
  self_assessment_due: string | null;
  manager_review_due: string | null;
  status: CycleStatus;
  competencies: string[];
  competency_names: string[];
  review_count?: number;
  completed_count?: number;
  launched_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export type ReviewCyclePayload = Pick<ReviewCycle, "name" | "description" | "period_start" | "period_end" | "self_assessment_due" | "manager_review_due" | "competencies">;

export interface ReviewListItem {
  id: string;
  cycle: string;
  cycle_name: string;
  employee: string;
  employee_name: string;
  employee_number: string;
  reviewer: string | null;
  reviewer_name: string;
  status: ReviewStatus;
  overall_rating: number | null;
  self_submitted_at: string | null;
  manager_submitted_at: string | null;
  signed_off_at: string | null;
}

export interface ReviewRating {
  competency_id: string;
  competency: string;
  description: string;
  self_rating: number | null;
  self_comment: string;
  manager_rating: number | null;
  manager_comment: string;
}

export interface PerformanceReview extends ReviewListItem {
  cycle_status: CycleStatus;
  self_assessment_due: string | null;
  manager_review_due: string | null;
  self_summary: string | null;
  manager_summary: string | null;
  development_plan: string | null;
  hr_comment: string | null;
  signed_off_by_name: string | null;
  ratings: ReviewRating[];
  /** HR's calibrated rating, when it differs from the manager's; final_rating is what counts. */
  calibrated_rating: number | null;
  calibration_note: string;
  final_rating: number | null;
  viewer: { is_employee: boolean; is_reviewer: boolean; is_hr: boolean; can_self_assess: boolean; can_manager_review: boolean; can_sign_off: boolean; can_manage: boolean; can_calibrate: boolean; can_request_feedback: boolean };
}

export interface CycleSummary {
  total: number;
  by_status: Record<ReviewStatus, number>;
  completion_rate: number;
  average_rating: number | null;
  rating_distribution: Array<{ rating: number; label: string; count: number }>;
  by_department: Array<{ department: string; average_rating: number; reviews: number }>;
}

export interface RatingInput { competency: string; rating: number | null; comment: string }

export function listCompetencies(params?: ListParams): Promise<PaginatedData<Competency>> {
  return apiGetList<Competency>("/performance-competencies/", { page_size: MAX_PAGE_SIZE, ...params });
}
export function createCompetency(payload: Pick<Competency, "name" | "description" | "sort_order">): Promise<Competency> {
  return apiPost<Competency, Pick<Competency, "name" | "description" | "sort_order">>("/performance-competencies/", payload);
}
export function updateCompetency(id: string, payload: Partial<Pick<Competency, "name" | "description" | "sort_order">>): Promise<Competency> {
  return apiPatch<Competency, Partial<Pick<Competency, "name" | "description" | "sort_order">>>(`/performance-competencies/${id}/`, payload);
}
export function deactivateCompetency(id: string): Promise<void> {
  return apiDelete(`/performance-competencies/${id}/`);
}

export function listCycles(params?: ListParams): Promise<PaginatedData<ReviewCycle>> {
  return apiGetList<ReviewCycle>("/review-cycles/", { page_size: MAX_PAGE_SIZE, ...params });
}
export function getCycle(id: string): Promise<ReviewCycle> {
  return apiGet<ReviewCycle>(`/review-cycles/${id}/`);
}
export function createCycle(payload: ReviewCyclePayload): Promise<ReviewCycle> {
  return apiPost<ReviewCycle, ReviewCyclePayload>("/review-cycles/", payload);
}
export function updateCycle(id: string, payload: Partial<ReviewCyclePayload>): Promise<ReviewCycle> {
  return apiPatch<ReviewCycle, Partial<ReviewCyclePayload>>(`/review-cycles/${id}/`, payload);
}
export function launchCycle(id: string, payload: { all_active?: boolean; departments?: string[]; employees?: string[] }): Promise<ReviewCycle> {
  return apiPost<ReviewCycle, typeof payload>(`/review-cycles/${id}/launch/`, payload);
}
export function closeCycle(id: string): Promise<ReviewCycle> {
  return apiAction<ReviewCycle>(`/review-cycles/${id}/close/`);
}
export function getCycleSummary(id: string): Promise<CycleSummary> {
  return apiGet<CycleSummary>(`/review-cycles/${id}/summary/`);
}

export function listReviews(params?: ListParams & { cycle?: string; status?: string; mine?: "employee" | "reviewer" }): Promise<PaginatedData<ReviewListItem>> {
  return apiGetList<ReviewListItem>("/performance-reviews/", { page_size: MAX_PAGE_SIZE, ...params });
}
export function getReview(id: string): Promise<PerformanceReview> {
  return apiGet<PerformanceReview>(`/performance-reviews/${id}/`);
}
export function saveSelfAssessment(id: string, payload: { ratings: RatingInput[]; summary: string; submit: boolean }): Promise<PerformanceReview> {
  return apiPost<PerformanceReview, typeof payload>(`/performance-reviews/${id}/self-assessment/`, payload);
}
export function saveManagerReview(id: string, payload: { ratings: RatingInput[]; summary: string; development_plan: string; overall_rating: number | null; submit: boolean }): Promise<PerformanceReview> {
  return apiPost<PerformanceReview, typeof payload>(`/performance-reviews/${id}/manager-review/`, payload);
}
export function signOffReview(id: string, comment: string): Promise<PerformanceReview> {
  return apiPost<PerformanceReview, { comment: string }>(`/performance-reviews/${id}/sign-off/`, { comment });
}
export function returnReview(id: string, comment: string): Promise<PerformanceReview> {
  return apiPost<PerformanceReview, { comment: string }>(`/performance-reviews/${id}/return/`, { comment });
}
export function releaseReview(id: string): Promise<PerformanceReview> {
  return apiAction<PerformanceReview>(`/performance-reviews/${id}/release/`);
}
export function cancelReview(id: string, reason: string): Promise<PerformanceReview> {
  return apiPost<PerformanceReview, { reason: string }>(`/performance-reviews/${id}/cancel/`, { reason });
}

/* Goals (OKRs) ---------------------------------------------------------- */

export type GoalLevel = "COMPANY" | "DEPARTMENT" | "INDIVIDUAL";
export type GoalStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type GoalHealth = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";

export const GOAL_HEALTH_LABELS: Record<GoalHealth, string> = { ON_TRACK: "On track", AT_RISK: "At risk", OFF_TRACK: "Off track" };
export const GOAL_HEALTH_TONES: Record<GoalHealth, "success" | "warning" | "danger"> = { ON_TRACK: "success", AT_RISK: "warning", OFF_TRACK: "danger" };
export const GOAL_STATUS_TONES: Record<GoalStatus, "neutral" | "info" | "success" | "warning"> = { DRAFT: "neutral", ACTIVE: "info", COMPLETED: "success", CANCELLED: "warning" };

export interface KeyResult {
  id?: string;
  title: string;
  unit: string;
  start_value: string | number;
  target_value: string | number;
  current_value?: string | number;
  progress?: number;
}

export interface GoalCheckIn { id: string; author_name: string; health: GoalHealth; health_label: string; progress: number; note: string; created_at: string }

export interface Goal {
  id: string;
  level: GoalLevel;
  level_label: string;
  employee: string | null;
  department: string | null;
  parent: string | null;
  parent_title: string;
  owner_name: string;
  title: string;
  description: string;
  period_start: string;
  period_end: string;
  status: GoalStatus;
  status_label: string;
  health: GoalHealth;
  health_label: string;
  progress: number;
  key_results: KeyResult[];
  children_count: number;
  agreed_by_name: string;
  agreed_at: string | null;
  last_check_in_at: string | null;
  viewer: { can_edit: boolean; can_manage: boolean; can_check_in: boolean; is_owner: boolean };
  created_at: string;
  updated_at: string;
  /** Detail only. */
  check_ins?: GoalCheckIn[];
  children?: { id: string; title: string; level: GoalLevel; owner_name: string; progress: number; health: GoalHealth; status: GoalStatus }[];
}

export interface GoalPayload {
  level: GoalLevel;
  employee?: string | null;
  department?: string | null;
  parent?: string | null;
  title: string;
  description: string;
  period_start: string;
  period_end: string;
  key_results: KeyResult[];
}

export function listGoals(params: ListParams & { mine?: boolean; team?: boolean; level?: GoalLevel; status?: GoalStatus } = {}): Promise<PaginatedData<Goal>> {
  return apiGetList<Goal>("/goals/", { page_size: MAX_PAGE_SIZE, ...params });
}

export function getGoal(id: string): Promise<Goal> {
  return apiGet<Goal>(`/goals/${id}/`);
}

export function createGoal(payload: GoalPayload): Promise<Goal> {
  return apiPost<Goal, GoalPayload>("/goals/", payload);
}

export function updateGoal(id: string, payload: Partial<GoalPayload>): Promise<Goal> {
  return apiPatch<Goal, Partial<GoalPayload>>(`/goals/${id}/`, payload);
}

export function goalAction(id: string, action: "activate" | "complete" | "cancel"): Promise<Goal> {
  return apiPost<Goal>(`/goals/${id}/${action}/`);
}

export function checkInGoal(id: string, payload: { health: GoalHealth; note?: string; values?: Record<string, string>; progress?: number }): Promise<Goal> {
  return apiPost<Goal>(`/goals/${id}/check-in/`, payload);
}

/* 360 feedback and calibration -------------------------------------------- */

export type FeedbackRelationship = "PEER" | "DIRECT_REPORT" | "MANAGER" | "OTHER";
export const FEEDBACK_RELATIONSHIP_LABELS: Record<FeedbackRelationship, string> = { PEER: "Peer", DIRECT_REPORT: "Direct report", MANAGER: "Manager", OTHER: "Other colleague" };

export interface FeedbackSummary {
  requested: number;
  submitted: number;
  declined: number;
  min_responses: number;
  /** False until enough colleagues have answered for the summary to stay anonymous (HR always sees it). */
  visible: boolean;
  competencies: { competency: string; average: number; responses: number }[];
  comments: { strengths: string; improvements: string; name?: string; relationship?: string }[];
  /** HR only. */
  respondents: { id: string; name: string; relationship: string; status: "PENDING" | "SUBMITTED" | "DECLINED" }[];
}

export interface FeedbackRequestItem {
  id: string;
  employee_name: string;
  cycle_name: string;
  relationship: FeedbackRelationship;
  relationship_label: string;
  status: "PENDING" | "SUBMITTED" | "DECLINED";
  status_label: string;
  strengths: string;
  improvements: string;
  submitted_at: string | null;
  competencies: { id: string; name: string; description: string; rating: number | null }[];
  open: boolean;
  created_at: string;
}

export interface CalibrationBoard {
  reviews: { id: string; employee: string; department: string; reviewer: string; status: ReviewStatus; manager_rating: number | null; calibrated_rating: number | null; final_rating: number | null; calibration_note: string }[];
  distribution: { rating: number; manager: number; final: number }[];
}

export function getReviewFeedback(reviewId: string): Promise<FeedbackSummary> {
  return apiGet<FeedbackSummary>(`/performance-reviews/${reviewId}/feedback/`);
}

export function requestReviewFeedback(reviewId: string, respondents: string[], relationship: FeedbackRelationship): Promise<FeedbackSummary> {
  return apiPost<FeedbackSummary>(`/performance-reviews/${reviewId}/feedback/`, { respondents, relationship });
}

export function listMyFeedbackRequests(): Promise<PaginatedData<FeedbackRequestItem>> {
  return apiGetList<FeedbackRequestItem>("/feedback-requests/", { page_size: MAX_PAGE_SIZE });
}

export function submitFeedback(id: string, payload: { ratings: Record<string, number>; strengths: string; improvements: string }): Promise<FeedbackRequestItem> {
  return apiPost<FeedbackRequestItem>(`/feedback-requests/${id}/submit/`, payload);
}

export function declineFeedback(id: string): Promise<FeedbackRequestItem> {
  return apiPost<FeedbackRequestItem>(`/feedback-requests/${id}/decline/`);
}

export function calibrateReview(reviewId: string, rating: number | null, note: string): Promise<PerformanceReview> {
  return apiPost<PerformanceReview>(`/performance-reviews/${reviewId}/calibrate/`, { rating, note });
}

export function getCalibrationBoard(cycleId: string): Promise<CalibrationBoard> {
  return apiGet<CalibrationBoard>(`/review-cycles/${cycleId}/calibration/`);
}
