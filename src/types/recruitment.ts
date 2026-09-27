export interface JobPosting {
  id: string;
  code: string;
  title: string;
  department: string;
  position: string;
  location: string;
  hiring_manager: string | null;
  description: string;
  employment_type: string;
  openings: number;
  status: string;
  opens_on: string | null;
  closes_on: string | null;
  department_name?: string;
  position_title?: string;
  location_name?: string;
  grade?: string | null;
  grade_name?: string | null;
  reports_to?: string | null;
  reports_to_title?: string | null;
  hiring_manager_name?: string | null;
  hiring_reason?: string;
  target_start_date?: string | null;
  salary_currency?: string;
  salary_min?: string | null;
  salary_max?: string | null;
  interview_plan?: string;
  responsibilities?: string;
  qualifications_essential?: string;
  qualifications_desirable?: string;
  submitted_by?: string | null;
  submitted_by_name?: string | null;
  submitted_at?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  approval_note?: string;
  application_counts?: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface JobPostingPayload {
  /** Omit to have the next JOB-YYYY-##### code generated. */
  code?: string;
  title: string;
  department: string;
  position: string;
  location: string;
  hiring_manager?: string | null;
  description?: string;
  employment_type: string;
  openings?: number;
  closes_on?: string | null;
  hiring_reason?: string;
  grade?: string | null;
  reports_to?: string | null;
  target_start_date?: string | null;
  salary_currency?: string;
  salary_min?: string | null;
  salary_max?: string | null;
  interview_plan?: string;
  responsibilities?: string;
  qualifications_essential?: string;
  qualifications_desirable?: string;
}

export const HIRING_REASONS: Array<[string, string]> = [["NEW_ROLE", "New role"], ["REPLACEMENT", "Replacement"], ["EXPANSION", "Team expansion"], ["TEMPORARY_COVER", "Temporary cover"]];
export const INTERVIEW_PLANS: Array<[string, string]> = [["SINGLE_PANEL", "Single panel interview"], ["TWO_STAGE", "Screening + panel interview"], ["TECHNICAL_PANEL", "Technical assessment + panel"], ["PRESENTATION_PANEL", "Presentation + panel"]];
export const HIRING_TEAM_ROLES: Array<[string, string]> = [["HIRING_MANAGER", "Hiring manager"], ["INTERVIEW_PANEL", "Interview panel"], ["HR_PARTNER", "HR business partner"], ["COORDINATOR", "Recruitment coordinator"]];

export interface HiringTeamMember {
  id: string;
  job_posting: string;
  user: string;
  user_name: string;
  user_email: string;
  role: string;
  created_at: string;
}

export interface RecruitmentPerson {
  id: string;
  name: string;
  role: string;
}

export interface RequisitionActivity {
  by_stage: Array<{ stage: string; count: number }>;
  recent: Array<{ id: string; candidate: string; stage: string | null; status: string; applied_at: string | null }>;
  total: number;
}

export interface RequisitionHistoryEntry {
  id: string;
  action: string;
  actor: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface Candidate {
  id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CandidatePayload {
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  phone?: string;
  source?: string;
  notes?: string;
}

export interface CandidateScorecard {
  candidate_id: string;
  average_score: string | number | null;
  application_count: number;
}

export interface RecruitmentApplication {
  id: string;
  job_posting: string;
  candidate: string;
  current_stage: string | null;
  status: string;
  applied_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface RecruitmentApplicationPayload {
  job_posting: string;
  candidate: string;
  notes?: string;
}

export interface ApplicationStageHistory {
  id: string;
  application: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  comment: string;
  created_at: string;
}

export interface RecruitmentInterview {
  id: string;
  application: string;
  scheduled_at: string;
  duration_minutes: number;
  interview_type: string;
  location_or_link: string;
  interviewer: string | null;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface RecruitmentInterviewPayload {
  application: string;
  scheduled_at: string;
  duration_minutes?: number;
  interview_type?: string;
  location_or_link?: string;
  notes?: string;
}

export interface RecruitmentOffer {
  id: string;
  application: string;
  status: string;
  proposed_start_date: string;
  expires_on: string | null;
  employment_type: string;
  department: string;
  position: string;
  grade: string;
  location: string;
  staff_category: string;
  salary_structure: string | null;
  base_salary: string | null;
  currency: string;
  hired_employee: string | null;
  terms: string;
  created_at: string;
  updated_at: string;
}

export interface RecruitmentOfferPayload {
  application: string;
  proposed_start_date: string;
  employment_type: string;
  department: string;
  position: string;
  grade: string;
  location: string;
  staff_category?: string;
  expires_on?: string | null;
  terms?: string;
}

export interface RecruitmentStage {
  id: string;
  name: string;
  sequence: number;
  is_terminal: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecruitmentStagePayload {
  name: string;
  sequence: number;
  is_terminal?: boolean;
  is_active?: boolean;
}

export interface CandidateEvaluation {
  id: string;
  application: string;
  interviewer: string;
  interview: string | null;
  score: string | number;
  recommendation: string;
  comments: string;
  created_at: string;
  updated_at: string;
}

export interface CandidateEvaluationPayload {
  application: string;
  interview?: string | null;
  score: number;
  recommendation: "STRONG_YES" | "YES" | "NO" | "STRONG_NO";
  comments?: string;
}

export interface RecruitmentPipelineStage {
  stage_id: string;
  stage_name: string;
  sequence: number;
  application_count: number;
}
