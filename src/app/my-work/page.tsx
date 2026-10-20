"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  AlarmClock,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  GitPullRequest,
  GraduationCap,
  HelpCircle,
  Hourglass,
  ListTodo,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, MetricCard } from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { homeApi } from "@/lib/api";
import type { MyWorkItem, MyWorkSection } from "@/lib/api/home";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/format";
import type { ModuleAccent } from "@/lib/moduleTheme";
import { useApiResource } from "@/lib/useApiResource";

const SECTION_STYLE: Record<MyWorkSection["key"], { icon: LucideIcon; accent: ModuleAccent; empty: string }> = {
  approvals: { icon: GitPullRequest, accent: "brand", empty: "No decisions are waiting on you." },
  to_do: { icon: ListTodo, accent: "hr", empty: "You're all caught up." },
  team: { icon: Users, accent: "hr", empty: "No onboarding or offboarding items are open." },
  waiting: { icon: Hourglass, accent: "leave", empty: "Nothing of yours is waiting on anyone." },
};

function itemIcon(kind: string): LucideIcon {
  if (kind.startsWith("approval")) return GitPullRequest;
  if (kind === "policy") return FileSignature;
  if (kind.startsWith("review")) return Target;
  if (kind.startsWith("training")) return GraduationCap;
  if (kind.startsWith("checklist") || kind.startsWith("lifecycle")) return ClipboardCheck;
  return Hourglass;
}

function waitingFor(since: string) {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

function Timing({ item }: { item: MyWorkItem }) {
  if (item.due_date) {
    return <Badge size="sm" tone={item.overdue ? "danger" : item.due_soon ? "warning" : "neutral"}>{item.overdue ? "Overdue · " : "Due "}{formatDate(item.due_date)}</Badge>;
  }
  if (item.waiting_since) {
    return <Badge size="sm" tone={item.overdue ? "danger" : "neutral"}>Waiting {waitingFor(item.waiting_since)}</Badge>;
  }
  return null;
}

function SectionCard({ section, showHelp }: { section: MyWorkSection; showHelp: boolean }) {
  const style = SECTION_STYLE[section.key];
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? section.items : section.items.slice(0, 8);
  return (
    <Card
      title={section.title}
      description={showHelp ? section.help : undefined}
      icon={style.icon}
      accent={style.accent}
      actions={<span className="flex items-center gap-2">{section.overdue > 0 && <Badge tone="danger">{section.overdue} overdue</Badge>}<Badge tone={section.count ? "brand" : "success"}>{section.count}</Badge></span>}
    >
      {section.items.length === 0 ? (
        <p className="flex items-center gap-2 text-support text-ink-muted"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />{style.empty}</p>
      ) : (
        <>
          <ul className="divide-y divide-line-soft">
            {visible.map((item) => {
              const Icon = itemIcon(item.kind);
              return (
                <li key={item.id}>
                  <Link href={item.route} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-hover">
                    <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", item.overdue ? "bg-danger-soft text-danger-ink" : "bg-surface-muted text-ink-muted")} aria-hidden="true"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-strong">{item.title}</span>
                      {item.subtitle && <span className="block truncate text-caption text-ink-muted">{item.subtitle}</span>}
                    </span>
                    <Timing item={item} />
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-primary-ink" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            {section.items.length > 8 && <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer" : `Show all ${section.items.length}`}</Button>}
            {section.count > section.items.length && <span className="self-center text-caption text-ink-muted">Showing the first {section.items.length} of {section.count}.</span>}
            {section.route && <Link href={section.route} className="ml-auto self-center text-support font-semibold text-primary-ink hover:underline">Open {section.title.toLowerCase()}</Link>}
          </div>
        </>
      )}
    </Card>
  );
}

/** My Work: everything waiting on you across ErgonX, with a link to where each item is handled. */
export default function MyWorkPage() {
  const load = useCallback(() => homeApi.getMyWork(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const [showHelp, setShowHelp] = useState(true);
  const summary = data?.summary;
  const initial = loading && !data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="My work"
       
        icon={ListTodo}
        accent="brand"
        actions={<Button variant="ghost" leadingIcon={<HelpCircle className="h-4 w-4" />} onClick={() => setShowHelp(!showHelp)} aria-pressed={showHelp}>{showHelp ? "Hide tips" : "Show tips"}</Button>}
      />

      {error && <ErrorState variant="inline" title="Unable to load your work" message={error} onRetry={reload} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="My work summary">
        <MetricCard label="To do" value={summary ? String(summary.total) : "—"} description="Approvals and tasks for you" icon={ListTodo} accent="brand" loading={initial} />
        <MetricCard label="Overdue" value={summary ? String(summary.overdue) : "—"} description="Past due, or approvals waiting over 3 days" icon={AlarmClock} accent="audit" loading={initial} />
        <MetricCard label="Due this week" value={summary ? String(summary.due_soon) : "—"} description="Due in the next 7 days" icon={CheckCircle2} accent="attendance" loading={initial} />
        <MetricCard label="Waiting on others" value={summary ? String(summary.waiting_on_others) : "—"} description="Your requests in someone else's queue" icon={Hourglass} accent="leave" loading={initial} />
      </section>

      {initial ? (
        <div className="grid gap-5 lg:grid-cols-2">{[0, 1].map((key) => <Skeleton key={key} className="h-64 w-full" />)}</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data?.sections.map((section) => <SectionCard key={section.key} section={section} showHelp={showHelp} />)}
        </div>
      )}
    </div>
  );
}
