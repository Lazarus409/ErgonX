"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronsLeft, PanelLeftOpen, X } from "lucide-react";
import { useState } from "react";

import Logo from "@/components/brand/Logo";
import SidebarLogo from "@/components/brand/SidebarLogo";
import { canAccess, navigation, selfServiceNavigation, type NavigationItem } from "@/components/navigation/navigation";
import { SELF_SERVICE_PERMISSIONS } from "@/lib/access";
import { useAuth } from "@/components/guards/AuthProvider";
import { hasModule } from "@/types/institutions";
import { cx } from "@/lib/cx";
import { imageContentUrl } from "@/lib/api/images";

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
const SELF_SERVICE_GROUP = "self-service";

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

  const selfServiceHome = visibleSelfService.find((item) => item.href === "/me");
  const selfServicePages = visibleSelfService.filter((item) => item.href !== "/me");
  const selfServiceActive = visibleSelfService.some((item) => isActive(item.href));
  const selfServiceExpanded = toggled[SELF_SERVICE_GROUP] ?? selfServiceActive;

  const childrenFor = (item: NavigationItem) =>
    item.children?.filter((child) => (!child.module || hasModule(institution?.enabledModules, child.module)) && (!child.permission || hasPermission(child.permission))) ?? [];

  const closeMobile = () => onMobileClose?.();

  // In the mobile drawer the sidebar is always rendered expanded.
  const renderPanel = (compact: boolean, mobile: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cx("flex h-[5.25rem] shrink-0 items-center justify-between gap-2 overflow-hidden", compact ? "px-[18px]" : "pl-7 pr-3")}>
        <Link href="/" onClick={closeMobile} className="min-w-0 rounded-lg focus-visible:outline-offset-4" aria-label="ErgonX home">
          <SidebarLogo collapsed={compact} />
        </Link>
        {mobile && (
          <button type="button" onClick={closeMobile} className="rounded-xl p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Concept: the active institution sits directly under the ErgonX brand. */}
      <div className={cx("shrink-0 pb-3", compact ? "px-3" : "px-4")}>
        <InstitutionPanel
          compact={compact}
          name={institution?.name ?? "No active institution"}
          code={institution?.code}
          logoSrc={institution?.logoImageId ? imageContentUrl(institution.logoImageId) : null}
        />
      </div>

      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 [scrollbar-color:rgb(255_255_255/0.18)_transparent]">
        <ul className="space-y-1">
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
                      <li className="relative ml-3 mt-1 space-y-0.5 pb-1">
                        {childItems.map((child) => {
                          const active = childActive(item.href, child.href);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={closeMobile}
                              tabIndex={expanded ? undefined : -1}
                              aria-current={active ? "page" : undefined}
                              className={cx(
                                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                                active ? "bg-primary/25 text-white" : "text-white/75 hover:bg-white/[0.05] hover:text-white",
                              )}
                            >
                              <span aria-hidden="true" className={cx("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-accent-sky" : "bg-white/70")} />
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
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            {compact ? (
              <>
                <div className="mx-auto mb-3 h-px w-8 bg-white/10" aria-hidden="true" />
                <ul className="space-y-1">
                  {visibleSelfService.map((item) => (
                    <li key={item.href}>
                      <NavRow item={item} active={isActive(item.href)} groupActive={isActive(item.href)} compact={compact} onNavigate={closeMobile} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              // One "My workspace" entry: the header opens Employee Home and the
              // chevron lists the personal pages, like the module groups above.
              <ul>
                <li>
                  <NavRow
                    item={{ ...(selfServiceHome ?? visibleSelfService[0]), label: "My workspace" }}
                    active={selfServiceHome ? isActive(selfServiceHome.href) : false}
                    groupActive={selfServiceActive}
                    compact={false}
                    onNavigate={closeMobile}
                    expander={selfServicePages.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setToggled((current) => ({ ...current, [SELF_SERVICE_GROUP]: !selfServiceExpanded }))}
                        aria-expanded={selfServiceExpanded}
                        aria-label={`${selfServiceExpanded ? "Collapse" : "Expand"} My workspace`}
                        className="mr-1 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <ChevronDown className={cx("h-4 w-4 transition-transform duration-200 ease-standard", selfServiceExpanded && "rotate-180")} />
                      </button>
                    ) : undefined}
                  />
                  {selfServicePages.length > 0 && (
                    <div className={cx("grid transition-[grid-template-rows] duration-200 ease-standard", selfServiceExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                      <ul className="overflow-hidden" aria-label="My workspace pages">
                        <li className="relative ml-3 mt-1 space-y-0.5 pb-1">
                          {selfServicePages.map((page) => {
                            const active = isActive(page.href);
                            return (
                              <Link
                                key={page.href}
                                href={page.href}
                                onClick={closeMobile}
                                tabIndex={selfServiceExpanded ? undefined : -1}
                                aria-current={active ? "page" : undefined}
                                className={cx(
                                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                                  active ? "bg-primary/25 text-white" : "text-white/75 hover:bg-white/[0.05] hover:text-white",
                                )}
                              >
                                <span aria-hidden="true" className={cx("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-accent-sky" : "bg-white/70")} />
                                <span className="truncate">{page.label}</span>
                              </Link>
                            );
                          })}
                        </li>
                      </ul>
                    </div>
                  )}
                </li>
              </ul>
            )}
          </div>
        )}
      </nav>

      {!mobile && (
        <div className="shrink-0 border-t border-white/[0.08] p-3">
          <button
            type="button"
            onClick={() => onCollapsedChange(!compact)}
            className={cx("flex h-10 w-full items-center gap-3 rounded-lg text-support font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white", compact ? "justify-center" : "px-3")}
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            title={compact ? "Expand sidebar" : "Collapse sidebar"}
          >
            {compact ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-5 w-5" />}
            {!compact && <span>Collapse sidebar</span>}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        data-shell-chrome
        className={cx(
          "fixed inset-y-0 left-0 z-40 hidden bg-sidebar bg-[linear-gradient(180deg,var(--sidebar)_0%,var(--sidebar-deep)_100%)] text-white shadow-[inset_-1px_0_0_rgb(255_255_255/0.04)] transition-[width] duration-[220ms] ease-standard lg:block",
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
            className="relative h-full w-[min(86vw,var(--shell-sidebar-expanded))] bg-sidebar bg-[linear-gradient(180deg,var(--sidebar)_0%,var(--sidebar-deep)_100%)] text-white shadow-overlay"
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
  // Concept: plain white icons; the active area gets a lifted row and a bright blue edge.
  return (
    <div className={cx("group/nav relative flex items-center rounded-lg transition-colors duration-150", groupActive ? "bg-white/[0.09]" : "hover:bg-white/[0.05]")}>
      {groupActive && <span aria-hidden="true" className="absolute -left-3 top-1.5 bottom-1.5 w-1 rounded-r-full bg-accent-sky" />}
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        aria-label={compact ? item.label : undefined}
        className={cx("flex min-w-0 flex-1 items-center rounded-lg text-[0.9375rem] font-medium", compact ? "h-11 justify-center" : "h-11 gap-3.5 px-3", groupActive ? "text-white" : "text-white/80 group-hover/nav:text-white")}
      >
        <Icon className={cx("h-5 w-5 shrink-0", groupActive ? "text-white" : "text-white/80 group-hover/nav:text-white")} aria-hidden="true" />
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
    <div className={cx("flex items-center rounded-xl border border-white/[0.12] bg-white/[0.04]", compact ? "justify-center p-1.5" : "gap-3 px-3 py-2.5")} title={compact ? name : undefined}>
      {logoSrc ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" className="h-full w-full object-contain" />
        </span>
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-caption font-bold text-white" aria-hidden="true">
          {initials}
        </span>
      )}
      {!compact && (
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[0.6875rem] font-medium text-white/55">Active institution</p>
          <p className="mt-0.5 truncate text-support font-semibold text-white">{name}</p>
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
