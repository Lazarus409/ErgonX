"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/components/guards/AuthProvider";
import AccessDenied from "@/components/ui/AccessDenied";
import LoadingState from "@/components/ui/LoadingState";

export default function SelfServiceGuard({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return <LoadingState />;
  }

  if (user?.role !== "EMPLOYEE") {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
