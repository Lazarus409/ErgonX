"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { countryName, formatDate, formatRelative, onboardingLabel } from "@/components/platform/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Card";
import { DataTable, DataToolbar, Pagination } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { platformApi } from "@/lib/api";
import type { PlatformInstitution } from "@/lib/api/platform";
import { DEFAULT_PAGE_SIZE } from "@/types/api";
import { useApiResource } from "@/lib/useApiResource";

type StatusFilter = "" | "active" | "suspended";

const onboardingTone: Record<string, BadgeTone> = { READY: "success", IN_PROGRESS: "info", BLOCKED: "danger", NOT_STARTED: "neutral" };

export default function PlatformOrganizationsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);

  // Search the server once typing pauses rather than on every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(() => platformApi.listInstitutions({ page, q: query, status }), [page, query, status]);
  const { data, loading, error, reload } = useApiResource(load);

  return (
    <>
      <PageHeader title="Organizations" description="Every organization on ErgonX, who administers it, and how far it has got with setup." />
      <DataTable<PlatformInstitution>
        caption="Organizations"
        rows={data?.results}
        loading={loading && !data}
        error={error}
        onRetry={reload}
        rowKey={(institution) => institution.id}
        onRowClick={(institution) => router.push(`/platform/organizations/${institution.id}`)}
        minWidth={960}
        toolbar={
          <DataToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, code or email…"
            filters={
              <SegmentedControl<StatusFilter>
                label="Organization status"
                value={status}
                onChange={(value) => { setStatus(value); setPage(1); }}
                options={[{ value: "", label: "All" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]}
              />
            }
          />
        }
        empty={query || status
          ? { title: "No matching organizations", description: "Try a different search or status." }
          : { title: "No organizations yet", description: "Organizations appear here once an Institution Admin accepts an invitation.", icon: Building2 }}
        footer={data && data.count > DEFAULT_PAGE_SIZE ? <Pagination page={page} pageSize={DEFAULT_PAGE_SIZE} total={data.count} onPageChange={setPage} /> : undefined}
        columns={[
          {
            key: "name",
            header: "Organization",
            cell: (institution) => (
              <span className="flex items-center gap-3">
                <Avatar name={institution.name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink-strong">{institution.name}</span>
                  <span className="block text-caption text-ink-muted">{institution.code} · {countryName(institution.country_code)}</span>
                </span>
              </span>
            ),
          },
          { key: "status", header: "Status", cell: (institution) => institution.is_active ? <Badge size="sm" tone="success">Active</Badge> : <Badge size="sm" tone="danger">Suspended</Badge> },
          {
            key: "admin",
            header: "Primary admin",
            hideBelow: "md",
            cell: (institution) => institution.primary_admin
              ? <span className="min-w-0"><span className="block truncate text-ink-strong">{institution.primary_admin.name}</span><span className="block truncate text-caption text-ink-muted">{institution.primary_admin.email}</span></span>
              : <span className="text-ink-subtle">No active admin</span>,
          },
          { key: "members", header: "Users", numeric: true, sortValue: (institution) => institution.member_count, cell: (institution) => institution.member_count.toLocaleString("en-GB") },
          { key: "employees", header: "Employees", numeric: true, hideBelow: "sm", sortValue: (institution) => institution.employee_count, cell: (institution) => institution.employee_count.toLocaleString("en-GB") },
          { key: "onboarding", header: "Setup", hideBelow: "lg", cell: (institution) => <Badge size="sm" tone={onboardingTone[institution.onboarding_status] ?? "neutral"}>{onboardingLabel[institution.onboarding_status] ?? institution.onboarding_status}</Badge> },
          { key: "activity", header: "Last sign-in", hideBelow: "lg", sortValue: (institution) => institution.last_sign_in_at ?? "", cell: (institution) => formatRelative(institution.last_sign_in_at) },
          { key: "created", header: "Joined", hideBelow: "xl", sortValue: (institution) => institution.created_at, cell: (institution) => formatDate(institution.created_at) },
        ]}
      />
    </>
  );
}
