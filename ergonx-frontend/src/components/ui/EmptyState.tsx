import type { ReactNode } from "react";
import { Inbox, Search, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TechnicalDetails } from "@/components/ui/StateBanner";

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
  /** Shown in a collapsed "Technical details" disclosure. */
  details?: ReactNode;
  className?: string;
}

export default function EmptyState({ title, description, action, icon: Icon = Inbox, accent = "brand", size = "default", details, className }: EmptyStateProps) {
  const compact = size === "compact";
  return (
    <div className={cx("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "rounded-2xl border border-line bg-surface px-6 py-14", className)}>
      {/* Concept governed empty state: soft circular halo around the icon. */}
      <span className={cx("relative inline-flex items-center justify-center rounded-full ring-8 ring-primary-soft/50", compact ? "h-14 w-14" : "h-20 w-20", moduleAccents[accent].tile)} aria-hidden="true">
        <Icon className={compact ? "h-6 w-6" : "h-8 w-8"} />
      </span>
      <h3 className={cx("font-bold text-ink-strong", compact ? "mt-4 text-[0.9375rem]" : "mt-5 text-card-title")}>{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-support text-ink-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
      {details && <TechnicalDetails>{details}</TechnicalDetails>}
    </div>
  );
}

/** Successful zero-result state: the query ran, nothing matched. */
export function NoResultsState({ noun = "records", query, onClear, clearLabel = "Clear filters", size, className }: { noun?: string; query?: string; onClear?: () => void; clearLabel?: string; size?: "default" | "compact"; className?: string }) {
  return (
    <EmptyState
      icon={Search}
      accent="attendance"
      size={size}
      className={className}
      title="No matching results"
      description={<>{query ? <>We couldn&apos;t find any {noun} matching &ldquo;{query}&rdquo;.</> : <>We couldn&apos;t find any {noun} matching your criteria.</>} Try adjusting your search or filters.</>}
      action={onClear ? <Button variant="secondary" onClick={onClear}>{clearLabel}</Button> : undefined}
    />
  );
}

export { EmptyState };
