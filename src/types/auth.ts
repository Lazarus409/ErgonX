export type UserRole =
  | "INSTITUTION_ADMIN"
  | "HR_ADMIN"
  | "DIRECTOR"
  | "EMPLOYEE"
  | "ACCOUNTANT"
  | "FINANCE_MANAGER"
  | "AUDITOR";

export interface Institution {
  id: string;
  name: string;
  code: string;
  enabledModules: string[];
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole | string;
  institutionId: string;
  permissions: string[];
  institution?: Institution;
}

export interface AuthState {
  user: User | null;
  institution: Institution | null;
  isAuthenticated: boolean;
  loading: boolean;
}