"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { BriefcaseBusiness, Plus } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { DataTable, DataToolbar } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { recruitmentApi } from "@/lib/api";
import { formatDate, humanizeEnum } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

export default function JobPostingsPage() {
  const [search, setSearch] = useState("");
  const load = useCallback(() => recruitmentApi.listJobPostings({ search: search.trim() || undefined, ordering: "-created_at" }), [search]);
  const { data, loading, error, reload } = useApiResource(load);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Recruitment" title="Job postings" description="Manage your organization's open roles." icon={BriefcaseBusiness} accent="recruitment" actions={<ButtonLink href="/recruitment/job-postings/new" leadingIcon={<Plus className="h-4 w-4" />}>New job posting</ButtonLink>} />
      <DataTable
        caption="Job postings"
        rows={data?.results}
        rowKey={(posting) => posting.id}
        loading={loading}
        error={error}
        onRetry={reload}
        minWidth={760}
        toolbar={<DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search job postings…" />}
        empty={{
          title: search ? "No matching job postings" : "No job postings yet",
          description: search ? "Try a different search term." : "Create a draft vacancy to begin your recruitment process.",
          icon: BriefcaseBusiness,
          action: search ? undefined : <ButtonLink href="/recruitment/job-postings/new" size="sm" leadingIcon={<Plus className="h-4 w-4" />}>Create job posting</ButtonLink>,
        }}
        columns={[
          { key: "posting", header: "Posting", sortValue: (posting) => posting.title, cell: (posting) => <Link href={`/recruitment/job-postings/${posting.id}`} className="group block"><span className="block font-semibold text-ink-strong group-hover:text-primary-ink">{posting.title}</span><span className="block text-caption text-ink-muted">{posting.code}</span></Link> },
          { key: "openings", header: "Openings", numeric: true, sortValue: (posting) => posting.openings, cell: (posting) => posting.openings },
          { key: "employment", header: "Employment", cell: (posting) => humanizeEnum(posting.employment_type) },
          { key: "closes", header: "Closes", sortValue: (posting) => posting.closes_on ?? "", cell: (posting) => (posting.closes_on ? formatDate(posting.closes_on) : <span className="text-ink-subtle">Not set</span>) },
          { key: "status", header: "Status", cell: (posting) => <StatusBadge status={posting.status} size="sm" /> },
        ]}
      />
    </div>
  );
}
