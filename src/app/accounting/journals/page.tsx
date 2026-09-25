"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { accountingApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";
import { MAX_PAGE_SIZE } from "@/types/api";
import { buttonClasses } from "@/components/ui/Button";

export default function JournalsPage() {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("ALL");
  const load = useCallback(() => accountingApi.listJournalEntries({ page_size: MAX_PAGE_SIZE, status: status === "ALL" ? undefined : status, ordering: "-entry_date" }), [status]); const { data, loading, error, reload } = useApiResource(load); const journals = useMemo(() => data?.results ?? [], [data]); const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return journals.filter((journal) => !query || journal.journal_number.toLowerCase().includes(query) || journal.reference.toLowerCase().includes(query) || journal.description.toLowerCase().includes(query)); }, [journals, search]);
  return <div className="space-y-6"><PageHeader title="Journals" description="Create, review, approve, post and reverse accounting journals." actions={<Link href="/accounting/journals/new" className={buttonClasses({ variant: "primary" })}><Plus className="h-4 w-4" />New Journal</Link>} />{error && <ErrorState message={error} onRetry={reload} />}<section className="rounded-2xl border bg-surface p-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative max-w-md flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-ink-subtle" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference or description..." className="w-full h-9 rounded-lg border pl-10 pr-4 text-sm" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-strong shadow-elevation-1 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15"><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="PENDING_APPROVAL">Pending approval</option><option value="APPROVED">Approved</option><option value="POSTED">Posted</option><option value="VOID">Void</option><option value="REVERSED">Reversed</option></select></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[750px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-ink-muted"><th className="pb-3">Reference</th><th className="pb-3">Description</th><th className="pb-3">Date</th><th className="pb-3">Lines</th><th className="pb-3">Status</th></tr></thead><tbody>{filtered.map((journal) => <tr key={journal.id} className="border-b last:border-0"><td className="py-4"><Link href={`/accounting/journals/${journal.id}`} className="font-semibold hover:underline">{journal.journal_number}</Link>{journal.reference && <p className="mt-1 text-xs text-ink-muted">{journal.reference}</p>}</td><td className="py-4">{journal.description}</td><td className="py-4">{formatDate(journal.entry_date)}</td><td className="py-4">{journal.lines.length}</td><td className="py-4"><StatusBadge status={journal.status} /></td></tr>)}</tbody></table>{loading && <p className="py-10 text-center text-sm text-ink-muted">Loading journals...</p>}{!loading && !filtered.length && <p className="py-10 text-center text-sm text-ink-muted">No journals found.</p>}</div></section></div>;
}
