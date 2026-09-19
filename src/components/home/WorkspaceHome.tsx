"use client";

import { ArrowRight, Bell, ChevronRight, CircleAlert, Clock3 } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";

import { useAuth } from "@/components/guards/AuthProvider";
import ErrorState from "@/components/ui/ErrorState";
import { homeApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { HomeQuickAction } from "@/types/home";

interface WorkspaceHomeProps {
  areaLabel: string;
  continueHref: string;
  continueTitle: string;
  continueDescription: string;
}

function actionInitials(action: HomeQuickAction): string {
  return action.label
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));

  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  if (elapsedMinutes < 1440) return `${Math.round(elapsedMinutes / 60)}h ago`;
  return `${Math.round(elapsedMinutes / 1440)}d ago`;
}

export default function WorkspaceHome({
  areaLabel,
  continueHref,
  continueTitle,
  continueDescription,
}: WorkspaceHomeProps) {
  const { user } = useAuth();
  const load = useCallback(() => homeApi.getHome(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const greeting = data?.greeting_context.greeting ?? `Welcome, ${user?.firstName ?? "there"}`;
  const displayName = data?.greeting_context.user_display_name ?? user?.firstName ?? "";
  const actionByCode = new Map(data?.quick_actions.map((action) => [action.code, action]));

  return (
    <main className="mx-auto max-w-6xl space-y-7 pb-24">
      <p className="text-sm text-slate-400">{areaLabel}</p>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">ErgonX ERP</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            {greeting}.
          </h1>
        </div>
        <div className="w-full max-w-xl rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-400 shadow-sm">
          Search employees, leave, payroll, reports…
        </div>
        <span className="hidden h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white lg:flex">
          {displayName.slice(0, 1).toUpperCase() || "E"}
        </span>
      </header>

      <section className="grid gap-4 rounded-2xl bg-[#111111] p-6 text-white lg:grid-cols-[1.2fr_0.9fr]">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {areaLabel} workspace
          </p>
          <h2 className="mt-2 text-3xl font-semibold">{greeting}.</h2>
          <p className="mt-2 text-sm text-slate-300">Welcome back.</p>
          <span className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            All systems operational
          </span>
        </div>
        <div className="rounded-xl bg-white/10 p-5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Continue where you left off
          </p>
          <h3 className="mt-2 font-semibold">{continueTitle}</h3>
          <p className="mt-1 text-xs text-slate-300">{continueDescription}</p>
          <Link href={continueHref} className="mt-5 inline-flex rounded-full bg-white px-5 py-2 text-xs font-semibold text-slate-950">
            Continue
          </Link>
        </div>
      </section>

      {error && <ErrorState message={error} onRetry={reload} />}

      <section>
        <h2 className="text-lg font-semibold text-slate-950">Quick access</h2>
        <p className="mt-1 text-sm text-slate-500">Your permitted actions, one click away.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading && Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-[70px] animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
          {data?.quick_actions.map((action) => (
            <Link key={action.code} href={action.route_hint} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-slate-300 hover:shadow-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
                {actionInitials(action)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{action.label}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {action.is_pinned ? "Pinned for quick access" : "Available to your role"}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-900" />
            </Link>
          ))}
          {!loading && data?.quick_actions.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500 xl:col-span-3">
              No quick actions are available for your current role.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_0.8fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-950">Recent activity</h2>
            <Clock3 className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {data?.recent_work.map((item) => {
              const action = actionByCode.get(item.resume_action);
              const content = <><p className="text-sm font-medium text-slate-900">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{formatRelativeTime(item.updated_at)}</p></>;
              return item.can_resume && action ? <Link key={`${item.type}-${item.id}`} href={action.route_hint} className="block py-3 first:pt-0 hover:text-slate-700">{content}</Link> : <div key={`${item.type}-${item.id}`} className="py-3 first:pt-0">{content}</div>;
            })}
            {!loading && data?.recent_work.length === 0 && <p className="py-4 text-sm text-slate-500">Your recent work will appear here.</p>}
          </div>
        </div>

        <div className="rounded-2xl border-2 border-indigo-500 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Today at a glance</h2>
          <div className="mt-5 flex items-center gap-3 text-sm text-slate-600">
            <Bell className="h-4 w-4 text-indigo-600" />
            <span>{data?.notifications_summary.unread_count ?? 0} unread notifications</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">Updates are tailored to your active institution.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-950">Needs attention</h2><CircleAlert className="h-4 w-4 text-amber-500" /></div>
          <div className="mt-4 space-y-2">
            {data?.attention_items.map((item) => {
              const action = actionByCode.get(item.action_code);
              const row = <span className="block rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{item.title}</span>;
              return action ? <Link key={item.code} href={action.route_hint} className="block hover:opacity-80">{row}</Link> : <div key={item.code}>{row}</div>;
            })}
            {!loading && data?.attention_items.length === 0 && <p className="text-sm text-slate-500">Nothing needs your attention.</p>}
          </div>
          <ChevronRight className="mt-3 h-4 w-4 text-slate-300" />
        </div>
      </section>
    </main>
  );
}
