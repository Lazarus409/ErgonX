"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { IconTile } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { employeesApi, getApiErrorMessage } from "@/lib/api";
import { humanizeEnum } from "@/lib/format";
import type { SelfServiceDocument } from "@/lib/api/employees";

export default function MyDocumentsPage() {
  const [items, setItems] = useState<SelfServiceDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { employeesApi.listMyDocuments().then(setItems).catch((caught) => { setItems([]); setError(getApiErrorMessage(caught)); }); }, []);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="My documents" description="Documents shared with you by your organisation." icon={FileText} accent="brand" />
      {error && <ErrorState variant="inline" title="Unable to load your documents" message={error} />}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-elevation-1" aria-label="Documents">
        {items === null ? (
          <div className="space-y-3 p-5">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-12 rounded-xl" />)}</div>
        ) : items.length ? (
          <ul className="divide-y divide-line-soft">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-hover">
                <IconTile icon={FileText} accent="brand" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-strong" title={item.original_filename}>{item.original_filename}</p>
                  <p className="text-caption text-ink-muted">{item.category || "Employee document"}</p>
                </div>
                <Badge size="sm" tone={item.classification === "RESTRICTED" ? "danger" : item.classification === "CONFIDENTIAL" ? "warning" : "neutral"}>{humanizeEnum(item.classification)}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState size="compact" icon={FileText} title="No documents yet" description="Documents shared with you by HR will appear here." />
        )}
      </section>
    </div>
  );
}
