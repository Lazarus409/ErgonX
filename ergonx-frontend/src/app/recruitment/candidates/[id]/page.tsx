"use client";

import { useParams } from "next/navigation";
import { useCallback } from "react";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import BackNavigation from "@/components/ui/BackNavigation";
import { recruitmentApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>(); const load = useCallback(() => Promise.all([recruitmentApi.getCandidate(id), recruitmentApi.getCandidateScorecard(id)]), [id]); const { data, loading, error, reload } = useApiResource(load);
  if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error ?? "Candidate not found."} onRetry={reload} />; const [candidate, scorecard] = data; const fullName = [candidate.first_name, candidate.middle_name, candidate.last_name].filter(Boolean).join(" ");
  return <div className="space-y-6"><BackNavigation fallback="/recruitment/candidates" label="Back to candidates" /><PageHeader title={fullName} description={candidate.email} actions={<StatusBadge status={candidate.status} />} /><div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Applications</p><p className="mt-3 text-3xl font-semibold">{scorecard.application_count}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Average evaluation</p><p className="mt-3 text-3xl font-semibold">{scorecard.average_score ?? "—"}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Source</p><p className="mt-3 text-lg font-semibold">{candidate.source || "Not recorded"}</p></div></div><div className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Candidate details</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><div><dt className="text-xs font-medium uppercase text-slate-500">Phone</dt><dd className="mt-1 text-sm">{candidate.phone || "Not recorded"}</dd></div><div><dt className="text-xs font-medium uppercase text-slate-500">Email</dt><dd className="mt-1 text-sm">{candidate.email}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-medium uppercase text-slate-500">Notes</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{candidate.notes || "No notes recorded."}</dd></div></dl></div></div>;
}
