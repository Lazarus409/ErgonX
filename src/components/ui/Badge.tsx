import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cx } from "@/lib/cx";
import { moduleAccents, type ModuleAccent } from "@/lib/moduleTheme";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "brand" | "violet";

export const badgeTones: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success-ink ring-success/20",
  warning: "bg-warning-soft text-warning-ink ring-warning/25",
  danger: "bg-danger-soft text-danger-ink ring-danger/20",
  info: "bg-info-soft text-info-ink ring-info/20",
  neutral: "bg-neutral-soft text-neutral-ink ring-ink-subtle/20",
  brand: "bg-primary-soft text-primary-ink ring-primary/20",
  violet: "bg-mod-recruitment-soft text-mod-recruitment ring-mod-recruitment/20",
};

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** Module-accent badge; overrides `tone`. */
  accent?: ModuleAccent;
  icon?: LucideIcon;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}

export function Badge({ children, tone = "neutral", accent, icon: Icon, size = "md", className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset",
        size === "md" ? "px-2.5 py-0.5 text-caption leading-5" : "px-2 py-px text-[0.6875rem] leading-4",
        accent ? cx(moduleAccents[accent].soft, moduleAccents[accent].text, "ring-current/15") : badgeTones[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export default Badge;
