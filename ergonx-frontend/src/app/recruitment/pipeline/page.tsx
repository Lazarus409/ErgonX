"use client";

import { useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import { recruitmentApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

export default function RecruitmentPipelinePage() {
  const load = useCallback(() => recruitmentApi.getPipeline(), []);
  const { data, loading, error, reload } = useApiResource(load);
  return <div className="space-y-6"><PageHeader title="Recruitment Pipeline" description="Application volume by the institution-defined recruitment stages." />{loading && <LoadingState />}{error && <ErrorState message={error} onRetry={reload} />}{data && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{data.map((stage) => <div key={stage.stage_id} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-medium text-slate-500">{stage.sequence}. {stage.stage_name}</p><p className="mt-4 text-3xl font-semibold text-slate-950">{stage.application_count}</p><p className="mt-1 text-sm text-slate-500">applications</p></div>)}{data.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 xl:col-span-4">No recruitment stages have been configured.</p>}</div>}</div>;
}
