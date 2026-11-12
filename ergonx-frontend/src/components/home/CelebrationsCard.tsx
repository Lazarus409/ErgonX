"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Award, Building2, Cake, PartyPopper } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { homeApi } from "@/lib/api";
import type { CelebrationRow } from "@/lib/api/home";
import { useApiResource } from "@/lib/useApiResource";

const MAX_ROWS = 6;

function when(row: CelebrationRow) {
  if (row.days_away === 0) return "Today";
  if (row.days_away === 1) return "Tomorrow";
  // The date is this year's occurrence (never a birth year); show it without a year.
  return new Date(`${row.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function Row({ row, detail }: { row: CelebrationRow; detail: string }) {
  const today = row.days_away === 0;
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-strong">{row.name}{row.is_me && <span className="font-normal text-ink-muted"> (you)</span>}</span>
        <span className="block truncate text-caption text-ink-muted">{[detail, row.department].filter(Boolean).join(" · ")}</span>
      </span>
      <span className={today ? "shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-caption font-semibold text-primary-ink" : "shrink-0 text-caption font-medium text-ink-muted"}>{when(row)}</span>
    </li>
  );
}

/** Upcoming birthdays (opted-in only), work anniversaries and the organisation's ErgonX anniversary, with a greeting on the day. */
export default function CelebrationsCard({ showPreferencesLink = false }: { showPreferencesLink?: boolean }) {
  const load = useCallback(() => homeApi.getCelebrations(14), []);
  const { data } = useApiResource(load);
  if (!data) return null;
  const mine = data.my_celebration_today;
  const organisation = data.organisation_anniversary;
  const empty = !data.birthdays.length && !data.anniversaries.length;
  if (empty && !mine && !organisation) return null;
  const orgYears = organisation ? `${organisation.years} year${organisation.years === 1 ? "" : "s"}` : "";

  return (
    <Card
      title="Celebrations"
      icon={PartyPopper}
      accent="hr"
      actions={showPreferencesLink ? <Link href="/me/profile#celebrations" className="text-support font-semibold text-primary-ink hover:underline">What I share</Link> : undefined}
    >
      {mine && (
        <p className="mb-4 rounded-xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary-ink" role="status">
          {mine.kind === "BIRTHDAY" ? "Happy birthday from everyone at work! 🎉" : `Happy ${mine.years}-year work anniversary! Thank you for your service.`}
        </p>
      )}
      {organisation && (
        organisation.days_away === 0 ? (
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary-ink" role="status">
            <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />Today {organisation.name} celebrates {orgYears} on ErgonX. Thank you for growing with us!
          </p>
        ) : (
          <p className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-surface-muted/70 px-4 py-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-semibold text-ink-strong"><Building2 className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />{orgYears} of {organisation.name} on ErgonX</span>
            <span className="shrink-0 text-caption font-medium text-ink-muted">{organisation.days_away === 1 ? "Tomorrow" : new Date(`${organisation.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
          </p>
        )
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {data.birthdays.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted"><Cake className="h-3.5 w-3.5" aria-hidden="true" />Birthdays</h3>
            <ul className="mt-1 divide-y divide-line-soft">
              {data.birthdays.slice(0, MAX_ROWS).map((row) => <Row key={`b-${row.employee_id}`} row={row} detail="Birthday" />)}
            </ul>
          </div>
        )}
        {data.anniversaries.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-ink-muted"><Award className="h-3.5 w-3.5" aria-hidden="true" />Work anniversaries</h3>
            <ul className="mt-1 divide-y divide-line-soft">
              {data.anniversaries.slice(0, MAX_ROWS).map((row) => <Row key={`a-${row.employee_id}`} row={row} detail={`${row.years} year${row.years === 1 ? "" : "s"}`} />)}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
