import { ShieldX } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";

export default function AccessDenied({ title = "You don't have access to this area", description = "Your current role in this institution does not include the permission this page requires. Contact an institution administrator if you need access." }: { title?: string; description?: string }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-line bg-surface p-6 shadow-elevation-1">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mod-audit-soft text-mod-audit ring-8 ring-mod-audit-soft/40" aria-hidden="true">
          <ShieldX className="h-8 w-8" />
        </span>
        <h2 className="mt-5 text-heading font-bold text-headline">{title}</h2>
        <p className="mt-2 text-support text-ink-muted">{description}</p>
        <ButtonLink href="/" variant="secondary" className="mt-6">Return home</ButtonLink>
      </div>
    </div>
  );
}
