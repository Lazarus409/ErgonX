import type { ReactNode } from "react";
import { CalendarCheck, ShieldCheck, Wallet } from "lucide-react";

import Logo, { AdaptiveLogo } from "@/components/brand/Logo";
import { cx } from "@/lib/cx";

/**
 * Public / authentication frame. The navy brand panel is a major product
 * moment and therefore carries the primary (reversed) lockup and the
 * signature gradient; the form side stays calm and neutral.
 */
export default function AuthShell({ children, width = "md", aside }: { children: ReactNode; width?: "md" | "lg"; aside?: ReactNode }) {
  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative isolate hidden overflow-hidden bg-brand-navy px-12 py-12 text-white lg:flex lg:flex-col xl:px-16">
        <BrandArt />
        <Logo variant="reversed" height={40} priority />
        <div className="mt-auto max-w-md">
          {aside ?? (
            <>
              <p className="text-support font-semibold text-accent-aqua">Workforce &amp; Financial Management</p>
              <h2 className="mt-3 text-display font-bold leading-tight tracking-tight">One calm workspace for people, pay and the ledger.</h2>
              <ul className="mt-8 space-y-4 text-body text-white/75">
                <Point icon={ShieldCheck} tone="text-accent-teal">Institution-scoped access with role-based permissions and MFA.</Point>
                <Point icon={CalendarCheck} tone="text-accent-aqua">Leave, attendance and scheduling that employees can serve themselves.</Point>
                <Point icon={Wallet} tone="text-accent-violet">Ghana-ready payroll that posts cleanly to accounting.</Point>
              </ul>
            </>
          )}
        </div>
        <p className="mt-12 text-caption text-white/40">© {new Date().getFullYear()} ErgonX</p>
      </aside>

      <section className="flex min-h-screen flex-col px-5 py-8 sm:px-8">
        <div className="lg:hidden">
          <AdaptiveLogo height={30} priority />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className={cx("w-full animate-slide-up", width === "md" ? "max-w-md" : "max-w-2xl")}>{children}</div>
        </div>
      </section>
    </main>
  );
}

function Point({ icon: Icon, tone, children }: { icon: typeof ShieldCheck; tone: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] ring-1 ring-inset ring-white/10", tone)} aria-hidden="true"><Icon className="h-4 w-4" /></span>
      <span>{children}</span>
    </li>
  );
}

function BrandArt() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -right-40 top-1/2 -z-10 h-[130%] -translate-y-1/2 opacity-90" viewBox="0 0 520 620" fill="none">
      <defs>
        <linearGradient id="auth-x" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#14d2b8" />
          <stop offset="35%" stopColor="#22d3ee" />
          <stop offset="70%" stopColor="#2f6bff" />
          <stop offset="100%" stopColor="#7c5cff" />
        </linearGradient>
        <radialGradient id="auth-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#2f6bff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#2f6bff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="260" cy="310" r="260" fill="url(#auth-glow)" />
      <path d="M150 40 C 250 110 280 210 260 310 C 240 410 270 510 370 580" stroke="url(#auth-x)" strokeOpacity="0.55" strokeWidth="34" strokeLinecap="round" />
      <path d="M370 40 C 270 110 240 210 260 310 C 280 410 250 510 150 580" stroke="url(#auth-x)" strokeOpacity="0.25" strokeWidth="34" strokeLinecap="round" />
    </svg>
  );
}

/** Form header used inside AuthShell cards. */
export function AuthHeading({ eyebrow, title, description }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="text-support font-semibold text-primary-ink">{eyebrow}</p>}
      <h1 className="mt-2 text-title font-bold tracking-tight text-ink-strong">{title}</h1>
      {description && <p className="mt-2 text-body text-ink-muted">{description}</p>}
    </div>
  );
}
