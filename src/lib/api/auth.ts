/**
 * Authentication service.
 *
 * Endpoints: `POST /auth/login/`, `POST /auth/refresh/`, `GET /auth/me/`.
 * The backend user model authenticates by email.
 */

import {
  apiGet,
  apiDelete,
  apiPatch,
  apiPost,
  apiPut,
  clearTenantContext,
  setAuthTokens,
} from "./client";

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_platform_admin: boolean;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  mfa_code?: string;
}

export interface LoginResult {
  user: AuthUser;
}

export type MFAMethod = "AUTHENTICATOR_APP" | "EMAIL_OTP";
export interface MFAStatus { enabled: boolean; pending: boolean; method?: MFAMethod | null; secret?: string; otpauth_uri?: string; email_code_sent?: boolean; email?: string; expires_at?: string; }

export interface AuthBootstrap {
  user: AuthUser;
  active_institution: {
    id: string;
    code: string;
    name: string;
    timezone: string;
    /** Active institution logo image, served by `imageContentUrl`. */
    logo_image_id?: string | null;
  };
  active_membership: {
    id: string;
    role_code: string;
    role_name: string;
    status: string;
    /** INSTITUTION, DEPARTMENT or SELF; absent from older backends. */
    data_scope?: "INSTITUTION" | "DEPARTMENT" | "SELF";
    /** Read-only roles (e.g. Auditor) may view but never change institution data. */
    read_only?: boolean;
  };
  effective_permissions: string[];
  enabled_modules: string[];
  onboarding_ready: boolean;
  onboarding_status: string;
  default_landing: string;
  available_dashboards: string[];
}

/** Signs in; the same-origin BFF persists the token pair as HttpOnly cookies. */
export async function login(
  credentials: LoginCredentials,
): Promise<LoginResult> {
  const result = await apiPost<LoginResult, LoginCredentials>(
    "/auth/login/",
    credentials,
  );

  setAuthTokens();

  return result;
}

export async function getCurrentUser(): Promise<AuthUser> {
  return apiGet<AuthUser>("/auth/me/");
}

export function getMFAStatus(): Promise<MFAStatus> { return apiGet<MFAStatus>("/auth/security/mfa/"); }
export function beginMFASetup(): Promise<MFAStatus> { return apiPost<MFAStatus, Record<string, never>>("/auth/security/mfa/", {}); }
export function confirmMFASetup(code: string): Promise<MFAStatus> { return apiPut<MFAStatus, { code: string }>("/auth/security/mfa/", { code }); }
export async function disableMFA(): Promise<MFAStatus> { await apiDelete("/auth/security/mfa/"); return { enabled: false, pending: false }; }
/** Without `code`, emails a verification code; with `code`, confirms it and switches to email OTP. */
export function setMFAMethod(method: MFAMethod, code?: string): Promise<MFAStatus> { return apiPatch<MFAStatus, { method: MFAMethod; code?: string }>("/auth/security/mfa/", code ? { method, code } : { method }); }

export interface AccountProfilePayload {
  email?: string;
  first_name?: string;
  last_name?: string;
}

export function getAccountProfile(): Promise<AccountProfilePayload> {
  return apiGet<AccountProfilePayload>("/auth/profile/");
}

export function updateAccountProfile(payload: AccountProfilePayload): Promise<AccountProfilePayload> {
  return apiPatch<AccountProfilePayload, AccountProfilePayload>("/auth/profile/", payload);
}

export function changePassword(payload: { current_password: string; new_password: string }): Promise<{ changed: boolean }> {
  return apiPost<{ changed: boolean }, { current_password: string; new_password: string }>("/auth/profile/password/", payload);
}

export function requestPasswordReset(email: string): Promise<{ requested: boolean }> {
  return apiPost<{ requested: boolean }, { email: string }>("/auth/password-reset/", { email });
}

export function confirmPasswordReset(payload: { uid: string; token: string; new_password: string }): Promise<{ reset: boolean }> {
  return apiPost<{ reset: boolean }, typeof payload>("/auth/password-reset/confirm/", payload);
}

/** Canonical post-login tenant, permission, module, and landing context. */
export async function getBootstrap(): Promise<AuthBootstrap> {
  return apiGet<AuthBootstrap>("/auth/bootstrap/");
}

export interface InvitationAccessPreview {
  role_code: string;
  role_name: string;
  modules: Array<{ code: string; name: string }>;
}

export interface InvitationDetails {
  email: string;
  institution_name: string;
  role_name: string;
  expires_at: string;
  existing_account: boolean;
  access_preview: InvitationAccessPreview;
}
export function getInvitation(token: string): Promise<InvitationDetails> { return apiGet<InvitationDetails>(`/auth/invitations/${token}/`); }
export function acceptInvitation(token: string, payload: { password: string; first_name?: string; last_name?: string }): Promise<{ accepted: boolean; existing_account: boolean; access_preview: InvitationAccessPreview }> { return apiPost<{ accepted: boolean; existing_account: boolean; access_preview: InvitationAccessPreview }, typeof payload>(`/auth/invitations/${token}/`, payload); }

export interface InstitutionAdminInvitationDetails { email: string; expires_at: string; }
export interface InstitutionAdminInvitationPayload {
  first_name: string;
  last_name: string;
  password: string;
  institution_name: string;
  country_code?: string;
  default_currency?: string;
  timezone?: string;
}

export function getInstitutionAdminInvitation(token: string): Promise<InstitutionAdminInvitationDetails> {
  return apiGet<InstitutionAdminInvitationDetails>(`/auth/institution-admin-invitations/${token}/`);
}

export async function acceptInstitutionAdminInvitation(token: string, payload: InstitutionAdminInvitationPayload): Promise<LoginResult> {
  const result = await apiPost<LoginResult, InstitutionAdminInvitationPayload>(`/auth/institution-admin-invitations/${token}/`, payload);
  setAuthTokens();
  return result;
}

export interface PlatformInstitutionAdminInvitation {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expires_at: string;
  accepted_at: string | null;
  invited_by_email: string | null;
  created_at: string;
}

export interface CreatePlatformInstitutionAdminInvitation {
  email: string;
  expires_in_hours?: number;
}

export interface CreatedPlatformInstitutionAdminInvitation extends PlatformInstitutionAdminInvitation {
  acceptance_token: string;
  email_delivery_status: "SENT" | "FAILED" | "MANUAL_DELIVERY_REQUIRED";
}

export function listInstitutionAdminInvitations(): Promise<PlatformInstitutionAdminInvitation[]> {
  return apiGet<PlatformInstitutionAdminInvitation[]>("/auth/institution-admin-invitations/");
}

export function createInstitutionAdminInvitation(payload: CreatePlatformInstitutionAdminInvitation): Promise<CreatedPlatformInstitutionAdminInvitation> {
  return apiPost<CreatedPlatformInstitutionAdminInvitation, CreatePlatformInstitutionAdminInvitation>("/auth/institution-admin-invitations/", payload);
}

/** Clears tokens and the selected institution. Purely client-side. */
export function logout(): void {
  void apiPost<{ logged_out: boolean }>("/auth/logout/").catch(() => {
    // Local state is cleared even if the browser is already offline.
  });
  clearTenantContext();
}

export function displayName(user: AuthUser | null | undefined): string {
  if (!user) {
    return "";
  }

  const name = `${user.first_name} ${user.last_name}`.trim();

  return name || user.email;
}
