"use client";
import { useCallback } from "react";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { operationsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
function formatSize(bytes: number): string { return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
export default function DocumentsPage() { const load = useCallback(() => operationsApi.listDocuments(), []); const { data, loading, error, reload } = useApiResource(load); if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error ?? "You may not have permission to view documents."} onRetry={reload} />; return <div className="space-y-6"><PageHeader title="Documents" description="Institution document records. File upload is intentionally not shown until a secure storage-upload contract is available." /><div className="rounded-2xl border border-slate-200 bg-white">{data.results.length === 0 ? <EmptyState title="No document records" description="Documents registered by supported ERP workflows will appear here." /> : <div className="divide-y divide-slate-100">{data.results.map((document) => <div key={document.id} className="flex items-center gap-4 p-5"><div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-950">{document.original_filename}</p><p className="mt-1 text-sm text-slate-500">{document.category || "Uncategorised"} · {formatSize(document.size_bytes)} · {new Date(document.created_at).toLocaleString()}</p></div><StatusBadge status={document.is_active ? "ACTIVE" : "INACTIVE"} /></div>)}</div>}</div></div>; }
