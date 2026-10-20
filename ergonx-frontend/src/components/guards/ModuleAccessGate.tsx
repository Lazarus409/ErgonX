"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/guards/AuthProvider";
import { canAccess, sharedRecordRoutes, type DataScope } from "@/components/navigation/navigation";
import AccessDenied from "@/components/ui/AccessDenied";
import LoadingState from "@/components/ui/LoadingState";
import { hasModule } from "@/types/institutions";

/**
 * Protects a module route tree with the same rule the sidebar uses, so a page
 * missing from someone's navigation cannot be opened by URL either. Shared
 * record pages (e.g. a member's own leave request) stay reachable; the API
 * remains the authority for which records load.
 *
 * `selfService` sends someone without workspace access to their own page instead
 * (e.g. an employee who follows a link to /leave lands on /me/leave).
 */
export default function ModuleAccessGate({ module, anyPermissions = [], allPermissions = [], scopes, selfService, children }: { module?: string; anyPermissions?: readonly string[]; allPermissions?: readonly string[]; scopes?: readonly DataScope[]; selfService?: { href: string; permission: string }; children: React.ReactNode }) {
  const { user, institution, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const permissions = user?.permissions ?? [];
  const can = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const context = { can, moduleEnabled: (code: string) => hasModule(institution?.enabledModules, code), scope: user?.dataScope ?? "INSTITUTION" } as const;
  const workspace = !loading && canAccess({ module, anyPermissions, scopes }, context) && allPermissions.every(can);
  const sharedRecord = !loading && (!module || context.moduleEnabled(module)) && sharedRecordRoutes.some((route) => route.pattern.test(pathname) && canAccess(route, context));
  const redirectTo = !loading && !workspace && !sharedRecord && selfService && can(selfService.permission) && (!module || context.moduleEnabled(module)) ? selfService.href : null;
  useEffect(() => { if (redirectTo) router.replace(redirectTo); }, [redirectTo, router]);
  if (loading || redirectTo) return <LoadingState />;
  if (!workspace && !sharedRecord) return <AccessDenied permission={[...allPermissions.filter((code) => !can(code)), ...anyPermissions][0]} />;
  return <>{children}</>;
}
