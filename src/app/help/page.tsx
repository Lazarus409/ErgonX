"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, LifeBuoy, Search } from "lucide-react";

import { Input } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { ARTICLES, GLOSSARY } from "@/lib/help";

/** Help centre: short guides for common jobs and a glossary of payroll and HR terms. */
export default function HelpPage() {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const articles = useMemo(() => ARTICLES.filter((article) => !needle || `${article.title} ${article.summary} ${article.steps.join(" ")}`.toLowerCase().includes(needle)), [needle]);
  const terms = useMemo(() => Object.values(GLOSSARY).filter((entry) => !needle || `${entry.term} ${entry.definition}`.toLowerCase().includes(needle)).sort((a, b) => a.term.localeCompare(b.term)), [needle]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Help" description="Short guides for common jobs, and what the payroll and HR terms mean." icon={LifeBuoy} accent="settings" />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help, e.g. PAYE, import, leave" leadingIcon={<Search />} aria-label="Search help" />

      <section aria-labelledby="guides-heading" className="space-y-3">
        <h2 id="guides-heading" className="text-card-title font-semibold text-ink-strong">Guides</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {articles.map((article) => (
            <Link key={article.slug} href={`/help/${article.slug}`} className="group rounded-xl border border-line bg-surface p-4 shadow-elevation-1 transition-colors hover:border-primary/40">
              <p className="flex items-center gap-2 font-semibold text-ink-strong"><BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />{article.title}</p>
              <p className="mt-1 text-support text-ink-muted">{article.summary}</p>
              <p className="mt-3 flex items-center justify-between text-caption text-ink-muted">{article.audience}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></p>
            </Link>
          ))}
          {!articles.length && <p className="text-support text-ink-muted">No guide matches “{query}”.</p>}
        </div>
      </section>

      <section aria-labelledby="glossary-heading" className="rounded-xl border border-line bg-surface p-5 shadow-elevation-1">
        <h2 id="glossary-heading" className="text-card-title font-semibold text-ink-strong">Glossary</h2>
        <dl className="mt-3 divide-y divide-line-soft">
          {terms.map((entry) => (
            <div key={entry.term} className="grid gap-1 py-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <dt className="font-semibold text-ink-strong">{entry.term}</dt>
              <dd className="text-support text-ink">{entry.definition}</dd>
            </div>
          ))}
          {!terms.length && <p className="py-3 text-support text-ink-muted">No term matches “{query}”.</p>}
        </dl>
      </section>
    </div>
  );
}
