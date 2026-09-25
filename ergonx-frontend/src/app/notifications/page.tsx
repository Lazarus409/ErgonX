"use client";

import { ArrowRight, Bell, CheckCheck } from "lucide-react";
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
import { formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

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
        <div className="mx-auto max-w-4xl space-y-6">
          <PageHeader
            eyebrow="Inbox"
            title="Notifications"
            description="Updates delivered to you for the active institution."
            icon={Bell}
            accent="brand"
            actions={<Button variant="secondary" disabled={!unread} loading={markingAll} loadingLabel="Marking…" leadingIcon={<CheckCheck className="h-4 w-4" />} onClick={markAllRead}>Mark all read</Button>}
          />
          {(error || actionError) && <ErrorState variant="inline" title="Unable to update notifications" message={error ?? actionError ?? ""} onRetry={reload} />}
          {loading && <div className="space-y-3" aria-label="Loading notifications">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-20 rounded-2xl" />)}</div>}
          {!loading && data?.length === 0 && <EmptyState icon={CheckCheck} accent="leave" title="You are all caught up" description="New workflow and compliance updates will appear here." />}
          {!loading && data && data.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-elevation-1" aria-label="Notifications">
              <div className="border-b border-line-soft px-5 py-3.5 text-support text-ink-muted">{unread ? `${unread} unread update${unread === 1 ? "" : "s"}` : "All notifications read"}</div>
              <ul className="divide-y divide-line-soft">
                {data.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={async () => { try { if (!item.is_read) await notificationsApi.markNotificationRead(item.id); if (item.route_hint) router.push(item.route_hint); else await reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); } }}
                      className={cx("group block w-full px-5 py-4 text-left transition-colors hover:bg-surface-hover", !item.is_read && "bg-primary-soft/40")}
                    >
                      <span className="flex gap-3">
                        <span className={cx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", item.is_read ? "bg-line-strong" : "bg-primary")} aria-label={item.is_read ? "Read" : "Unread"} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-col justify-between gap-1 sm:flex-row">
                            <span className={cx("text-ink-strong", item.is_read ? "font-medium" : "font-semibold")}>{item.title}</span>
                            <time className="shrink-0 text-caption text-ink-subtle">{formatDateTime(item.created_at)}</time>
                          </span>
                          <span className="mt-1 block text-support text-ink-muted">{item.message}</span>
                          {item.route_hint && <span className="mt-2 inline-flex items-center gap-1 text-caption font-semibold text-primary-ink">Open related record<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </AppShell>
    </AuthenticationGate>
  );
}
