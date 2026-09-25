"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { IconTile } from "@/components/ui/Card";
import { cx } from "@/lib/cx";
import { moduleAccents, moduleLabelForPath, accentForPath, type ModuleAccent } from "@/lib/moduleTheme";

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Small context label above the title (e.g. module name). */
  eyebrow?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  icon?: LucideIcon;
  accent?: ModuleAccent;
  /** Back affordance rendered above the title (e.g. <BackButton />). */
  back?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, description, actions, eyebrow, breadcrumbs, icon, accent, back, meta, className }: PageHeaderProps) {
  const pathname = usePathname() ?? "/";
  // Pages that do not declare module context inherit it from their route.
  const resolvedAccent = accent ?? accentForPath(pathname);
  const resolvedEyebrow = eyebrow ?? moduleLabelForPath(pathname);
  return (
    <header className={cx("flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back && <div className="mb-3">{back}</div>}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-caption text-ink-muted">
              {breadcrumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3 w-3 text-ink-subtle" aria-hidden="true" />}
                  {crumb.href ? <Link href={crumb.href} className="font-medium hover:text-ink-strong">{crumb.label}</Link> : <span aria-current="page" className="font-medium text-ink">{crumb.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="flex items-start gap-4">
          {icon && <span className="hidden sm:block"><IconTile icon={icon} accent={resolvedAccent} size="lg" /></span>}
          <div className="min-w-0">
            {resolvedEyebrow && (
              <p className={cx("mb-1 flex items-center gap-2 text-caption font-semibold", moduleAccents[resolvedAccent].text)}>
                {!icon && <span aria-hidden="true" className={cx("h-1.5 w-1.5 rounded-full", moduleAccents[resolvedAccent].solid)} />}
                {resolvedEyebrow}
              </p>
            )}
            <h1 className="text-balance text-title font-semibold tracking-tight text-ink-strong">{title}</h1>
            {description && <p className="mt-1.5 max-w-2xl text-body text-ink-muted">{description}</p>}
            {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
          </div>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
