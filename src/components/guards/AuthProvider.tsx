"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authApi, getAccessToken, institutionsApi } from "@/lib/api";
import type { SessionBootstrap, SessionInstitution, SessionUser } from "@/types/auth";

/* -------------------------------------------------------------------------- */
/* Development auth bypass                                                    */
/*                                                                            */
/* It remains available for local UI development, but is never enabled by     */
/* default in a production Next build. Set the public flag explicitly only    */
/* for an isolated local development environment.                             */
/* -------------------------------------------------------------------------- */

const DEV_AUTH_BYPASS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_BYPASS === "true";

const DEV_INSTITUTION: SessionInstitution = {
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

const DEV_USER: SessionUser = {
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
  user: SessionUser | null;
  institution: SessionInstitution | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** True once a real backend session has replaced the bypass. */
  isLiveSession: boolean;
  isPlatformAdmin: boolean;
  bootstrap: SessionBootstrap | null;
  login: (email: string, password: string) => Promise<SessionBootstrap>;
  logout: () => void;
  refreshSession: () => Promise<SessionBootstrap>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Builds the session from the tenant context endpoint. The backend resolves
 * the institution from the user's own active memberships; when several are
 * active and none is primary, one must be selected explicitly before
 * `/institutions/current/` will answer.
 */
async function loadLiveSession(): Promise<{
  user: SessionUser;
  institution: SessionInstitution;
  bootstrap: SessionBootstrap;
}> {
  const memberships = await institutionsApi.getMyMemberships();
  const membership = institutionsApi.resolveDefaultMembership(memberships);

  if (membership) {
    institutionsApi.selectInstitution(membership.institution.id);
  }

  const context = await authApi.getBootstrap();

  const institution: SessionInstitution = {
    id: context.active_institution.id,
    name: context.active_institution.name,
    code: context.active_institution.code,
    enabledModules: context.enabled_modules,
  };

  const user: SessionUser = {
    id: context.user.id,
    email: context.user.email,
    firstName: context.user.first_name,
    lastName: context.user.last_name,
    role: context.active_membership.role_code,
    institutionId: institution.id,
    permissions: context.effective_permissions,
    institution,
  };

  return { user, institution, bootstrap: { onboardingReady: context.onboarding_ready, onboardingStatus: context.onboarding_status, defaultLanding: context.default_landing, availableDashboards: context.available_dashboards, roleCode: context.active_membership.role_code } };
}

async function loadPlatformSession(): Promise<{ user: SessionUser; bootstrap: SessionBootstrap }> {
  const user = await authApi.getCurrentUser();
  if (!user.is_platform_admin) {
    throw new Error("This account is not a platform administrator.");
  }
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: "PLATFORM_ADMIN",
      institutionId: "",
      permissions: [],
      isPlatformAdmin: true,
    },
    bootstrap: { onboardingReady: true, onboardingStatus: "READY", defaultLanding: "PLATFORM", availableDashboards: [], roleCode: "PLATFORM_ADMIN" },
  };
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(
    DEV_AUTH_BYPASS_ENABLED ? DEV_USER : null,
  );
  const [institution, setInstitution] = useState<SessionInstitution | null>(
    DEV_AUTH_BYPASS_ENABLED ? DEV_INSTITUTION : null,
  );
  const [isLiveSession, setIsLiveSession] = useState(false);
  const [bootstrap, setBootstrap] = useState<SessionBootstrap | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  // Stays false so the bypass renders immediately and server and client agree
  // on the first paint. A stored token is exchanged for a real session in the
  // background.
  const [loading, setLoading] = useState(false);

  const applyLiveSession = useCallback(async (): Promise<SessionBootstrap> => {
    try {
      const session = await loadLiveSession();

      setUser(session.user);
      setInstitution(session.institution);
      setBootstrap(session.bootstrap);
      setIsPlatformAdmin(false);
      setIsLiveSession(true);
      return session.bootstrap;
    } catch (liveSessionError) {
      // Platform-only administrators do not have an institution membership,
      // so their session must be refreshed from `/auth/me/` instead.
      try {
        const platform = await loadPlatformSession();
        setUser(platform.user);
        setInstitution(null);
        setBootstrap(platform.bootstrap);
        setIsPlatformAdmin(true);
        setIsLiveSession(true);
        return platform.bootstrap;
      } catch {
        throw liveSessionError;
      }
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      return;
    }

    let active = true;

    async function hydrate() {
      try {
        const session = await loadLiveSession();

        if (active) {
          setUser(session.user);
          setInstitution(session.institution);
          setBootstrap(session.bootstrap);
          setIsPlatformAdmin(false);
          setIsLiveSession(true);
        }
      } catch {
        try {
          const platform = await loadPlatformSession();
          if (active) {
            setUser(platform.user);
            setInstitution(null);
            setBootstrap(platform.bootstrap);
            setIsPlatformAdmin(true);
            setIsLiveSession(true);
          }
        } catch {
          // Local development falls back to the bypass. Production clears the
          // session so route guards can return the user to the sign-in screen.
          if (active) {
            setUser(DEV_AUTH_BYPASS_ENABLED ? DEV_USER : null);
            setInstitution(DEV_AUTH_BYPASS_ENABLED ? DEV_INSTITUTION : null);
            setIsPlatformAdmin(false);
            setIsLiveSession(false);
            setBootstrap(null);
          }
        }
      }
    }

    hydrate();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);

      try {
        await authApi.login({ email, password });
        return await applyLiveSession();
      } finally {
        setLoading(false);
      }
    },
    [applyLiveSession],
  );

  const logout = useCallback(() => {
    authApi.logout();

    setUser(DEV_AUTH_BYPASS_ENABLED ? DEV_USER : null);
    setInstitution(DEV_AUTH_BYPASS_ENABLED ? DEV_INSTITUTION : null);
    setIsLiveSession(false);
    setIsPlatformAdmin(false);
    setBootstrap(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      institution,
      isAuthenticated: user !== null,
      loading,
      isLiveSession,
      isPlatformAdmin,
      bootstrap,
      login,
      logout,
      refreshSession: applyLiveSession,
    }),
    [user, institution, loading, isLiveSession, isPlatformAdmin, bootstrap, login, logout, applyLiveSession],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
