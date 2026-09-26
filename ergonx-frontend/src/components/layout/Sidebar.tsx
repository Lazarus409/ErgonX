"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useState } from "react";

import Logo from "@/components/brand/Logo";
import SidebarLogo from "@/components/brand/SidebarLogo";
import { canAccess, navigation, selfServiceNavigation, type NavigationItem } from "@/components/navigation/navigation";
import { SELF_SERVICE_PERMISSIONS } from "@/lib/access";
import { useAuth } from "@/components/guards/AuthProvider";
import { hasModule } from "@/types/institutions";
import { cx } from "@/lib/cx";
import { imageContentUrl } from "@/lib/api/images";
import { accentForPath, moduleAccents } from "@/lib/moduleTheme";

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

/**
 * Primary navigation. Visibility is derived exclusively from the navigation
 * registry plus enabled modules, effective permissions and self-service
 * eligibility. Visibility is never authorization: every route and endpoint
 * enforces its own gate.
 */
export default function Sidebar({ collapsed, onCollapsedChange, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, institution } = useAuth();
  const permissions = user?.permissions ?? [];
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const hasPermission = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const context = { can: hasPermission, moduleEnabled: (module: string) => hasModule(institution?.enabledModules, module), scope: user?.dataScope ?? "INSTITUTION" } as const;
  const hasAccess = (item: NavigationItem) => {
    const selfServiceEligible = SELF_SERVICE_PERMISSIONS.some(hasPermission);
    if (item.selfService && !selfServiceEligible) return false;
    return canAccess(item, context);
  };

  const visibleNavigation = navigation.filter(hasAccess);
  const visibleSelfService = selfServiceNavigation.filter(hasAccess);

  const matches = (href: string) => {
    if (href === "/" || href === "/dashboard" || href === "/me") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  // Only the most specific matching destination is active, so /settings/users
  // highlights "Users & Access" rather than also highlighting "Settings".
  const allHrefs = [...navigation, ...selfServiceNavigation].flatMap((item) => [item.href, ...(item.children?.map((child) => child.href) ?? [])]);
  const activeHref = allHrefs.filter(matches).sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;
  const rootOf = (href: string) => `/${href.split("/")[1] ?? ""}`;
  // A child living under another module root (HR › Leave) owns that root.
  const childActive = (parentHref: string, childHref: string) =>
    isActive(childHref) || (rootOf(childHref) !== rootOf(parentHref) && matches(rootOf(childHref)));

  const childrenFor = (item: NavigationItem) =>
    item.children?.filter((child) => (!child.module || hasModule(institution?.enabledModules, child.module)) && (!child.permission || hasPermission(child.permission))) ?? [];

  const closeMobile = () => onMobileClose?.();

  // In the mobile drawer the sidebar is always rendered expanded.
  const renderPanel = (compact: boolean, mobile: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cx("flex h-14 shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-white/[0.07]", compact ? "px-[18px]" : "pl-[18px] pr-2.5")}>
        <Link href="/" onClick={closeMobile} className="min-w-0 rounded-lg focus-visible:outline-offset-4" aria-label="ErgonX home">
          <SidebarLogo collapsed={compact} />
        </Link>
        {mobile ? (
          <button type="button" onClick={closeMobile} className="rounded-xl p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        ) : (
          !compact && (
            <button type="button" onClick={() => onCollapsedChange(true)} className="rounded-xl p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label="Collapse sidebar" title="Collapse sidebar">
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </button>
          )
        )}
      </div>

      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-color:rgb(255_255_255/0.18)_transparent]">
        <ul className="space-y-0.5">
          {visibleNavigation.map((item) => {
            const childItems = childrenFor(item);
            const groupActive = isActive(item.href) || childItems.some((child) => childActive(item.href, child.href));
            const expanded = toggled[item.href] ?? groupActive;
            return (
              <li key={item.href}>
                <NavRow item={item} active={isActive(item.href)} groupActive={groupActive} compact={compact} onNavigate={closeMobile}
                  expander={!compact && childItems.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setToggled((current) => ({ ...current, [item.href]: !expanded }))}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "Collapse" : "Expand"} ${item.label}`}
                      className="mr-1 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <ChevronDown className={cx("h-4 w-4 transition-transform duration-200 ease-standard", expanded && "rotate-180")} />
                    </button>
                  ) : undefined}
                />
                {!compact && childItems.length > 0 && (
                  <div className={cx("grid transition-[grid-template-rows] duration-200 ease-standard", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <ul className="overflow-hidden" aria-label={`${item.label} sections`}>
                      <li className="relative ml-[22px] mt-1 space-y-0.5 border-l border-white/10 pb-1 pl-3">
                        {childItems.map((child) => {
                          const active = childActive(item.href, child.href);
                          const accent = moduleAccents[accentForPath(child.href)];
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={closeMobile}
                              tabIndex={expanded ? undefined : -1}
                              aria-current={active ? "page" : undefined}
                              className={cx(
                                "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-support font-medium transition-colors duration-150",
                                active ? "bg-white/[0.09] text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white",
                              )}
                            >
                              <span aria-hidden="true" className={cx("h-1.5 w-1.5 shrink-0 rounded-full", active ? accent.solid : "bg-white/25")} />
                              <span className="truncate">{child.label}</span>
                            </Link>
                          );
                        })}
                      </li>
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {visibleSelfService.length > 0 && (
          <div className="mt-7">
            {compact ? (
              <div className="mx-auto mb-3 h-px w-8 bg-white/10" aria-hidden="true" />
            ) : (
              <p className="mb-2 px-3 text-caption font-semibold text-white/40">My workspace</p>
            )}
            <ul className="space-y-1">
              {visibleSelfService.map((item) => (
                <li key={item.href}>
                  <NavRow item={item} active={isActive(item.href)} groupActive={isActive(item.href)} compact={compact} onNavigate={closeMobile} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-white/[0.07] p-3">
        {compact && !mobile && (
          <button type="button" onClick={() => onCollapsedChange(false)} className="mb-2 flex h-9 w-full items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label="Expand sidebar" title="Expand sidebar">
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>
        )}
        <InstitutionPanel
          compact={compact}
          name={institution?.name ?? "No active institution"}
          code={institution?.code}
          logoSrc={institution?.logoImageId ? imageContentUrl(institution.logoImageId) : null}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        data-shell-chrome
        className={cx(
          "fixed inset-y-0 left-0 z-40 hidden bg-brand-navy text-white shadow-[inset_-1px_0_0_rgb(255_255_255/0.04)] transition-[width] duration-[220ms] ease-standard dark:bg-brand-navy-deep lg:block",
          collapsed ? "w-[var(--shell-sidebar-collapsed)]" : "w-[var(--shell-sidebar-expanded)]",
        )}
      >
        {renderPanel(collapsed, false)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" data-shell-chrome>
          <button type="button" aria-label="Close navigation" onClick={closeMobile} className="absolute inset-0 animate-fade-in bg-overlay" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative h-full w-[min(86vw,var(--shell-sidebar-expanded))] bg-brand-navy text-white shadow-overlay dark:bg-brand-navy-deep"
            style={{ animation: "drawer-in-left var(--duration-emphasis) var(--ease-standard) both" }}
          >
            {renderPanel(false, true)}
          </aside>
        </div>
      )}
    </>
  );
}

function NavRow({ item, active, groupActive, compact, onNavigate, expander }: { item: NavigationItem; active: boolean; groupActive: boolean; compact: boolean; onNavigate: () => void; expander?: React.ReactNode }) {
  const Icon = item.icon;
  const accent = moduleAccents[accentForPath(item.href)];
  return (
    <div className={cx("group/nav relative flex items-center rounded-lg transition-colors duration-150", groupActive ? "bg-white/[0.08]" : "hover:bg-white/[0.05]")}>
      {groupActive && <span aria-hidden="true" className="bg-signature absolute -left-3 top-2 bottom-2 w-[2px] rounded-r-full" />}
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        aria-label={compact ? item.label : undefined}
        className={cx("flex min-w-0 flex-1 items-center rounded-lg text-sm font-medium", compact ? "h-10 justify-center" : "h-9 gap-2.5 px-2.5", groupActive ? "text-white" : "text-white/70 group-hover/nav:text-white")}
      >
        <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors", groupActive ? cx(accent.solid, "text-white") : "text-white/65 group-hover/nav:text-white")}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {!compact && <span className="truncate">{item.label}</span>}
      </Link>
      {expander}
      {compact && (
        <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+14px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-brand-navy-deep px-2.5 py-1.5 text-caption font-semibold text-white opacity-0 shadow-elevation-3 ring-1 ring-white/10 transition-opacity duration-150 group-hover/nav:opacity-100 group-focus-within/nav:opacity-100">
          {item.label}
        </span>
      )}
    </div>
  );
}

/**
 * Tenant context panel. The institution's uploaded logo (or a monogram) is
 * the tenant identity here; a subtle "on ErgonX" attribution accompanies an
 * uploaded logo. The header above always keeps the ErgonX brand.
 */
function InstitutionPanel({ compact, name, code, logoSrc }: { compact: boolean; name: string; code?: string | null; logoSrc: string | null }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "E";
  return (
    <div className={cx("flex items-center rounded-lg bg-white/[0.05]", compact ? "justify-center p-1.5" : "gap-3 p-2")} title={compact ? name : undefined}>
      {logoSrc ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" className="h-full w-full object-contain" />
        </span>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-accent-aqua/80 via-accent-blue to-accent-violet text-caption font-bold text-white" aria-hidden="true">
          {initials}
        </span>
      )}
      {!compact && (
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-support font-semibold text-white">{name}</p>
          {logoSrc ? (
            <p className="flex items-center gap-1 text-caption text-white/50">
              {code && <span className="truncate">{code} ·</span>}
              <span className="inline-flex shrink-0 items-center gap-1">on <Logo variant="mono-white" height={9} alt="ErgonX" className="opacity-75" /></span>
            </p>
          ) : (
            code && <p className="truncate text-caption text-white/50">{code}</p>
          )}
        </div>
      )}
    </div>
  );
}
