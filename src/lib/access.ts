"use client";

import { useAuth } from "@/components/guards/AuthProvider";
import { hasModule } from "@/types/institutions";

/** Permissions that make a membership eligible for personal self-service. */
export const SELF_SERVICE_PERMISSIONS = ["leave.request", "attendance.clock", "payslip.view", "tax_relief.claim"] as const;

/**
 * Presentation-level access helpers. These decide what UI to *show*; the
 * backend remains the authority for every read and write.
 */
export function useAccess() {
  const { user, institution } = useAuth();
  const permissions = user?.permissions ?? [];
  const can = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const canAny = (list: readonly string[]) => list.some(can);
  const moduleEnabled = (module: string) => hasModule(institution?.enabledModules, module);
  const selfServiceEligible = canAny(SELF_SERVICE_PERMISSIONS);
  return { user, institution, can, canAny, moduleEnabled, selfServiceEligible };
}
