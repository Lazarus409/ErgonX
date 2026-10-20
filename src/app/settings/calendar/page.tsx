"use client";

import { useCallback, useState } from "react";
import { CalendarPlus, Copy } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { getApiErrorMessage, integrationsApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

/** A private calendar link with the signed-in person's shifts, approved leave and interviews. */
export default function CalendarSubscriptionPage() {
  const load = useCallback(() => integrationsApi.getMyCalendarFeed(), []);
  const { data, reload } = useApiResource(load);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true); setError(""); setCopied(false);
    try {
      const result = await integrationsApi.createMyCalendarFeed();
      setLink(`${window.location.origin}${result.path}`);
      reload();
    } catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true); setError("");
    try { await integrationsApi.revokeMyCalendarFeed(); setLink(""); reload(); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Settings" title="Calendar subscription" icon={CalendarPlus} accent="settings" />
      {error && <Alert tone="danger">{error}</Alert>}
      <Card title="Your calendar link" icon={CalendarPlus} accent="settings">
        <div className="space-y-4 text-support text-ink">
          {link ? (
            <>
              <Alert tone="warning">Copy this link now: it won&apos;t be shown again. Anyone with it can see these events, so keep it private.</Alert>
              <div className="flex gap-2">
                <Input readOnly value={link} onFocus={(event) => event.currentTarget.select()} aria-label="Calendar link" />
                <Button variant="secondary" leadingIcon={<Copy className="h-4 w-4" />} onClick={() => void navigator.clipboard.writeText(link).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</Button>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-caption text-ink-muted">
                <li>Google Calendar: Other calendars → From URL → paste the link.</li>
                <li>Outlook: Add calendar → Subscribe from web → paste the link.</li>
                <li>Apple Calendar: File → New Calendar Subscription → paste the link.</li>
              </ul>
            </>
          ) : data?.active ? (
            <p>You have an active link, created {formatDateTime(data.created_at)}{data.last_used_at ? `, last read by your calendar ${formatDateTime(data.last_used_at)}` : ""}. For safety it can&apos;t be shown again: create a new one if you need it (the old one stops working).</p>
          ) : (
            <p>You don&apos;t have a calendar link yet.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button loading={busy} onClick={() => void create()}>{data?.active || link ? "Create a new link" : "Create calendar link"}</Button>
            {(data?.active || link) && <Button variant="ghost" className="text-danger-ink" disabled={busy} onClick={() => void revoke()}>Turn off</Button>}
          </div>
        </div>
      </Card>
    </div>
  );
}
