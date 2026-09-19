"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import {
  navigation,
  selfServiceNavigation,
} from "@/components/navigation/navigation";
import { useAuth } from "@/components/guards/AuthProvider";
import { hasModule } from "@/types/institutions";

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, institution } = useAuth();

  const hasAccess = (item: {
    module?: string;
    roles?: string[];
    permission?: string;
    excludedRoles?: string[];
    allowedRoles?: string[];
  }) => {
    if (item.allowedRoles && !item.allowedRoles.includes(user?.role ?? "")) {
      return false;
    }

    if (item.excludedRoles?.includes(user?.role ?? "")) {
      return false;
    }

    if (
      item.module &&
      !hasModule(institution?.enabledModules, item.module)
    ) {
      return false;
    }

    if (
      item.permission &&
      !user?.permissions.includes("*") &&
      !user?.permissions.includes(item.permission)
    ) {
      return false;
    }

    return true;
  };

  const visibleNavigation =
    navigation.filter(hasAccess);

  const visibleSelfService =
    selfServiceNavigation.filter(hasAccess);

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  };

  const closeMobile = () => {
    onMobileClose?.();
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex flex-col
          border-r border-slate-200
          bg-white
          transition-[width,transform] duration-200 ease-in-out
          lg:translate-x-0
          ${collapsed ? "lg:w-20" : "lg:w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          w-64
        `}
      >

        {/* HEADER */}
        <div
          className={`
            flex h-16 shrink-0 items-center
            border-b border-slate-200
            ${
              collapsed
                ? "justify-center px-2"
                : "justify-between px-4"
            }
          `}
        >
          <Link
            href="/"
            onClick={closeMobile}
            className="flex min-w-0 items-center"
          >
            {collapsed ? (
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
                <img
                  src="/ergonx-logo.png"
                  alt="ErgonX"
                  className="h-8 w-auto max-w-[36px] object-contain"
                />
              </div>
            ) : (
              <img
                src="/ergonx-logo.png"
                alt="ErgonX"
                className="h-9 w-auto object-contain"
              />
            )}
          </Link>

          {/* MOBILE CLOSE */}
          <button
            type="button"
            onClick={closeMobile}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>

          {/* DESKTOP COLLAPSE */}
          <button
            type="button"
            onClick={() =>
              onCollapsedChange(!collapsed)
            }
            className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:block"
            title={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            aria-label={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobile}
                  title={
                    collapsed
                      ? item.label
                      : undefined
                  }
                  className={`
                    group flex items-center rounded-lg
                    text-sm font-medium
                    transition-colors
                    ${
                      collapsed
                        ? "justify-center px-2 py-3"
                        : "gap-3 px-3 py-2.5"
                    }
                    ${
                      active
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }
                  `}
                >
                  <Icon
                    className={`
                      h-5 w-5 shrink-0
                      ${
                        active
                          ? "text-slate-900"
                          : "text-slate-500 group-hover:text-slate-700"
                      }
                    `}
                  />

                  {!collapsed && (
                    <span className="truncate">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* SELF SERVICE */}
          {visibleSelfService.length > 0 && (
            <div className="mt-8">
              {!collapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Self Service
                </p>
              )}

              <div className="space-y-1">
                {visibleSelfService.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobile}
                      title={
                        collapsed
                          ? item.label
                          : undefined
                      }
                      className={`
                        group flex items-center rounded-lg
                        text-sm font-medium
                        transition-colors
                        ${
                          collapsed
                            ? "justify-center px-2 py-3"
                            : "gap-3 px-3 py-2.5"
                        }
                        ${
                          active
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }
                      `}
                    >
                      <Icon className="h-5 w-5 shrink-0" />

                      {!collapsed && (
                        <span className="truncate">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* INSTITUTION */}
        <div className="shrink-0 border-t border-slate-200 p-3">
          <div
            className={`
              flex items-center rounded-lg bg-slate-50
              ${
                collapsed
                  ? "justify-center p-2"
                  : "gap-3 p-3"
              }
            `}
            title={
              collapsed
              ? institution?.name
                : undefined
            }
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
              <img
                src="/ergonx-logo.png"
                alt="ErgonX"
                className="h-7 w-auto object-contain"
              />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {institution?.name}
                </p>

                <p className="truncate text-xs text-slate-500">
                  {institution?.code}
                </p>
              </div>
            )}
          </div>
        </div>

      </aside>
    </>
  );
}
