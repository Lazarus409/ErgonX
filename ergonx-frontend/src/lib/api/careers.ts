/**
 * Public careers site (no sign-in) and HR's careers-site settings.
 * Mirrors `apps/recruitment/careers.py`.
 */

import { apiGet, apiPost, apiPostMultipart, apiPut } from "./client";

export interface CareersJobSummary {
  id: string;
  code: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  closes_on: string | null;
  openings: number;
}

export interface CareersJob extends CareersJobSummary {
  description: string;
  responsibilities: string;
  qualifications_essential: string;
  qualifications_desirable: string;
  salary: { currency: string; min: string; max: string } | null;
}

export interface CareersSitePublic {
  organisation: string;
  slug: string;
  headline: string;
  introduction: string;
  privacy_notice: string;
  jobs: CareersJobSummary[];
}

export interface TrackingView {
  organisation: string;
  job: { title: string; code: string };
  applied_at: string | null;
  status: "RECEIVED" | "IN_REVIEW" | "INTERVIEW" | "OFFER" | "HIRED" | "CLOSED" | "WITHDRAWN";
  status_label: string;
  can_withdraw: boolean;
  can_upload: boolean;
  interviews: { id: string; scheduled_at: string; duration_minutes: number; mode: string; where: string; time_zone: string; message: string; response: string }[];
  documents: { id: string; name: string; category: string; uploaded_at: string }[];
  offer: {
    status: "EXTENDED" | "ACCEPTED" | "DECLINED" | "HIRED";
    status_label: string;
    position: string;
    department: string;
    location: string;
    employment_type: string;
    proposed_start_date: string;
    expires_on: string | null;
    base_salary: string | null;
    currency: string;
    contract_length_months: number | null;
    terms: string;
    signed_name: string;
    signed_at: string | null;
    can_answer: boolean;
  } | null;
}

export interface CareersSiteSettings {
  slug: string;
  is_enabled: boolean;
  headline: string;
  introduction: string;
  privacy_notice: string;
  updated_at: string | null;
  exists: boolean;
}

export const CANDIDATE_DOCUMENT_TYPES: Record<string, string> = {
  CV: "CV", COVER_LETTER: "Cover letter", CERTIFICATE: "Certificate", PORTFOLIO: "Portfolio", REFERENCE: "Reference", OTHER: "Other",
};

export function getCareersSite(slug: string): Promise<CareersSitePublic> {
  return apiGet<CareersSitePublic>(`/public/careers/${encodeURIComponent(slug)}/`);
}

export function getCareersJob(slug: string, jobId: string): Promise<{ organisation: string; privacy_notice: string; job: CareersJob }> {
  return apiGet(`/public/careers/${encodeURIComponent(slug)}/jobs/${jobId}/`);
}

export function applyForJob(slug: string, jobId: string, form: FormData): Promise<{ received: boolean; tracking_token: string | null; email_delivery_status: string }> {
  return apiPostMultipart(`/public/careers/${encodeURIComponent(slug)}/jobs/${jobId}/apply/`, form);
}

export function getTracking(token: string): Promise<TrackingView> {
  return apiGet<TrackingView>(`/public/careers/track/${encodeURIComponent(token)}/`);
}

export function uploadTrackingDocument(token: string, file: File, category: string): Promise<TrackingView> {
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);
  return apiPostMultipart<TrackingView>(`/public/careers/track/${encodeURIComponent(token)}/documents/`, form);
}

export function withdrawApplication(token: string): Promise<TrackingView> {
  return apiPost<TrackingView>(`/public/careers/track/${encodeURIComponent(token)}/withdraw/`);
}

export function respondToInterview(token: string, interviewId: string, response: "ACCEPT" | "DECLINE", note = ""): Promise<TrackingView> {
  return apiPost<TrackingView>(`/public/careers/track/${encodeURIComponent(token)}/interviews/${interviewId}/`, { response, note });
}

export function getCareersSettings(): Promise<CareersSiteSettings> {
  return apiGet<CareersSiteSettings>("/recruitment/careers-site/");
}

export function saveCareersSettings(payload: Omit<CareersSiteSettings, "updated_at" | "exists">): Promise<CareersSiteSettings> {
  return apiPut<CareersSiteSettings>("/recruitment/careers-site/", payload);
}

export function answerOffer(token: string, response: "ACCEPT" | "DECLINE", signedName = "", note = ""): Promise<TrackingView> {
  return apiPost<TrackingView>(`/public/careers/track/${encodeURIComponent(token)}/offer/`, { response, signed_name: signedName, note, confirm: response === "ACCEPT" });
}
