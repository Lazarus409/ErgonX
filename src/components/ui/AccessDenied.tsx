"use client";

import { ShieldX } from "lucide-react";

export default function AccessDenied() {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-2xl border bg-white p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <ShieldX className="h-5 w-5 text-slate-600" />
        </div>

        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Access denied
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          You do not have permission to access this resource.
        </p>
      </div>
    </div>
  );
}