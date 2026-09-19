"use client";

import Link from "next/link";
import { useCallback } from "react";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { recruitmentApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

export default function EvaluationsPage() {
  const load = useCallback(() => recruitmentApi.listCandidateEvaluations({ ordering: "-created_at" }), []); const { data, loading, error, reload } = useApiResource(load); if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error ?? "Unable to load evaluations."} onRetry={reload} />;
  return <div className="space-y-6"><PageHeader title="Candidate Evaluations" description="Structured interviewer scores and recommendations for recruitment applications." actions={<Link href="/recruitment/evaluations/new" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Add Evaluation</Link>} /><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-5 py-3 font-medium">Application</th><th className="px-5 py-3 font-medium">Score</th><th className="px-5 py-3 font-medium">Recommendation</th><th className="px-5 py-3 font-medium">Date</th></tr></thead><tbody>{data.results.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">No evaluations recorded.</td></tr> : data.results.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="px-5 py-4">{item.application.slice(0, 8)}</td><td className="px-5 py-4 font-medium">{item.score}</td><td className="px-5 py-4">{item.recommendation.replaceAll("_", " ")}</td><td className="px-5 py-4">{new Date(item.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></div>;
}
