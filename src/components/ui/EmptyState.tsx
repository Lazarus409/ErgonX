import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";

import { cx } from "@/lib/cx";
import { moduleAccents, type ModuleAccent } from "@/lib/moduleTheme";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  accent?: ModuleAccent;
  /** `compact` for use inside cards and tables. */
  size?: "default" | "compact";
  className?: string;
}

export default function EmptyState({ title, description, action, icon: Icon = Inbox, accent = "brand", size = "default", className }: EmptyStateProps) {
  const compact = size === "compact";
  return (
    <div className={cx("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12", className)}>
      <span className={cx("relative inline-flex items-center justify-center rounded-2xl", compact ? "h-11 w-11" : "h-14 w-14", moduleAccents[accent].tile)} aria-hidden="true">
        <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </span>
      <h3 className={cx("font-semibold text-ink-strong", compact ? "mt-3 text-sm" : "mt-4 text-card-title")}>{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-support text-ink-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export { EmptyState };
