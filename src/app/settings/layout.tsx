"use client";

import { useAuth } from "@/components/guards/AuthProvider";
import AccessDenied from "@/components/ui/AccessDenied";
import LoadingState from "@/components/ui/LoadingState";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState />;
  if (user?.role !== "INSTITUTION_ADMIN") return <AccessDenied />;

  return <>{children}</>;
}
