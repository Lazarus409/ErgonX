"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import AuthenticationGate from "@/components/guards/AuthenticationGate";
import AppShell from "@/components/layout/AppShell";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { getApiErrorMessage, notificationsApi } from "@/lib/api";
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

  return <AuthenticationGate><AppShell><div className="mx-auto max-w-4xl space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><PageHeader title="Notifications" description="Updates delivered to you for the active institution." /><button type="button" disabled={!unread || markingAll} onClick={markAllRead} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"><CheckCheck size={16} />{markingAll ? "Marking…" : "Mark all read"}</button></div>{(error || actionError) && <ErrorState title="Unable to update notifications" message={error ?? actionError ?? ""} onRetry={reload} />}{loading && <LoadingState />}{!loading && data?.length === 0 && <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"><Bell className="mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-4 font-semibold text-slate-950">You are all caught up</h2><p className="mt-1 text-sm text-slate-500">New workflow and compliance updates will appear here.</p></section>}{!loading && data && data.length > 0 && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4 text-sm text-slate-500">{unread ? `${unread} unread update${unread === 1 ? "" : "s"}` : "All notifications read"}</div><div className="divide-y divide-slate-200">{data.map((item) => <button type="button" key={item.id} onClick={async () => { try { if (!item.is_read) await notificationsApi.markNotificationRead(item.id); if (item.route_hint) router.push(item.route_hint); else await reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); } }} className={`block w-full px-5 py-4 text-left hover:bg-slate-50 ${item.is_read ? "" : "bg-sky-50/60"}`}><div className="flex gap-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.is_read ? "bg-slate-300" : "bg-sky-500"}`} aria-label={item.is_read ? "Read" : "Unread"} /><span className="min-w-0"><span className="flex flex-col justify-between gap-1 sm:flex-row"><span className="font-semibold text-slate-950">{item.title}</span><time className="shrink-0 text-xs text-slate-500">{formatDateTime(item.created_at)}</time></span><span className="mt-1 block text-sm leading-6 text-slate-600">{item.message}</span>{item.route_hint && <span className="mt-2 block text-xs font-semibold text-sky-700">Open related record</span>}</span></div></button>)}</div></section>}</div></AppShell></AuthenticationGate>;
}
