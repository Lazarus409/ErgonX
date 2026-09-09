"use client";

import { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import LoadingState from "../ui/LoadingState";

interface PermissionGuardProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
}

export default function PermissionGuard({
  children,
  permission,
  permissions = [],
  requireAll = false,
}: PermissionGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState />;
  }

  if (!user) {
    return null;
  }

  const required = [
    ...(permission ? [permission] : []),
    ...permissions,
  ];

  if (required.length === 0) {
    return <>{children}</>;
  }

  const userPermissions = user.permissions || [];

  const allowed = requireAll
    ? required.every((item) =>
        userPermissions.includes(item)
      )
    : required.some((item) =>
        userPermissions.includes(item)
      );

  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-950">
            Access Denied
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            You do not have permission to access this section.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
