"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Menu,
  Search,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { getApiErrorMessage, institutionsApi, notificationsApi, searchApi } from "@/lib/api";
import type { AppNotification } from "@/types/notifications";
import type { SearchResult } from "@/types/search";
import type { InstitutionMembership } from "@/types/institutions";
import { useAuth } from "@/components/guards/AuthProvider";
import { useTheme } from "@/components/context/ThemeProvider";


interface TopBarProps {
  onOpenSidebar?: () => void;
}

export default function TopBar({
  onOpenSidebar,
}: TopBarProps) {
  const router = useRouter();
  const { institution, logout, switchInstitution, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] =
    useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<InstitutionMembership[]>([]);
  const [switchingInstitutionId, setSwitchingInstitutionId] = useState<string | null>(null);
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  };

  const navigateFromProfile = (path: string) => {
    setProfileOpen(false);
    router.push(path);
  };

  const handleSignOut = () => {
    if (signingOut) return;
    setSigningOut(true);
    setProfileOpen(false);
    logout();
    router.replace("/login");
  };

  useEffect(() => {
    const query = searchQuery.trim();
    if (!searchOpen || query.length < 2) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);
      searchApi.universalSearch({ query })
        .then((response) => {
          if (active) setSearchResults(response.results);
        })
        .catch((caught) => {
          if (active) {
            setSearchResults([]);
            setSearchError(getApiErrorMessage(caught));
          }
        })
        .finally(() => {
          if (active) setSearchLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchQuery]);

  useEffect(() => {
    if (!notificationsOpen) return;

    let active = true;
    notificationsApi.getNotifications({ unread: true })
      .then((items) => {
        if (!active) return;
        setNotifications(items.slice(0, 5));
        setUnreadNotificationCount(items.length);
      })
      .catch((caught) => {
        if (active) setNotificationsError(getApiErrorMessage(caught));
      })
      .finally(() => {
        if (active) setNotificationsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    let active = true;
    institutionsApi.getMyMemberships()
      .then((items) => { if (active) setMemberships(items.filter((item) => item.status === "ACTIVE")); })
      .catch(() => { if (active) setMemberships([]); });
    return () => { active = false; };
  }, [profileOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (event.key === "Escape") closeSearch();
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-topbar-popover]")) {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
      if (!target.closest("[data-search-popover], [data-search-trigger]")) closeSearch();
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, []);

  const markNotificationRead = async (notification: AppNotification) => {
    if (notification.is_read) return;
    try {
      const updated = await notificationsApi.markNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setUnreadNotificationCount((current) => Math.max(0, current - 1));
      window.dispatchEvent(new CustomEvent("ergonx:toast", { detail: { title: "Notification updated", message: "Notification marked as read.", tone: "success" } }));
    } catch (caught) {
      setNotificationsError(getApiErrorMessage(caught));
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await notificationsApi.markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true, status: "READ" })));
      setUnreadNotificationCount(0);
    } catch (caught) {
      setNotificationsError(getApiErrorMessage(caught));
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-800 bg-slate-950/95 text-slate-100 backdrop-blur">
      <div className="relative flex h-full items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <button
          onClick={onOpenSidebar}
          className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 items-center gap-3 sm:flex">
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200 dark:ring-slate-600">
              <Image
                src="/ergonx-logo.png"
                alt="ErgonX"
                width={28}
                height={28}
                className="h-full w-full object-contain p-1"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {institution?.name ?? "No active institution"}
              </p>

              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Active Institution
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {searchOpen ? (
          <div data-search-popover className="absolute left-1/2 flex h-11 w-[min(42vw,560px)] -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 shadow-lg sm:w-[min(48vw,620px)]" onClick={(event) => event.stopPropagation()}>
            <Search className="h-4 w-4 shrink-0 text-slate-400" />

              <input
                ref={searchInputRef}
              autoFocus
              placeholder="Search employees, payroll, leave..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />

            <button
              onClick={closeSearch}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>

            {(searchQuery.trim().length >= 2 || searchLoading || searchError) && (
              <div className="absolute left-0 top-14 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                {searchLoading && <p className="px-4 py-3 text-sm text-slate-400">Searching…</p>}
                {searchError && <p className="px-4 py-3 text-sm text-red-300">{searchError}</p>}
                {!searchLoading && !searchError && searchResults.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-400">No results found.</p>
                )}
                {!searchLoading && searchResults.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    type="button"
                    onClick={() => {
                      router.push(result.route_hint);
                      closeSearch();
                    }}
                    className="flex w-full items-center gap-3 border-b border-slate-800 px-4 py-3 text-left last:border-0 hover:bg-slate-800"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[10px] font-semibold text-slate-300">
                      {result.type.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{result.title}</span>
                      <span className="block truncate text-xs text-slate-400">{result.subtitle || result.reference || result.module}</span>
                    </span>
                    <span className="shrink-0 text-[10px] font-medium text-slate-500">{result.status.replaceAll("_", " ")}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={(event) => {
              event.stopPropagation();
              setSearchOpen(true);
            }}
            data-search-trigger
            className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            title="Search"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        )}

        <span
          className="hidden rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white sm:block"
          title="Help and support is not configured for this release."
          aria-label="Help and support is not configured for this release"
        >
          <CircleHelp className="h-5 w-5" />
        </span>

        <div className="relative" data-topbar-popover onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              const opening = !notificationsOpen;
              if (opening) {
                setNotificationsLoading(true);
                setNotificationsError(null);
              }
              setNotificationsOpen(opening);
              setProfileOpen(false);
            }}
            className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />

            {unreadNotificationCount > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-12 w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Notifications
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Updates for your active institution
                  </p>
                </div>

                <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">
                  {unreadNotificationCount}
                </span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {notificationsLoading && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Loading notifications…</p>}
                {notificationsError && <p className="p-4 text-sm text-red-600 dark:text-red-300">{notificationsError}</p>}
                {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                  <p className="p-4 text-sm text-slate-500 dark:text-slate-400">You have no notifications.</p>
                )}
                {!notificationsLoading && !notificationsError && notifications.map((notification) => (
                  <button key={notification.id} type="button" onClick={async () => { await markNotificationRead(notification); if (notification.route_hint) { setNotificationsOpen(false); router.push(notification.route_hint); } }} className={`block w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 ${notification.is_read ? "" : "bg-sky-50/70 dark:bg-sky-950/20"}`} aria-label={`Open ${notification.title}`}>
                    <div className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.is_read ? "bg-slate-300" : "bg-sky-500"}`} aria-hidden="true" /><span><p className="text-sm font-medium text-slate-900 dark:text-white">{notification.title}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{notification.message}</p></span></div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 p-3 text-xs dark:border-slate-700"><button type="button" onClick={markAllNotificationsRead} disabled={!unreadNotificationCount} className="font-medium text-sky-700 hover:text-sky-900 disabled:text-slate-400 dark:text-sky-300">Mark all read</button><button type="button" onClick={() => { setNotificationsOpen(false); router.push("/notifications"); }} className="font-medium text-sky-700 hover:text-sky-900 dark:text-sky-300">View all</button></div>
            </div>
          )}
        </div>

        <div className="relative" data-topbar-popover onClick={(event) => event.stopPropagation()}>
          <button
            onClick={() => {
              setProfileOpen(
                (current) => !current,
              );
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open profile menu"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200 dark:ring-slate-600">
              <Image
                src="/ergonx-logo.png"
                alt="ErgonX"
                width={32}
                height={32}
                className="h-full w-full object-contain p-1"
              />
            </div>

            <div className="hidden text-left xl:block">
              <p className="text-xs font-semibold text-white">
                {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "ErgonX user"}
              </p>

              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {user?.role?.replaceAll("_", " ") ?? ""}
              </p>
            </div>

            <ChevronDown className="hidden h-4 w-4 text-slate-400 xl:block" />
          </button>

          {profileOpen && (
            <div role="menu" aria-label="Profile menu" className="absolute right-0 top-12 z-50 w-[330px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-200 dark:ring-slate-600">
                    <Image
                      src="/ergonx-logo.png"
                      alt="ErgonX"
                      width={40}
                      height={40}
                      className="h-full w-full object-contain p-1"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "ErgonX user"}
                    </p>

                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {user?.email ?? ""}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 p-2 dark:border-slate-700">
                <button type="button" role="menuitem" onClick={() => navigateFromProfile("/me/profile")} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">My Profile</button>
                <button type="button" role="menuitem" onClick={() => navigateFromProfile("/settings/profile")} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">Personal Preferences</button>
                <button type="button" role="menuitem" onClick={() => navigateFromProfile("/settings/security")} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">Security</button>
              </div>
              {memberships.length > 1 && <div className="border-t border-slate-200 p-2 dark:border-slate-700"><p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Switch institution</p>{memberships.map((membership) => <button key={membership.id} type="button" disabled={membership.institution.id === institution?.id || switchingInstitutionId !== null} onClick={async () => { setSwitchingInstitutionId(membership.institution.id); try { await switchInstitution(membership.institution.id); setProfileOpen(false); router.replace("/"); router.refresh(); } finally { setSwitchingInstitutionId(null); } }} className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-700"><span className="truncate">{membership.institution.name}</span><span className="shrink-0 text-xs text-slate-400">{membership.institution.id === institution?.id ? "Active" : switchingInstitutionId === membership.institution.id ? "Switching…" : "Switch"}</span></button>)}</div>}
              <div className="border-t border-slate-200 p-2 dark:border-slate-700">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-red-950/30"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          )}
        </div>

        <button type="button" onClick={toggleTheme} className="rounded-xl p-2.5 text-slate-300 hover:bg-slate-800 hover:text-white" title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
}
