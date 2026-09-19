"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, recruitmentApi } from "@/lib/api";
import type { Candidate, JobPosting, RecruitmentApplication } from "@/types/recruitment";

export default function ApplicationsPage() {
  const [rows, setRows] = useState<RecruitmentApplication[] | null>(null); const [jobs, setJobs] = useState<JobPosting[]>([]); const [candidates, setCandidates] = useState<Candidate[]>([]); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setError(null); try { const [applications, jobPostings, candidateRows] = await Promise.all([recruitmentApi.listApplications({ ordering: "-created_at" }), recruitmentApi.listJobPostings({ page_size: 100 }), recruitmentApi.listCandidates({ page_size: 100 })]); setRows(applications.results); setJobs(jobPostings.results); setCandidates(candidateRows.results); } catch (caught) { setError(getApiErrorMessage(caught)); setRows(null); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]); if (!rows && !error) return <LoadingState />; const jobName = new Map(jobs.map((job) => [job.id, job.title])); const candidateName = new Map(candidates.map((candidate) => [candidate.id, [candidate.first_name, candidate.last_name].filter(Boolean).join(" ")]));
  return <div className="space-y-6"><PageHeader title="Applications" description="Draft and submit applications through the institution recruitment pipeline." actions={<Link href="/recruitment/applications/new" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">New Application</Link>} />{error && <ErrorState message={error} onRetry={() => void load()} />}{rows && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-5 py-3 font-medium">Candidate</th><th className="px-5 py-3 font-medium">Job Posting</th><th className="px-5 py-3 font-medium">Submitted</th><th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">No applications found.</td></tr> : rows.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="px-5 py-4 font-medium"><Link href={`/recruitment/applications/${row.id}`} className="hover:underline">{candidateName.get(row.candidate) ?? row.candidate}</Link></td><td className="px-5 py-4">{jobName.get(row.job_posting) ?? row.job_posting}</td><td className="px-5 py-4">{row.applied_at ? new Date(row.applied_at).toLocaleDateString() : "Draft"}</td><td className="px-5 py-4"><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div>}</div>;
}
