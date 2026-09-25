import { LockKeyhole } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";

export default function ModuleDisabled({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-line bg-surface p-6 shadow-elevation-1">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-soft text-neutral-ink" aria-hidden="true">
          <LockKeyhole className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-heading font-semibold text-ink-strong">{moduleName} isn&apos;t enabled</h2>
        <p className="mt-2 text-support text-ink-muted">
          The {moduleName} module is not enabled for the active institution. Contact an institution administrator if this module is required.
        </p>
        <ButtonLink href="/" variant="secondary" className="mt-6">Return home</ButtonLink>
      </div>
    </div>
  );
}
