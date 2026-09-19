/**
 * Institution, membership and module-enablement types.
 *
 * Mirrors `apps/institutions/serializers.py`.
 */

/** Module codes as stored by the backend (`InstitutionModule.ModuleCode`). */
export type ModuleCode =
  | "CORE_HR"
  | "LEAVE"
  | "ATTENDANCE"
  | "PAYROLL"
  | "ACCOUNTING"
  | "RECRUITMENT"
  | "REPORTS";

export const MODULE_CODES: ModuleCode[] = [
  "CORE_HR",
  "LEAVE",
  "ATTENDANCE",
  "PAYROLL",
  "ACCOUNTING",
  "RECRUITMENT",
  "REPORTS",
];

export const MODULE_LABELS: Record<ModuleCode, string> = {
  CORE_HR: "Core HR",
  LEAVE: "Leave",
  ATTENDANCE: "Attendance",
  PAYROLL: "Payroll",
  ACCOUNTING: "Accounting",
  RECRUITMENT: "Recruitment",
  REPORTS: "Reports",
};

/**
 * The sidebar and several existing screens use the short label `HR` for the
 * Core HR module. The backend module code is `CORE_HR`. Both spellings are
 * normalised here so UI code and API data can be compared safely.
 */
export function normalizeModuleCode(value: string): ModuleCode | string {
  const upper = value.trim().toUpperCase();
  return upper === "HR" ? "CORE_HR" : upper;
}

export function hasModule(
  enabledModules: readonly string[] | undefined | null,
  required: string,
): boolean {
  if (!enabledModules) {
    return false;
  }

  const target = normalizeModuleCode(required);

  return enabledModules.some(
    (module) => normalizeModuleCode(module) === target,
  );
}

export type MembershipStatus =
  | "INVITED"
  | "ACTIVE"
  | "SUSPENDED"
  | "INACTIVE";

export type ConfigurationStatus =
  | "NOT_CONFIGURED"
  | "IN_PROGRESS"
  | "READY"
  | "BLOCKED";

export interface Institution {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  country_code: string;
  default_currency: string;
  country: string;
  currency: string;
  timezone: string;
  logo: string | null;
  is_active: boolean;
}

export interface RoleSummary {
  id: string;
  code: string;
  name: string;
  /** Permission codes such as `employee.view`. */
  permissions: string[];
}

export interface InstitutionRole extends RoleSummary {
  description: string;
  is_system_role: boolean;
  is_custom: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionDefinition {
  code: string;
  name: string;
  module_code: ModuleCode | string;
  classification: "NORMAL" | "PRIVILEGED" | "PLATFORM_ONLY" | string;
  description: string;
}

export interface MembershipUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface InstitutionMembership {
  id: string;
  institution: Institution;
  user?: MembershipUser;
  role: RoleSummary | null;
  status: MembershipStatus | string;
  is_primary: boolean;
  joined_at: string | null;
  ended_at: string | null;
}

export interface UserPreference {
  id: string;
  preference_key: string;
  value_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InstitutionSetting {
  id: string;
  key: string;
  value: unknown;
  is_sensitive: boolean;
  updated_at: string;
}

export interface InstitutionModule {
  id: string;
  module_code: ModuleCode | string;
  is_enabled: boolean;
  configuration_status: ConfigurationStatus | string;
}

export interface InstitutionOnboardingStep {
  code: string;
  sequence: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "BLOCKED" | string;
  required_module: ModuleCode | string;
  blocker_code: string;
  blocker_message: string;
  completed_at: string | null;
  is_admin_skipped: boolean;
}

export interface InstitutionOnboarding {
  status: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "READY" | string;
  current_step: string;
  completion_percentage: number;
  started_at: string | null;
  completed_at: string | null;
  validation_summary: { blockers?: Array<{ step: string; code: string; message: string }> };
  steps: InstitutionOnboardingStep[];
}

/** Response shape of `GET /institutions/current/`. */
export interface CurrentInstitutionContext {
  institution: Institution;
  membership: InstitutionMembership;
  active_capabilities: string[];
}
