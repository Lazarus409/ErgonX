"use client";

import { useAuth } from "@/components/guards/AuthProvider";
import AccessDenied from "@/components/ui/AccessDenied";
import LoadingState from "@/components/ui/LoadingState";
import AppShell from "@/components/layout/AppShell";
import { settingsAreas } from "./page";
import { usePathname } from "next/navigation";
import BackNavigation from "@/components/ui/BackNavigation";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) return <LoadingState />;
  const canAccessASettingsArea = Boolean(user?.permissions.includes("*") || user?.permissions.some((permission) => settingsAreas.some((area) => area.permission === permission || area.anyPermissions?.includes(permission))));

  if (!canAccessASettingsArea) return <AccessDenied />;

  return <AppShell>{pathname !== "/settings" && <BackNavigation fallback="/settings" label="Back to Settings" />}{children}</AppShell>;
}
