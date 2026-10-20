"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";

import BackNavigation from "@/components/ui/BackNavigation";
import PageHeader from "@/components/ui/PageHeader";
import { ARTICLES } from "@/lib/help";

export default function HelpArticlePage() {
  const params = useParams<{ slug: string }>();
  const article = ARTICLES.find((candidate) => candidate.slug === params?.slug);
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader back={<BackNavigation fallback="/help" label="Back to Help" />} title={article.title} description={article.summary} icon={BookOpen} accent="settings" />
      <ol className="space-y-3 rounded-xl border border-line bg-surface p-5 shadow-elevation-1">
        {article.steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-caption font-bold text-primary-ink" aria-hidden="true">{index + 1}</span>
            <span className="text-support text-ink">{step}</span>
          </li>
        ))}
      </ol>
      {article.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {article.links.map((link) => <Link key={link.href} href={link.href} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-support font-semibold text-primary-ink hover:bg-primary-soft">{link.label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>)}
        </div>
      )}
      <p className="text-caption text-ink-muted">For: {article.audience}. What you can open depends on your role.</p>
    </div>
  );
}
