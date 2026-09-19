"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Menu,
  Search,
  UserCircle,
  X,
} from "lucide-react";
import { getApiErrorMessage, searchApi } from "@/lib/api";
import type { SearchResult } from "@/types/search";
import { useAuth } from "@/components/guards/AuthProvider";


interface TopBarProps {
  onOpenSidebar?: () => void;
}

export default function TopBar({
  onOpenSidebar,
}: TopBarProps) {
  const router = useRouter();
  const { institution } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] =
    useState(false);

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

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
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
          <div className="absolute left-1/2 flex h-11 w-[min(42vw,560px)] -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 shadow-lg sm:w-[min(48vw,620px)]">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />

            <input
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
            onClick={() => setSearchOpen(true)}
            className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            title="Search"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        )}

        <button
          className="hidden rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white sm:block"
          title="Help & Support"
          aria-label="Help and Support"
        >
          <CircleHelp className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen(
                (current) => !current,
              );
              setProfileOpen(false);
            }}
            className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-12 w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Notifications
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Actions requiring attention
                  </p>
                </div>

                <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">
                  3
                </span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Payroll requires review
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    August 2026 payroll is awaiting review.
                  </p>
                </div>

                <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Leave request pending
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    A leave request requires your attention.
                  </p>
                </div>

                <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Attendance adjustment
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    An attendance adjustment is awaiting review.
                  </p>
                </div>
              </div>

              <button className="w-full border-t border-slate-200 p-3 text-center text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
                View all notifications
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => {
              setProfileOpen(
                (current) => !current,
              );
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open profile menu"
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
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                ErgonX Administrator
              </p>

              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Institution Admin
              </p>
            </div>

            <ChevronDown className="hidden h-4 w-4 text-slate-400 xl:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 w-[330px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
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
                      ErgonX Administrator
                    </p>

                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      admin@ergonx.local
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4">
</div>

              <div className="border-t border-slate-200 p-2 dark:border-slate-700">
                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
                  <UserCircle className="h-4 w-4" />
                  My Profile
                </button>

                <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
                  <CircleHelp className="h-4 w-4" />
                  Help & Support
                </button>
              </div>

              <div className="border-t border-slate-200 p-2 dark:border-slate-700">
                <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
