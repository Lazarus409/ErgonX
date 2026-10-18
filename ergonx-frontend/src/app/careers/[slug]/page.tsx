"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { Briefcase, MapPin } from "lucide-react";

import CareersShell from "@/components/careers/CareersShell";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { careersApi } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

/** Public list of an organisation's open jobs. No sign-in. */
export default function CareersPage() {
  const { slug } = useParams<{ slug: string }>();
  const load = useCallback(() => careersApi.getCareersSite(slug), [slug]);
  const { data, loading, error } = useApiResource(load);

  return (
    <CareersShell organisation={data?.organisation}>
      {error && <Alert tone="warning">This careers page isn&apos;t available.</Alert>}
      {loading && !data && <p className="text-support text-ink-muted">Loading jobs…</p>}
      {data && (
        <>
          <section>
            <h1 className="text-page-title font-bold text-ink-strong">{data.headline}</h1>
            {data.introduction && <p className="mt-2 whitespace-pre-line text-support text-ink">{data.introduction}</p>}
          </section>
          <section aria-labelledby="open-jobs">
            <h2 id="open-jobs" className="text-card-title font-semibold text-ink-strong">Open positions ({data.jobs.length})</h2>
            {data.jobs.length === 0 ? (
              <p className="mt-2 text-support text-ink-muted">There are no open positions right now. Please check back later.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.jobs.map((job) => (
                  <li key={job.id}>
                    <Link href={`/careers/${slug}/jobs/${job.id}`} className="block rounded-xl border border-line bg-surface p-4 shadow-elevation-1 transition hover:border-primary/40">
                      <p className="font-semibold text-ink-strong">{job.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
                        {job.department && <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" aria-hidden="true" />{job.department}</span>}
                        {job.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{job.location}</span>}
                        <Badge size="sm">{job.employment_type}</Badge>
                        {job.closes_on && <span>Apply by {formatDate(job.closes_on)}</span>}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </CareersShell>
  );
}
