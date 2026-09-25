import Logo from "@/components/brand/Logo";

/**
 * Restrained start-up treatment shown only while the session is genuinely
 * resolving. It never delays start-up: it disappears as soon as the
 * authenticated shell can render.
 */
export default function SplashScreen({ message = "Preparing your workspace…" }: { message?: string }) {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-canvas">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span aria-hidden="true" className="bg-signature absolute inset-0 rounded-[28px] opacity-20 blur-xl" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-[24px] bg-brand-navy shadow-elevation-3 animate-splash-pulse">
          <Logo variant="mark" height={40} alt="" priority />
        </span>
      </div>
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <span className="block h-full w-full bg-[linear-gradient(90deg,transparent,var(--accent-aqua),var(--accent-blue),var(--accent-violet),transparent)] bg-[length:200%_100%] animate-shimmer" />
      </div>
      <p className="mt-4 text-support font-medium text-ink-muted">{message}</p>
    </div>
  );
}
