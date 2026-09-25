import Logo from "@/components/brand/Logo";
import { cx } from "@/lib/cx";

/**
 * Sidebar brand transition (Design System v2, branding.md §Sidebar transition).
 *
 * Two layered assets share one fixed-size container so the header never
 * reflows. Collapsing, the reversed wordmark scales/fades toward the symbol
 * position while the X mark scales/fades in; expanding reverses it. Timing
 * is 220 ms on the standard curve and collapses to an instant swap under
 * prefers-reduced-motion (global rule in globals.css).
 */
export default function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <span className="relative block h-9 w-[120px]" aria-label="ErgonX" role="img">
      <span
        aria-hidden="true"
        className={cx(
          "absolute left-0 top-1/2 origin-left -translate-y-1/2 transition-[opacity,transform,filter] duration-[220ms] ease-standard",
          collapsed ? "pointer-events-none scale-[0.72] opacity-0 blur-[1px]" : "scale-100 opacity-100 blur-0",
        )}
      >
        <Logo variant="reversed" height={30} alt="" priority />
      </span>
      <span
        aria-hidden="true"
        className={cx(
          "absolute left-0 top-1/2 -translate-y-1/2 transition-[opacity,transform] duration-[220ms] ease-standard",
          collapsed ? "scale-100 opacity-100 delay-[40ms]" : "pointer-events-none scale-50 opacity-0",
        )}
      >
        <Logo variant="mark" height={34} alt="" priority />
      </span>
    </span>
  );
}
