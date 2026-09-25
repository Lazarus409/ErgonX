import Logo from "@/components/brand/Logo";
import { cx } from "@/lib/cx";

/**
 * Sidebar workspace header (branding.md §Sidebar).
 *
 * The shell always carries the ErgonX symbol; the tenant is the workspace
 * context beside it. When the institution has uploaded a logo, that logo takes
 * the symbol's place and ErgonX drops to a subtle "on ErgonX" attribution, so
 * the tenant never feels like a guest in its own system. Collapsing leaves
 * only the symbol (or tenant logo); the text fades in 220 ms and collapses to
 * an instant swap under prefers-reduced-motion.
 */
export default function SidebarLogo({ collapsed, institutionName, institutionCode, logoSrc }: { collapsed: boolean; institutionName?: string | null; institutionCode?: string | null; logoSrc?: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {logoSrc ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" className="h-full w-full object-contain" />
        </span>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center">
          <Logo variant="mark" height={30} alt="" priority />
        </span>
      )}
      <span
        className={cx(
          "min-w-0 leading-tight transition-[opacity,transform] duration-220 ease-standard",
          collapsed ? "pointer-events-none -translate-x-1 opacity-0" : "opacity-100",
        )}
        aria-hidden={collapsed || undefined}
      >
        <span className="block truncate text-sm font-semibold text-white">{institutionName ?? "ErgonX"}</span>
        {logoSrc ? (
          <span className="flex items-center gap-1 text-caption text-white/50">
            on <Logo variant="mono-white" height={9} alt="ErgonX" className="opacity-75" />
          </span>
        ) : (
          institutionCode && <span className="block truncate text-caption text-white/50">{institutionCode}</span>
        )}
      </span>
    </span>
  );
}
