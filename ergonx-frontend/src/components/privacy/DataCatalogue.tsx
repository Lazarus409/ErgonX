"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, Layers } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { privacyApi } from "@/lib/api";
import { LEVEL_TONES, type ClassificationLevel } from "@/lib/api/privacy";
import { humanizeEnum } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

type Filter = "ALL" | ClassificationLevel;

/** The organisation's data inventory: what is held, how sensitive it is and who can open it. */
export default function DataCatalogue() {
  const load = useCallback(() => privacyApi.dataCatalogue(), []);
  const { data, error, reload } = useApiResource(load);
  const [filter, setFilter] = useState<Filter>("ALL");
  const rows = useMemo(() => (data?.categories ?? []).filter((row) => filter === "ALL" || row.level === filter), [data, filter]);

  if (error) return <ErrorState variant="inline" title="Unable to load the data catalogue" message={error} onRetry={reload} />;
  return (
    <div className="space-y-5">
      <Card title="Classification levels" icon={Layers} accent="audit">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(data?.levels ?? []).map((level) => (
            <li key={level.code} className="rounded-xl bg-surface-muted/70 p-3">
              <Badge size="sm" tone={LEVEL_TONES[level.code]}>{level.label}</Badge>
              <p className="mt-2 text-caption text-ink-muted">{level.meaning}</p>
              <p className="mt-2 text-caption font-semibold text-ink-strong">{data?.categories.filter((row) => row.level === level.code).length ?? 0} kinds of data</p>
            </li>
          ))}
        </ul>
        {data && (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-caption text-ink-muted">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />Documents on file:
            {data.documents.map((row) => <span key={row.level} className="font-semibold text-ink-strong">{row.count.toLocaleString("en-GB")} {row.level_label.toLowerCase()}</span>)}
          </p>
        )}
      </Card>

      <Card
        title="Data catalogue"
        icon={Layers}
        accent="audit"
        actions={<SegmentedControl label="Filter by level" value={filter} onChange={(value) => setFilter(value as Filter)} options={[{ value: "ALL", label: "All" }, { value: "RESTRICTED", label: "Restricted" }, { value: "CONFIDENTIAL", label: "Confidential" }, { value: "INTERNAL", label: "Internal" }, { value: "PUBLIC", label: "Public" }]} />}
      >
        {!data ? <p className="text-support text-ink-muted">Loading…</p> : (
          <ul className="divide-y divide-line-soft">
            {rows.map((row) => (
              <li key={row.key} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] md:items-start">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{row.label}<Badge size="sm" tone={LEVEL_TONES[row.level]}>{row.level_label}</Badge>{!row.module_enabled && <Badge size="sm" tone="neutral">Module off</Badge>}</span>
                  <span className="block text-caption text-ink-muted">{humanizeEnum(row.module)} · {row.kind} · {row.fields.join(", ")}</span>
                  {row.note && <span className="mt-1 block text-caption text-ink-muted">{row.note}</span>}
                </span>
                <span className="text-caption text-ink-muted">
                  {row.access.length ? row.access.map((item) => <span key={item.code} className="block" title={item.code}>{item.name}</span>) : <span className="font-semibold text-ink-strong">Nobody can read this back</span>}
                </span>
                <span className="text-right text-sm font-semibold tabular-nums text-ink-strong">{row.records === null ? "—" : `${row.records.toLocaleString("en-GB")} records`}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
