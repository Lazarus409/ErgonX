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
