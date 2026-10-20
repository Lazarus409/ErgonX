"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Rocket, X } from "lucide-react";

import { homeApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

const DISMISS_KEY = "ergonx.goLive.dismissed";

function readDismissed() {
  try { return window.localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

/** "Ready to go live" checklist for administrators and HR; disappears once everything is done or it is hidden. */
export default function GoLiveCard() {
  const load = useCallback(() => homeApi.getGoLive(), []);
  const { data } = useApiResource(load);
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!data?.applicable || data.complete || dismissed) return null;
  const finished = data.items.filter((item) => item.complete).length;
  const hide = () => { try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ } setDismissed(true); };

  return (
    <section aria-labelledby="go-live-heading" className="rounded-2xl border border-primary/20 bg-surface p-5 shadow-elevation-1">
      <div className="flex items-start gap-3">
        <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="go-live-heading" className="text-card-title font-semibold text-ink-strong">Ready to go live</h2>
          <p className="mt-0.5 text-support text-ink-muted">{finished} of {data.items.length} done. Finish these so leave, attendance and payroll work for everyone.</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${(finished / data.items.length) * 100}%` }} /></div>
        </div>
        <button type="button" onClick={hide} className="rounded-lg p-1 text-ink-muted hover:bg-surface-muted hover:text-ink-strong" aria-label="Hide the go-live checklist"><X className="h-4 w-4" /></button>
      </div>
      <ul className="mt-4 divide-y divide-line-soft">
        {data.items.map((item) => (
          <li key={item.code} className="flex items-center gap-3 py-2.5">
            {item.complete ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Done" /> : <Circle className="h-5 w-5 shrink-0 text-ink-muted" aria-label="Not done" />}
            <div className="min-w-0 flex-1">
              <p className={item.complete ? "text-ink-muted line-through" : "font-semibold text-ink-strong"}>{item.title}</p>
              <p className="text-caption text-ink-muted">{item.detail}</p>
            </div>
            {!item.complete && <Link href={item.href} className="inline-flex shrink-0 items-center gap-1 text-support font-semibold text-primary-ink hover:underline">{item.action}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}
