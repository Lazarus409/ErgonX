"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Plus, Sparkles, Trash2 } from "lucide-react";

import { useAuth } from "@/components/guards/AuthProvider";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { organizationApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api/client";
import type { HolidaySuggestion, PublicHoliday } from "@/lib/api/organization";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });

/** Public holidays: days off for everyone, skipped by leave balances, attendance and working-day payroll. */
export default function PublicHolidaysPage() {
  const { user } = useAuth();
  const permissions = user?.permissions ?? [];
  const canManage = permissions.includes("*") || permissions.includes("organization.create");
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const load = useCallback(() => organizationApi.listPublicHolidays(year), [year]);
  const { data: holidays, loading, error, reload } = useApiResource(load);
  const loadSuggestions = useCallback(() => (canManage ? organizationApi.getHolidaySuggestions(year) : Promise.resolve(null)), [canManage, year]);
  const { data: suggestions, reload: reloadSuggestions } = useApiResource(loadSuggestions);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ date: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const available = useMemo(() => (suggestions?.holidays ?? []).filter((item) => !item.already_added), [suggestions]);
  const isPicked = (item: HolidaySuggestion) => picked[item.date] ?? true;

  const refresh = () => { setPicked({}); reload(); reloadSuggestions(); };

  const run = async (work: () => Promise<string>) => {
    setBusy(true); setActionError(null); setNotice(null);
    try { setNotice(await work()); refresh(); }
    catch (caught) { setActionError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  const addOne = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      await organizationApi.createPublicHoliday({ date: form.date, name: form.name.trim() });
      setForm({ date: "", name: "" });
      return `${form.name.trim()} added.`;
    });
  };

  const addSuggested = () => void run(async () => {
    const chosen = available.filter(isPicked);
    for (const item of chosen) await organizationApi.createPublicHoliday({ date: item.date, name: item.name, statutory_date: item.statutory_date });
    return `${chosen.length} holiday${chosen.length === 1 ? "" : "s"} added for ${year}.`;
  });

  const remove = (holiday: PublicHoliday) => void run(async () => {
    await organizationApi.deletePublicHoliday(holiday.id);
    return `${holiday.name} removed.`;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Public holidays"
        description="Days off for everyone. Leave requests don't use up days on a holiday, attendance records them as off days, and working-day payroll leaves them out."
        icon={CalendarDays}
        accent="settings"
        actions={<label className="flex items-center gap-2 text-sm font-semibold text-ink">Year<Select value={String(year)} onChange={(event) => { setYear(Number(event.target.value)); setPicked({}); }} className="w-28">{[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((value) => <option key={value} value={value}>{value}</option>)}</Select></label>}
      />

      {actionError && <Alert tone="danger" onDismiss={() => setActionError(null)}>{actionError}</Alert>}
      {notice && <Alert tone="success" onDismiss={() => setNotice(null)}>{notice}</Alert>}

      {canManage && suggestions && (available.length > 0 || suggestions.holidays.length === 0) && (
        <Card title={`Suggested holidays for ${year}`} description={suggestions.note} icon={Sparkles} accent="settings"
          actions={available.length > 0 && <Button leadingIcon={<Plus className="h-4 w-4" />} loading={busy} disabled={!available.some(isPicked)} onClick={addSuggested}>Add selected</Button>}>
          {available.length > 0 && (
            <ul className="divide-y divide-line-soft px-5 pb-4">
              {available.map((item) => (
                <li key={item.date} className="flex items-center gap-3 py-2.5">
                  <input type="checkbox" checked={isPicked(item)} onChange={(event) => setPicked((current) => ({ ...current, [item.date]: event.target.checked }))} aria-label={`Add ${item.name}`} className="h-4 w-4 rounded border-line-strong" />
                  <span className="w-36 shrink-0 tabular-nums text-ink-strong">{weekday(item.date)} {formatDate(item.date)}</span>
                  <span className="min-w-0 flex-1 text-ink">{item.name}</span>
                  {item.statutory_date && <Badge size="sm" tone="neutral">moved from {weekday(item.statutory_date)} {formatDate(item.statutory_date)}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <DataTable
        caption={`Holidays in ${year}`}
        toolbar={<div className="flex items-center gap-2"><h2 className="text-card-title font-semibold text-ink-strong">Holidays in {year}</h2><Badge size="sm" tone="neutral">{holidays?.length ?? 0}</Badge></div>}
        rows={holidays ?? []}
        rowKey={(holiday) => holiday.id}
        loading={loading && !holidays}
        error={error}
        onRetry={reload}
        minWidth={520}
        empty={{ title: `No holidays for ${year} yet`, description: canManage ? "Add the suggested holidays above, or add your own below." : "Your administrator hasn't added holidays for this year.", icon: CalendarDays }}
        columns={[
          { key: "date", header: "Date", cell: (holiday) => <span className="tabular-nums font-semibold text-ink-strong">{weekday(holiday.date)} {formatDate(holiday.date)}</span> },
          { key: "name", header: "Holiday", cell: (holiday) => <span>{holiday.name}{holiday.statutory_date && <span className="ml-2 text-caption text-ink-muted">(moved from {formatDate(holiday.statutory_date)})</span>}</span> },
          ...(canManage ? [{ key: "remove", header: <span className="sr-only">Remove</span>, cell: (holiday: PublicHoliday) => <div className="flex justify-end"><IconButton label={`Remove ${holiday.name}`} disabled={busy} onClick={() => remove(holiday)}><Trash2 className="h-4 w-4" /></IconButton></div> }] : []),
        ]}
      />

      {canManage && (
        <Card title="Add a holiday" description="For Eid dates when announced, a one-off holiday the government declares, or your own company day off." icon={Plus} accent="settings">
          <form onSubmit={addOne} className="grid gap-4 px-5 pb-5 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
            <Field label="Date" required><Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required /></Field>
            <Field label="Name" required><Input value={form.name} maxLength={150} placeholder="e.g. Eid-ul-Fitr" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></Field>
            <Button type="submit" loading={busy} disabled={!form.date || !form.name.trim()}>Add holiday</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
