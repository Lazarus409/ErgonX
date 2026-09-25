import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * Expressive greeting surface for Home / Employee Home. The abstract
 * background echoes the two mirrored curves of the ErgonX X mark; it is
 * decorative, static and hidden from assistive technology.
 */
export default function HomeHero({ eyebrow, title, subtitle, children, aside, className }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; children?: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={cx("relative isolate overflow-hidden rounded-3xl bg-brand-navy px-6 py-7 text-white shadow-elevation-3 sm:px-8 sm:py-9 dark:bg-[#0b1a36] dark:ring-1 dark:ring-white/5", className)}>
      <HeroArt />
      <div className={cx("relative grid gap-6", aside && "lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end")}>
        <div className="min-w-0">
          {eyebrow && <p className="text-support font-semibold text-accent-aqua">{eyebrow}</p>}
          <h1 className="mt-1.5 text-balance text-title font-bold tracking-tight sm:text-display">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-body text-white/70">{subtitle}</p>}
          {children && <div className="mt-6">{children}</div>}
        </div>
        {aside && <div className="min-w-0">{aside}</div>}
      </div>
    </section>
  );
}

function HeroArt() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -right-24 -top-16 -z-10 h-[140%] w-auto opacity-90 sm:right-0" viewBox="0 0 520 420" fill="none">
      <defs>
        <linearGradient id="hero-x-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#14d2b8" />
          <stop offset="35%" stopColor="#22d3ee" />
          <stop offset="70%" stopColor="#2f6bff" />
          <stop offset="100%" stopColor="#7c5cff" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#2f6bff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#2f6bff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="300" cy="210" r="210" fill="url(#hero-glow)" />
      {/* Mirrored curves after the X mark geometry */}
      <path d="M250 30 C 160 30 110 120 150 185 C 170 215 210 235 250 210 C 290 235 330 215 350 185 C 390 120 340 30 250 30 Z" stroke="url(#hero-x-a)" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M176 30 C 240 70 262 140 250 210 C 238 280 260 350 324 390" stroke="url(#hero-x-a)" strokeOpacity="0.55" strokeWidth="22" strokeLinecap="round" />
      <path d="M324 30 C 260 70 238 140 250 210 C 262 280 240 350 176 390" stroke="url(#hero-x-a)" strokeOpacity="0.28" strokeWidth="22" strokeLinecap="round" />
      <circle cx="420" cy="90" r="3" fill="#22d3ee" fillOpacity="0.8" />
      <circle cx="120" cy="330" r="2.5" fill="#7c5cff" fillOpacity="0.8" />
    </svg>
  );
}

/** Compact translucent stat used inside the hero. */
export function HeroStat({ label, value, tone = "default" }: { label: string; value: ReactNode; tone?: "default" | "attention" }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.07] px-3 py-3 sm:px-4 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
      <p className={cx("text-heading font-semibold tabular-nums sm:text-kpi-sm", tone === "attention" ? "text-[#fcc96d]" : "text-white")}>{value}</p>
      <p className="mt-0.5 line-clamp-2 text-caption leading-tight text-white/60">{label}</p>
    </div>
  );
}
