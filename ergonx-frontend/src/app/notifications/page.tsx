"use client";

import {
  Bell,
  Briefcase,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
  FileBarChart,
  Landmark,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import AuthenticationGate from "@/components/guards/AuthenticationGate";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage, notificationsApi } from "@/lib/api";
import { cx } from "@/lib/cx";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import { accentForPath, moduleAccents, type ModuleAccent } from "@/lib/moduleTheme";
import { useApiResource } from "@/lib/useApiResource";
import type { AppNotification } from "@/types/notifications";

const accentIcons: Record<ModuleAccent, LucideIcon> = {
  hr: Users,
  recruitment: Briefcase,
  leave: CalendarDays,
  attendance: Clock3,
  payroll: Wallet,
  accounting: Landmark,
  reports: FileBarChart,
  audit: ShieldCheck,
  settings: Settings,
  brand: Bell,
};

const accentChipLabels: Record<ModuleAccent, string | null> = {
  hr: "HR",
  recruitment: "Recruitment",
  leave: "Leave",
  attendance: "Attendance",
  payroll: "Payroll",
  accounting: "Accounting",
  reports: "Reports",
  audit: "Audit",
  settings: "Settings",
  brand: null,
};

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Presentation-only grouping of the (already ordered) list into Today / Yesterday / dated days. */
function groupByDay(items: AppNotification[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const groups: Array<{ key: string; label: string; date?: string; items: AppNotification[] }> = [];
  for (const item of items) {
    const created = new Date(item.created_at);
    const key = Number.isNaN(created.getTime()) ? "unknown" : dayKey(created);
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      const long = Number.isNaN(created.getTime()) ? "" : created.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      const label = key === dayKey(today) ? "Today" : key === dayKey(yesterday) ? "Yesterday" : long || "Earlier";
      group = { key, label, date: label === "Today" || label === "Yesterday" ? long : undefined, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const load = useCallback(() => notificationsApi.getNotifications(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const unread = data?.filter((item) => !item.is_read).length ?? 0;

  const markAllRead = async () => {
    setMarkingAll(true); setActionError(null);
    try { await notificationsApi.markAllNotificationsRead(); await reload(); }
    catch (caught) { setActionError(getApiErrorMessage(caught)); }
    finally { setMarkingAll(false); }
  };

  return (
    <AuthenticationGate>
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-6">
          <PageHeader
            eyebrow="Inbox"
            title="Notifications"
            description="Stay informed across ErgonX. Updates delivered to you for the active institution."
            icon={Bell}
            accent="brand"
            actions={<Button variant="secondary" disabled={!unread} loading={markingAll} loadingLabel="Marking…" leadingIcon={<CheckCheck className="h-4 w-4" />} onClick={markAllRead}>Mark all read</Button>}
          />
          {(error || actionError) && <ErrorState variant="inline" title="Unable to update notifications" message={error ?? actionError ?? ""} onRetry={reload} />}
          {loading && <div className="space-y-3" aria-label="Loading notifications">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-20 rounded-2xl" />)}</div>}
          {!loading && data?.length === 0 && <EmptyState icon={CheckCheck} accent="leave" title="You are all caught up" description="New workflow and compliance updates will appear here." />}
          {!loading && data && data.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-elevation-1" aria-label="Notifications">
              <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5 text-support">
                <span className="font-semibold text-headline">All notifications</span>
                <span className="text-ink-muted">{unread ? `${unread} unread update${unread === 1 ? "" : "s"}` : "All notifications read"}</span>
              </div>
              {groupByDay(data).map((group) => (
                <div key={group.key}>
                  <h2 className="flex items-baseline gap-2 border-b border-line-soft bg-surface-muted/50 px-5 py-2.5"><span className="font-bold text-headline">{group.label}</span>{group.date && <span className="text-support text-ink-muted">{group.date}</span>}</h2>
                  <ul className="divide-y divide-line-soft">
                    {group.items.map((item) => {
                      const accent = accentForPath(item.route_hint ?? "");
                      const Icon = accentIcons[accent];
                      const moduleLabel = accentChipLabels[accent] ?? humanizeEnum(item.notification_type);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={async () => { try { if (!item.is_read) await notificationsApi.markNotificationRead(item.id); if (item.route_hint) router.push(item.route_hint); else await reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); } }}
                            className={cx("group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-hover sm:gap-4 sm:px-5", !item.is_read && "bg-primary-soft/40")}
                          >
                            <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", item.is_read ? "bg-transparent" : "bg-primary")} aria-label={item.is_read ? "Read" : "Unread"} />
                            <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", moduleAccents[accent].tile)} aria-hidden="true"><Icon className="h-5 w-5" /></span>
                            <span className="hidden w-28 shrink-0 sm:block"><span className="inline-flex max-w-full truncate rounded-full bg-surface-muted px-2.5 py-1 text-caption font-medium text-ink">{moduleLabel}</span></span>
                            <span className="min-w-0 flex-1">
                              <span className={cx("block text-headline", item.is_read ? "font-semibold" : "font-bold")}>{item.title}</span>
                              <span className="mt-0.5 block text-support text-ink-muted">{item.message}</span>
                            </span>
                            <time className="shrink-0 text-caption text-ink-muted" dateTime={item.created_at} title={formatDateTime(item.created_at)}>{formatTime(item.created_at)}</time>
                            <ChevronRight className={cx("h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5", !item.route_hint && "invisible")} aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </div>
      </AppShell>
    </AuthenticationGate>
  );
}
