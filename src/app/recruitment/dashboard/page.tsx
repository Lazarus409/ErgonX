"use client";

import { useCallback } from "react";
import { BriefcaseBusiness, CalendarDays, ClipboardCheck, FileCheck2, FileSignature, Layers, PieChart as PieChartIcon, TrendingUp, UsersRound } from "lucide-react";

import ChartCard from "@/components/charts/ChartCard";
import { BarsChart, DonutChart, TrendChart, donutLegend } from "@/components/charts/Charts";
import { FunnelChart } from "@/components/charts/Visuals";
import { ButtonLink } from "@/components/ui/Button";
import { ActionCard, Card, InsightCard, MetricCard, SummaryList } from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { dashboardsApi } from "@/lib/api";
import { EM_DASH, formatNumber, humanizeEnum } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { useAccess } from "@/lib/access";

/**
 * Recruitment rollup. The pipeline, counts and stages are server-owned; the
 * only browser arithmetic is presentation ratios between those counts.
 */
export default function RecruitmentDashboardPage() {
  const { can } = useAccess();
  const load = useCallback(() => dashboardsApi.getRecruitmentDashboard(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const initial = loading && !data;
  const value = (count: number | undefined) => (count === undefined ? EM_DASH : formatNumber(count));
  const pipelineTotal = data?.pipeline.reduce((sum, stage) => sum + stage.count, 0) ?? 0;
  const trend = data?.applications_trend ?? [];
  const byStatus = (data?.applications_by_status ?? []).map((item) => ({ label: humanizeEnum(item.status), value: item.count }));
  const topJobs = data?.top_open_jobs ?? [];
  const chartError = !data && error ? "This data is unavailable right now." : null;
  const ratio = (numerator?: number, denominator?: number) => (numerator !== undefined && denominator ? `${Math.round((numerator / denominator) * 100)}%` : EM_DASH);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recruitment"
        title="Recruitment Dashboard"
        description="Server-owned hiring pipeline and open-role activity."
        icon={UsersRound}
        accent="recruitment"
        actions={<ButtonLink href="/recruitment/job-postings" leadingIcon={<BriefcaseBusiness className="h-4 w-4" />}>Manage openings</ButtonLink>}
      />

      {error && <ErrorState variant="inline" title="Unable to load recruitment dashboard" message={error} onRetry={reload} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Hiring indicators">
        <MetricCard label="Open jobs" value={value(data?.open_jobs)} description="Published postings" icon={BriefcaseBusiness} accent="recruitment" loading={initial} href="/recruitment/job-postings" />
        <MetricCard label="Active candidates" value={value(data?.active_candidates)} description={`${value(data?.applications)} applications`} icon={UsersRound} accent="hr" loading={initial} href="/recruitment/candidates" />
        <MetricCard label="Interviews scheduled" value={value(data?.scheduled_interviews)} description="Upcoming and today" icon={CalendarDays} accent="attendance" loading={initial} href="/recruitment/interviews" />
        <MetricCard label="Offers extended" value={value(data?.offers_extended)} description="Awaiting or accepted" icon={FileSignature} accent="accounting" loading={initial} href="/recruitment/offers" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Pipeline by stage" description="Applications grouped by the institution-defined recruitment stage, with stage-to-stage conversion." icon={Layers} accent="recruitment" accentLine>
          {initial ? (
            <div className="space-y-2">{[0, 1, 2, 3, 4].map((index) => <div key={index} className="skeleton h-8 rounded-lg" />)}</div>
          ) : data?.pipeline.length ? (
            <>
              <FunnelChart stages={data.pipeline.map((stage) => ({ label: stage.name, value: stage.count }))} />
              <p className="mt-4 text-caption text-ink-muted">{formatNumber(pipelineTotal)} applications across {formatNumber(data.pipeline.length)} stages. Percentages show conversion from the previous stage.</p>
            </>
          ) : (
            <p className="text-support text-ink-muted">No active pipeline stages are configured.</p>
          )}
        </Card>

        <div className="grid content-start gap-4">
          <InsightCard title="Interview reach" icon={CalendarDays} accent="recruitment">
            <p><span className="block text-kpi-sm font-semibold text-ink-strong tabular-nums">{ratio(data?.scheduled_interviews, data?.applications)}</span><span className="mt-1 block">Applications with a scheduled interview</span></p>
          </InsightCard>
          <InsightCard title="Offer rate" icon={FileCheck2} accent="accounting">
            <p><span className="block text-kpi-sm font-semibold text-ink-strong tabular-nums">{ratio(data?.offers_extended, data?.applications)}</span><span className="mt-1 block">Applications that reached an extended offer</span></p>
          </InsightCard>
          <InsightCard title="Load per opening" icon={ClipboardCheck} accent="hr">
            <p><span className="block text-kpi-sm font-semibold text-ink-strong tabular-nums">{data?.open_jobs ? formatNumber(Math.round((data.applications / data.open_jobs) * 10) / 10) : EM_DASH}</span><span className="mt-1 block">Applications per open job</span></p>
          </InsightCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-3"
          title="Application intake"
          description="Applications received in each of the last six calendar months."
          accent="recruitment"
          icon={TrendingUp}
          loading={initial}
          error={chartError}
          empty={!trend.some((point) => point.applications > 0)}
          emptyDescription="New applications will appear here."
          data={{ columns: ["Month", "Applications"], rows: trend.map((point) => [point.month, point.applications]) }}
        >
          <TrendChart variant="area" data={trend} xKey="month" height={250} series={[{ key: "applications", label: "Applications", color: "var(--mod-recruitment)" }]} />
        </ChartCard>
        <ChartCard
          className="xl:col-span-2"
          title="Applications by status"
          description="Where every application currently stands."
          accent="recruitment"
          icon={PieChartIcon}
          loading={initial}
          error={chartError}
          empty={!byStatus.length}
          emptyDescription="No applications yet."
          data={{ columns: ["Status", "Applications"], rows: byStatus.map((item) => [item.label, item.value]) }}
        >
          <DonutChart data={byStatus} height={180} centerValue={formatNumber(byStatus.reduce((sum, item) => sum + item.value, 0))} centerLabel="applications" />
          <SummaryList className="mt-4" items={donutLegend(byStatus).map((item) => ({ label: <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label}</span>, value: item.value }))} />
        </ChartCard>
      </div>

      <ChartCard
        title="Most active openings"
        description="Open roles with the most applications."
        accent="recruitment"
        icon={BriefcaseBusiness}
        loading={initial}
        error={chartError}
        empty={!topJobs.length}
        emptyDescription="Open roles will appear here once published."
        data={{ columns: ["Opening", "Applications"], rows: topJobs.map((job) => [job.title, job.application_count]) }}
      >
        <BarsChart data={topJobs} xKey="title" layout="horizontal" height={Math.max(160, topJobs.length * 44)} colorByIndex series={[{ key: "application_count", label: "Applications", color: "var(--mod-recruitment)" }]} />
      </ChartCard>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Recruitment areas">
        {can("candidate.view") && <ActionCard href="/recruitment/applications" title="Applications" description="Review and progress applicants" icon={FileCheck2} accent="recruitment" />}
        {can("recruitment_stage.view") && <ActionCard href="/recruitment/pipeline" title="Pipeline board" description="Move candidates between stages" icon={Layers} accent="recruitment" />}
        {can("interview.view") && <ActionCard href="/recruitment/interviews" title="Interviews" description="Schedule and record outcomes" icon={CalendarDays} accent="recruitment" />}
        {can("offer.view") && <ActionCard href="/recruitment/offers" title="Offers" description="Draft, extend and track offers" icon={FileSignature} accent="recruitment" />}
      </section>
    </div>
  );
}
