"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

const DEV_INSTITUTION = {
  id: "dev-institution",
  name: "ErgonX Demo Institution",
  code: "DEMO",
  enabledModules: [
    "HR",
    "LEAVE",
    "ATTENDANCE",
    "PAYROLL",
    "ACCOUNTING",
    "REPORTS",
    "RECRUITMENT",
  ],
};

const DEV_USER = {
  id: "dev-user",
  email: "admin@ergonx.local",
  firstName: "ErgonX",
  lastName: "Administrator",
  role: "INSTITUTION_ADMIN",
  institutionId: "dev-institution",
  permissions: ["*"],
  institution: DEV_INSTITUTION,
};

interface AuthContextValue {
  user: typeof DEV_USER | null;
  institution: typeof DEV_INSTITUTION | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user] = useState<typeof DEV_USER | null>(DEV_USER);
  const [institution] = useState<typeof DEV_INSTITUTION | null>(
    DEV_INSTITUTION
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      institution,
      isAuthenticated: true,
      loading: false,
      login: async () => {},
      logout: () => {},
    }),
    [user, institution]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}