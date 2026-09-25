/**
 * Core HR types.
 *
 * Mirrors `apps/employees/serializers.py` and
 * `apps/organization/serializers.py`.
 */

export type EmployeeStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "TERMINATED";

export const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "TERMINATED",
];

export type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

export type EmploymentType =
  | "PERMANENT"
  | "CONTRACT"
  | "TEMPORARY"
  | "INTERN"
  | "CASUAL";

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  "PERMANENT",
  "CONTRACT",
  "TEMPORARY",
  "INTERN",
  "CASUAL",
];

export type StaffCategory = "JUNIOR" | "SENIOR" | "OTHER";

export type EmploymentStatus = "ACTIVE" | "ENDED" | "SUSPENDED";

export interface Employee {
  id: string;
  user: string | null;
  employee_number: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  full_name: string;
  personal_email: string;
  work_email: string;
  phone: string;
  avatar_key: string;
  date_of_birth: string | null;
  gender: Gender | string;
  hire_date: string;
  status: EmployeeStatus | string;
  created_at: string;
  updated_at: string;
}

export interface EmployeePayload {
  user?: string | null;
  employee_number: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  personal_email?: string;
  work_email?: string;
  phone?: string;
  avatar_key?: string;
  date_of_birth?: string | null;
  gender?: Gender | string;
  hire_date: string;
  status?: EmployeeStatus | string;
}

export interface Employment {
  id: string;
  employee: string;
  department: string | null;
  position: string | null;
  grade: string;
  location: string;
  reports_to: string | null;
  employment_type: EmploymentType | string;
  staff_category: StaffCategory | string;
  start_date: string;
  end_date: string | null;
  status: EmploymentStatus | string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmploymentPayload {
  employee: string;
  department?: string | null;
  position?: string | null;
  /** Required by the backend serializer. */
  grade: string;
  /** Required by the backend serializer. */
  location: string;
  reports_to?: string | null;
  employment_type: EmploymentType | string;
  staff_category?: StaffCategory | string;
  start_date: string;
  end_date?: string | null;
  status?: EmploymentStatus | string;
  is_current?: boolean;
}

export interface EmergencyContact {
  id: string;
  employee: string;
  full_name: string;
  relationship: string;
  phone: string;
  alternate_phone: string;
  email: string;
  address: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmergencyContactPayload {
  employee: string;
  full_name: string;
  relationship: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  address?: string;
  is_primary?: boolean;
}

export type OnboardingStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "READY_FOR_ACTIVATION"
  | "COMPLETED"
  | "CANCELLED";

export type OffboardingStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "READY_TO_TERMINATE"
  | "COMPLETED"
  | "CANCELLED";

export interface EmployeeOnboarding {
  id: string;
  employee: string;
  status: OnboardingStatus;
  started_at: string | null;
  completed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeOffboarding {
  id: string;
  employee: string;
  status: OffboardingStatus;
  initiated_at: string | null;
  completed_at: string | null;
  last_working_day: string | null;
  reason: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeLifecycle {
  onboarding: EmployeeOnboarding | null;
  offboarding: EmployeeOffboarding | null;
}

export interface OffboardingStartPayload {
  last_working_day?: string;
  reason?: string;
  notes?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  parent: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  department: string | null;
  title: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Grade {
  id: string;
  name: string;
  code: string;
  level: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
  is_remote: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Filters supported by `EmployeeFilter` on `GET /employees/`. */
export interface EmployeeFilters {
  status?: EmployeeStatus | string;
  department?: string;
  grade?: string;
  location?: string;
  employment_type?: EmploymentType | string;
}
