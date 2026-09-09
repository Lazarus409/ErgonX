"use client";

import { ReactNode } from "react";
import { useAuth } from "./AuthProvider";

export default function ModuleGuard({
  children,
  module,
}: {
  children: ReactNode;
  module: string;
}) {
  const { institution, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!institution) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-950">
            Institution Context Required
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            No active institution context is available.
          </p>
        </div>
      </div>
    );
  }

  if (!institution.enabledModules?.includes(module)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-950">
            Module Disabled
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            This module is not enabled for this institution.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
