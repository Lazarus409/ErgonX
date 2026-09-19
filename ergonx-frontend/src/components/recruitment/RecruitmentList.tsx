"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage } from "@/lib/api";
import type { PaginatedData } from "@/types/api";

interface RecruitmentListProps<T extends { id: string; status: string }> {
  title: string;
  description: string;
  createHref?: string;
  createLabel?: string;
  load: (search?: string) => Promise<PaginatedData<T>>;
  columns: Array<{ label: string; render: (item: T) => React.ReactNode }>;
}

export default function RecruitmentList<T extends { id: string; status: string }>({
  title,
  description,
  createHref,
  createLabel,
  load,
  columns,
}: RecruitmentListProps<T>) {
  const [search, setSearch] = useState("");
  const [data, setData] = useState<PaginatedData<T> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setData(await load(search.trim() || undefined));
    } catch (caught) {
      setData(null);
      setError(getApiErrorMessage(caught));
    }
  }, [load, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actions={createHref && createLabel ? <Link href={createHref} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">{createLabel}</Link> : undefined} />
      <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <Search className="mt-2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void refresh()} placeholder={`Search ${title.toLowerCase()}…`} className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none" />
        <button type="button" onClick={() => void refresh()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700">Search</button>
      </div>
      {error && <ErrorState message={error} onRetry={() => void refresh()} />}
      {!data && !error && <LoadingState />}
      {data && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500">{columns.map((column) => <th key={column.label} className="px-5 py-3 font-medium">{column.label}</th>)}<th className="px-5 py-3 font-medium">Status</th></tr></thead><tbody>{data.results.length === 0 ? <tr><td colSpan={columns.length + 1} className="px-5 py-10 text-center text-slate-500">No records found.</td></tr> : data.results.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0">{columns.map((column) => <td key={column.label} className="px-5 py-4 text-slate-700">{column.render(item)}</td>)}<td className="px-5 py-4"><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div>}
    </div>
  );
}
