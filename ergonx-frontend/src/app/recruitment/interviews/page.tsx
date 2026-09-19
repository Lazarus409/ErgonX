"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, recruitmentApi } from "@/lib/api";
import type { RecruitmentInterview } from "@/types/recruitment";

type Action = { id: string; status: "COMPLETED" | "CANCELLED" | "NO_SHOW" } | null;
export default function InterviewsPage() {
  const [rows, setRows] = useState<RecruitmentInterview[] | null>(null); const [error, setError] = useState<string | null>(null); const [action, setAction] = useState<Action>(null); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setError(null); try { setRows((await recruitmentApi.listInterviews({ ordering: "scheduled_at" })).results); } catch (caught) { setRows(null); setError(getApiErrorMessage(caught)); } }, []); useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const updateStatus = async () => { if (!action) return; setSaving(true); try { await recruitmentApi.setInterviewStatus(action.id, action.status); setAction(null); await load(); } catch (caught) { setError(getApiErrorMessage(caught)); setAction(null); } finally { setSaving(false); } };
  if (!rows && !error) return <LoadingState />; return <div className="space-y-6"><PageHeader title="Interviews" description="Schedule interviews and record controlled outcomes." actions={<Link href="/recruitment/interviews/new" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Schedule Interview</Link>} />{error && <ErrorState message={error} onRetry={() => void load()} />}{rows && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-5 py-3 font-medium">Scheduled</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Location / link</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Action</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No interviews scheduled.</td></tr> : rows.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="px-5 py-4">{new Date(row.scheduled_at).toLocaleString()}</td><td className="px-5 py-4">{row.interview_type || "Interview"}</td><td className="px-5 py-4">{row.location_or_link || "Not set"}</td><td className="px-5 py-4"><StatusBadge status={row.status} /></td><td className="px-5 py-4">{row.status === "SCHEDULED" && <div className="flex gap-2"><button onClick={() => setAction({ id: row.id, status: "COMPLETED" })} className="text-sm font-medium text-slate-700">Complete</button><button onClick={() => setAction({ id: row.id, status: "CANCELLED" })} className="text-sm font-medium text-red-600">Cancel</button></div>}</td></tr>)}</tbody></table></div>}<ConfirmDialog open={action !== null} title="Update interview status?" description={`The backend will set this interview to ${action?.status.replaceAll("_", " ").toLowerCase()}.`} confirmLabel="Confirm" destructive={action?.status === "CANCELLED"} loading={saving} onConfirm={() => void updateStatus()} onCancel={() => setAction(null)} /></div>;
}
