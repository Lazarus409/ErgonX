"use client";

import { useAuth } from "@/components/guards/AuthProvider";
import AccessDenied from "@/components/ui/AccessDenied";
import LoadingState from "@/components/ui/LoadingState";
import { hasModule } from "@/types/institutions";

/** Protects a module route tree; endpoint-specific RBAC stays server-owned. */
export default function ModuleAccessGate({ module, anyPermissions = [], allPermissions = [], children }: { module?: string; anyPermissions?: string[]; allPermissions?: string[]; children: React.ReactNode }) {
  const { user, institution, loading } = useAuth();
  if (loading) return <LoadingState />;
  const permissions = user?.permissions ?? [];
  const hasAnyRequiredPermission =
    anyPermissions.length === 0 || anyPermissions.some((permission) => permissions.includes(permission));
  const hasAllRequiredPermissions = allPermissions.every((permission) => permissions.includes(permission));
  const authorized = permissions.includes("*") || (hasAnyRequiredPermission && hasAllRequiredPermissions);
  if ((module && !hasModule(institution?.enabledModules, module)) || !authorized) return <AccessDenied />;
  return <>{children}</>;
}
