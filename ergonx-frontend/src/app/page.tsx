"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import AuthenticationGate from "@/components/guards/AuthenticationGate";
import { useAuth } from "@/components/guards/AuthProvider";
import LoadingState from "@/components/ui/LoadingState";

const roleHomeRoutes: Record<string, string> = {
  HR_ADMIN: "/hr",
  DIRECTOR: "/dashboard",
  FINANCE_MANAGER: "/accounting",
  ACCOUNTANT: "/accounting",
  AUDITOR: "/accounting",
  EMPLOYEE: "/me/leave",
};

function HomeResolver() {
  const router = useRouter();
  const { user, bootstrap, isPlatformAdmin } = useAuth();

  useEffect(() => {
    if (isPlatformAdmin) {
      router.replace("/platform");
      return;
    }

    if (user?.role === "INSTITUTION_ADMIN") {
      router.replace(bootstrap?.onboardingReady ? "/dashboard" : "/onboarding");
      return;
    }

    router.replace(roleHomeRoutes[user?.role ?? ""] ?? "/dashboard");
  }, [bootstrap?.onboardingReady, isPlatformAdmin, router, user?.role]);

  return <LoadingState />;
}

export default function HomePage() {
  return <AuthenticationGate><HomeResolver /></AuthenticationGate>;
}
