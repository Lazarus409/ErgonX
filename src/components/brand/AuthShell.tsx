import type { ReactNode } from "react";

import { AdaptiveLogo } from "@/components/brand/Logo";
import { cx } from "@/lib/cx";

/**
 * Public / authentication frame (concept: Login option 2, Get Started option 3).
 *
 * A light canvas carries the brand's translucent X ribbons; the form sits
 * directly on it under the primary lockup. Passing `intro` switches to the
 * split layout: brand, heading and help on the left, the task in a white card
 * on the right.
 */
export default function AuthShell({ children, width = "md", intro }: { children: ReactNode; width?: "md" | "lg"; intro?: ReactNode }) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-auth-canvas">
      <AuthBackdrop variant={intro ? "wide" : "right"} />
      {intro ? (
        <div className="mx-auto grid min-h-screen w-full max-w-[1320px] items-start gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-14 lg:px-12 xl:gap-20">
          <div className="animate-slide-up lg:sticky lg:top-16 lg:self-start lg:pt-6">
            <AdaptiveLogo height={56} priority />
            <div className="mt-8 lg:mt-10">{intro}</div>
          </div>
          <div className="min-w-0 animate-slide-up rounded-3xl border border-line-soft bg-surface/95 p-5 shadow-[0_24px_60px_-28px_rgb(15_35_69/0.28)] backdrop-blur-sm sm:p-8 xl:p-10">
            {children}
          </div>
        </div>
      ) : (
        <div className="flex min-h-screen flex-col px-5 py-10 sm:px-10 lg:px-[7vw]">
          <div className="flex flex-1 flex-col justify-center py-4">
            <div className={cx("w-full animate-slide-up", width === "md" ? "max-w-[34rem]" : "max-w-2xl")}>
              <AdaptiveLogo height={60} priority />
              <div className={cx("mt-10 sm:mt-14", width === "lg" && "rounded-3xl border border-line-soft bg-surface/95 p-5 shadow-[0_24px_60px_-28px_rgb(15_35_69/0.28)] backdrop-blur-sm sm:p-8")}>{children}</div>
            </div>
          </div>
          <p className="text-caption text-ink-subtle">© {new Date().getFullYear()} ErgonX</p>
        </div>
      )}
    </main>
  );
}

/**
 * The concept's soft, translucent X ribbons. `right` sweeps across the right
 * of the page behind the sign-in form; `wide` frames a wider split layout;
 * `mirrored` places a ribbon on each side (splash).
 */
export function AuthBackdrop({ variant = "right" }: { variant?: "right" | "wide" | "mirrored" }) {
  const ribbons = (id: string) => (
    <>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#8ff0ff" stopOpacity="0.15" />
          <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.75" />
          <stop offset="75%" stopColor="#2f6bff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#7cf2ff" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="1" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#8b7cff" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <circle cx="560" cy="560" r="360" fill={`url(#${id}-glow)`} />
      {/* Left arc of the X */}
      <path d="M20 -60 C 380 110 610 330 570 540 C 530 760 330 900 170 1080 L 380 1080 C 520 900 700 760 720 540 C 740 320 520 100 200 -60 Z" fill={`url(#${id}-a)`} opacity="0.55" filter={`url(#${id}-soft)`} />
      <path d="M200 -60 C 520 100 740 320 720 540 C 700 760 520 900 380 1080" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2" fill="none" />
      {/* Right arc of the X */}
      <path d="M900 40 C 640 190 560 380 600 560 C 640 740 760 880 900 980 L 900 800 C 800 730 730 640 720 550 C 710 440 780 300 900 220 Z" fill={`url(#${id}-b)`} opacity="0.6" filter={`url(#${id}-soft)`} />
      <path d="M900 220 C 780 300 710 440 720 550 C 730 640 800 730 900 800" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="2" fill="none" />
      {/* Soft lower sweep */}
      <path d="M260 1080 C 420 900 640 820 900 760 L 900 1080 Z" fill={`url(#${id}-b)`} opacity="0.18" />
    </>
  );

  if (variant === "mirrored") {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-80 dark:opacity-40">
        <svg className="absolute -left-[22rem] top-1/2 h-[120%] -translate-y-1/2 -scale-x-100" viewBox="0 0 900 1020" preserveAspectRatio="xMidYMid slice">{ribbons("bd-l")}</svg>
        <svg className="absolute -right-[22rem] top-1/2 h-[120%] -translate-y-1/2" viewBox="0 0 900 1020" preserveAspectRatio="xMidYMid slice">{ribbons("bd-r")}</svg>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className={cx("pointer-events-none absolute inset-0 -z-10 overflow-hidden dark:opacity-45", variant === "wide" && "opacity-60")}>
      <svg
        className={cx("absolute top-0 h-full", variant === "right" ? "right-0 w-[150%] opacity-40 sm:opacity-60 lg:w-[62%] lg:opacity-100" : "-right-[10%] w-[90%]")}
        viewBox="0 0 900 1020"
        preserveAspectRatio="xMinYMid slice"
      >
        {ribbons(`bd-${variant}`)}
      </svg>
    </div>
  );
}

/** Form header used inside AuthShell. */
export function AuthHeading({ eyebrow, title, description }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="mb-2 text-support font-semibold text-primary-ink">{eyebrow}</p>}
      <h1 className="text-[2.125rem] font-bold leading-tight tracking-tight text-ink-strong sm:text-[2.625rem]">{title}</h1>
      {description && <p className="mt-3 text-[1.0625rem] leading-7 text-ink-muted">{description}</p>}
    </div>
  );
}
