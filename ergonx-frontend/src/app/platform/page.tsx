"use client";

import Link from "next/link";
import { Building2, History, Inbox, LayoutGrid, TrendingUp, UsersRound } from "lucide-react";
import { useCallback } from "react";

import ChartCard from "@/components/charts/ChartCard";
import { BarsChart } from "@/components/charts/Charts";
import HomeHero from "@/components/home/HomeHero";
import { useAuth } from "@/components/guards/AuthProvider";
import { formatDateTime, formatRelative, onboardingLabel } from "@/components/platform/format";
import { Badge } from "@/components/ui/Badge";
import { AttentionItem, Avatar, Card, MetricCard, SummaryList } from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import { platformApi } from "@/lib/api";
import { auditActionLabel } from "@/lib/api/platform";
import { useApiResource } from "@/lib/useApiResource";

const growthSeries = [
  { key: "institutions", label: "Organizations created", color: "var(--chart-1)" },
  { key: "access_requests", label: "Access requests", color: "var(--chart-3)" },
];

/** Super Admin home: platform health, what needs a decision, and recent activity. */
export default function PlatformOverviewPage() {
  const { user } = useAuth();
  const loadOverview = useCallback(() => platformApi.getOverview(), []);
  const { data, loading, error, reload } = useApiResource(loadOverview);
  const loadActivity = useCallback(() => platformApi.listAuditEvents({ page: 1 }), []);
  const { data: activity } = useApiResource(loadActivity);

  if (loading && !data) return <LoadingState variant="dashboard" />;
  if (error || !data) return <ErrorState message={error ?? "Could not load the platform overview."} onRetry={reload} />;

  const growth = data.growth.months.map((month, index) => ({
    month,
    institutions: data.growth.institutions[index] ?? 0,
    access_requests: data.growth.access_requests[index] ?? 0,
  }));
  const { institutions, users, pipeline, onboarding } = data;
  const stuck = onboarding.BLOCKED;
  const attention = [
    pipeline.pending_requests > 0 && { title: `${pipeline.pending_requests} access request${pipeline.pending_requests === 1 ? "" : "s"} awaiting review`, description: "Organizations asked for an invitation from the Get Started page.", severity: "warning", href: "/platform/invitations" },
    pipeline.invitations_expiring_48h > 0 && { title: `${pipeline.invitations_expiring_48h} invitation${pipeline.invitations_expiring_48h === 1 ? "" : "s"} expiring within 48 hours`, description: "Unused setup links lapse soon. Re-issue one if the recipient still needs it.", severity: "info", href: "/platform/invitations" },
    stuck > 0 && { title: `${stuck} organization${stuck === 1 ? " is" : "s are"} blocked in setup`, description: "Their onboarding checklist reports a blocking problem.", severity: "warning", href: "/platform/organizations" },
    institutions.suspended > 0 && { title: `${institutions.suspended} suspended organization${institutions.suspended === 1 ? "" : "s"}`, description: "Their users cannot sign in until reactivated.", severity: "info", href: "/platform/organizations" },
  ].filter((item): item is { title: string; description: string; severity: string; href: string } => Boolean(item));

  return (
    <>
      <HomeHero eyebrow="ErgonX platform" title={`Good to see you, ${user?.firstName || "Super"}.`} subtitle="The health of every organization on ErgonX, and what needs your decision." />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform summary">
        <MetricCard size="sm" label="Organizations" value={institutions.total} icon={Building2} accent="brand" href="/platform/organizations" description={`${institutions.active} active · ${institutions.suspended} suspended`} />
        <MetricCard size="sm" label="Users signed in, last 30 days" value={users.signed_in_last_30_days} icon={UsersRound} accent="hr" description={`of ${users.total.toLocaleString("en-GB")} user accounts`} />
        <MetricCard size="sm" label="Employees managed" value={data.employees.total.toLocaleString("en-GB")} icon={LayoutGrid} accent="payroll" description="Across all organizations" />
        <MetricCard size="sm" label="Requests awaiting review" value={pipeline.pending_requests} icon={Inbox} accent="recruitment" href="/platform/invitations" description={`${pipeline.pending_invitations} invitation${pipeline.pending_invitations === 1 ? "" : "s"} not yet accepted`} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ChartCard
          title="Growth"
          description="New organizations and Get Started requests in each of the last 12 months."
          icon={TrendingUp}
          accent="brand"
          legend={growthSeries.map((series) => ({ label: series.label, color: series.color }))}
          empty={!growth.some((point) => point.institutions || point.access_requests)}
          emptyDescription="Sign-ups and requests will appear here."
          data={{ columns: ["Month", "Organizations created", "Access requests"], rows: growth.map((point) => [point.month, point.institutions, point.access_requests]) }}
        >
          <BarsChart data={growth} xKey="month" xFormat="month" height={250} series={growthSeries} />
        </ChartCard>

        <Card title="Needs your attention" icon={Inbox} accent="brand">
          {attention.length === 0 ? (
            <p className="text-support text-ink-muted">Nothing is waiting on you. New requests and expiring invitations will show up here.</p>
          ) : (
            <div className="-m-3 space-y-1">{attention.map((item) => <AttentionItem key={item.title} {...item} />)}</div>
          )}
          <div className="mt-5 border-t border-line-soft pt-4">
            <h3 className="text-support font-semibold text-ink-strong">Setup progress</h3>
            <SummaryList className="mt-2" items={(["READY", "IN_PROGRESS", "NOT_STARTED", "BLOCKED"] as const).map((status) => ({ label: onboardingLabel[status], value: onboarding[status] }))} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Newest organizations" icon={Building2} accent="brand" actions={<Link className="text-support font-semibold text-primary-ink hover:underline" href="/platform/organizations">All organizations</Link>}>
          {data.recent_institutions.length === 0 ? (
            <p className="text-support text-ink-muted">No organizations yet. They appear once an invitation is accepted.</p>
          ) : (
            <ul className="-mx-2 divide-y divide-line-soft">
              {data.recent_institutions.map((institution) => (
                <li key={institution.id}>
                  <Link href={`/platform/organizations/${institution.id}`} className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface-hover">
                    <Avatar name={institution.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink-strong">{institution.name}</span>
                      <span className="block truncate text-caption text-ink-muted">{institution.primary_admin?.email ?? "No active admin"} · joined {formatRelative(institution.created_at)}</span>
                    </span>
                    {institution.is_active ? <Badge size="sm" tone="neutral">{onboardingLabel[institution.onboarding_status]}</Badge> : <Badge size="sm" tone="danger">Suspended</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent platform activity" icon={History} accent="audit" actions={<Link className="text-support font-semibold text-primary-ink hover:underline" href="/platform/audit">Audit log</Link>}>
          {!activity || activity.results.length === 0 ? (
            <p className="text-support text-ink-muted">No platform actions recorded yet.</p>
          ) : (
            <ol className="divide-y divide-line-soft">
              {activity.results.slice(0, 6).map((event) => (
                <li key={event.id} className="py-3">
                  <p className="font-semibold text-ink-strong">{auditActionLabel(event.action)}{event.institution ? <span className="font-normal text-ink-muted"> · {event.institution.name}</span> : typeof event.metadata.email === "string" ? <span className="font-normal text-ink-muted"> · {event.metadata.email}</span> : null}</p>
                  <p className="text-caption text-ink-muted">{event.actor_email ?? "System"} · {formatDateTime(event.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
