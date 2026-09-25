import { ShieldX } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";

export default function AccessDenied({ title = "You don't have access to this area", description = "Your current role in this institution does not include the permission this page requires. Contact an institution administrator if you need access." }: { title?: string; description?: string }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-line bg-surface p-6 shadow-elevation-1">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mod-audit-soft text-mod-audit" aria-hidden="true">
          <ShieldX className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-heading font-semibold text-ink-strong">{title}</h2>
        <p className="mt-2 text-support text-ink-muted">{description}</p>
        <ButtonLink href="/" variant="secondary" className="mt-6">Return home</ButtonLink>
      </div>
    </div>
  );
}
