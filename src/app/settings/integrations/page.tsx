"use client";

import { useCallback, useState } from "react";
import { Copy, KeyRound, Plug, Plus, Send, Webhook } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { getApiErrorMessage, integrationsApi } from "@/lib/api";
import type { WebhookDeliveryRow, WebhookRow } from "@/lib/api/integrations";
import { formatDateTime } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

type View = "keys" | "webhooks" | "guide";

function SecretOnce({ label, value, onDone }: { label: string; value: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open onClose={onDone} title={label} description="Copy it now and store it in the other system's settings. It won't be shown again." footer={<Button onClick={onDone}>Done</Button>}>
      <div className="flex gap-2">
        <Input readOnly value={value} onFocus={(event) => event.currentTarget.select()} aria-label={label} className="font-mono" />
        <Button variant="secondary" leadingIcon={<Copy className="h-4 w-4" />} onClick={() => void navigator.clipboard.writeText(value).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</Button>
      </div>
    </Dialog>
  );
}

/** Integrations: API keys for other systems and attendance devices, and webhooks that notify them. Administrators only. */
export default function IntegrationsPage() {
  const [view, setView] = useState<View>("keys");
  const load = useCallback(() => Promise.all([integrationsApi.getCatalogue(), integrationsApi.listApiKeys(), integrationsApi.listWebhooks()]), []);
  const { data, error, reload } = useApiResource(load);
  const [catalogue, keys, hooks] = data ?? [null, null, null];
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const [keyForm, setKeyForm] = useState<{ name: string; scopes: string[] } | null>(null);
  const [hookForm, setHookForm] = useState<{ url: string; description: string; events: string[] } | null>(null);
  const [deliveries, setDeliveries] = useState<{ hook: WebhookRow; rows: WebhookDeliveryRow[] } | null>(null);

  const run = async (work: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setActionError("");
    try { await work(); after?.(); reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); } finally { setBusy(false); }
  };
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader eyebrow="Settings" title="Integrations" icon={Plug} accent="settings" />
      {(error || actionError) && <Alert tone="danger" onDismiss={actionError ? () => setActionError("") : undefined}>{error || actionError}</Alert>}
      <Tabs label="Integrations" value={view} onChange={(value) => setView(value as View)} items={[{ value: "keys", label: "API keys" }, { value: "webhooks", label: "Webhooks" }, { value: "guide", label: "Developer guide" }]} />

      {view === "keys" && (
        <Card title="API keys" description="Each key works only for the scopes you give it. Device punches are entered in the name of the person who created the key, so create device keys from an attendance manager's account." icon={KeyRound} accent="settings"
          actions={<Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setKeyForm({ name: "", scopes: [] })}>New key</Button>}>
          {keys?.results.length ? (
            <ul className="divide-y divide-line-soft">
              {keys.results.map((key) => (
                <li key={key.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">{key.name}<code className="text-caption text-ink-muted">ergx_{key.prefix}_…</code>{key.revoked_at ? <Badge size="sm">Revoked</Badge> : <Badge size="sm" tone="success">Active</Badge>}</span>
                    <span className="block text-caption text-ink-muted">{key.scopes.join(", ")} · created by {key.created_by_name} · {key.last_used_at ? `last used ${formatDateTime(key.last_used_at)}` : "never used"}</span>
                  </span>
                  {!key.revoked_at && <Button size="sm" variant="ghost" className="text-danger-ink" disabled={busy} onClick={() => window.confirm(`Revoke "${key.name}"? Systems using it stop working at once.`) && void run(() => integrationsApi.revokeApiKey(key.id))}>Revoke</Button>}
                </li>
              ))}
            </ul>
          ) : <p className="text-support text-ink-muted">No API keys yet.</p>}
        </Card>
      )}

      {view === "webhooks" && (
        <Card title="Webhooks" description="ErgonX posts a signed notice to your address when something happens. Notices carry the event and record id only; fetch details with an API key." icon={Webhook} accent="settings"
          actions={<Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setHookForm({ url: "https://", description: "", events: [] })}>New webhook</Button>}>
          {hooks?.results.length ? (
            <ul className="divide-y divide-line-soft">
              {hooks.results.map((hook) => (
                <li key={hook.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong"><span className="truncate">{hook.url}</span>{hook.is_active ? <Badge size="sm" tone="success">Active</Badge> : <Badge size="sm" tone="warning">Paused</Badge>}{hook.recent_failures > 0 && <Badge size="sm" tone="danger">{hook.recent_failures} failed this week</Badge>}</span>
                    <span className="block text-caption text-ink-muted">{hook.description ? `${hook.description} · ` : ""}{hook.events.join(", ")}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-1">
                    <Button size="sm" variant="ghost" leadingIcon={<Send className="h-4 w-4" />} disabled={busy} onClick={() => void run(() => integrationsApi.pingWebhook(hook.id).then(async () => setDeliveries({ hook, rows: await integrationsApi.webhookDeliveries(hook.id) })))}>Test</Button>
                    <Button size="sm" variant="ghost" onClick={() => void integrationsApi.webhookDeliveries(hook.id).then((rows) => setDeliveries({ hook, rows })).catch((caught) => setActionError(getApiErrorMessage(caught)))}>Deliveries</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => integrationsApi.updateWebhook(hook.id, { is_active: !hook.is_active }))}>{hook.is_active ? "Pause" : "Resume"}</Button>
                    <Button size="sm" variant="ghost" className="text-danger-ink" disabled={busy} onClick={() => window.confirm("Delete this webhook?") && void run(() => integrationsApi.deleteWebhook(hook.id))}>Delete</Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-support text-ink-muted">No webhooks yet.</p>}
        </Card>
      )}

      {view === "guide" && (
        <Card title="Developer guide" icon={Plug} accent="settings">
          <div className="space-y-4 text-support text-ink">
            <p>Send keys as <code>Authorization: Api-Key ergx_…</code> straight to the API (not through the browser app).</p>
            <div>
              <p className="font-semibold text-ink-strong">Attendance devices (scope attendance.punch)</p>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-surface-muted p-3 text-caption">{`POST /api/v1/integrations/v1/attendance/punches/
{"punches": [{"employee_number": "EMP-000101",
  "timestamp": "2026-10-17T08:02:00+00:00",
  "direction": "IN", "device_id": "GATE-1"}]}`}</pre>
              <p className="mt-1 text-caption text-ink-muted">Up to 500 punches per call; each gets its own ok/error result, so a device can resend only the failures.</p>
            </div>
            <div>
              <p className="font-semibold text-ink-strong">Read endpoints</p>
              <p className="text-caption text-ink-muted">GET /api/v1/integrations/v1/employees/ (employees.read) · GET /api/v1/integrations/v1/leave/?from=YYYY-MM-DD&amp;to=YYYY-MM-DD (leave.read)</p>
            </div>
            <div>
              <p className="font-semibold text-ink-strong">Verifying webhooks</p>
              <p className="text-caption text-ink-muted">Compute HMAC-SHA256 of <code>X-ErgonX-Timestamp + &quot;.&quot; + raw body</code> with your signing secret and compare it to <code>X-ErgonX-Signature</code> (sha256=…). Reject timestamps more than five minutes old. Failed deliveries are retried for about nine hours.</p>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={keyForm !== null} onClose={() => setKeyForm(null)} dismissible={!busy} title="New API key"
        footer={<><Button variant="secondary" onClick={() => setKeyForm(null)} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!keyForm?.name.trim() || !keyForm.scopes.length} onClick={() => keyForm && void run(async () => { const created = await integrationsApi.createApiKey({ name: keyForm.name.trim(), scopes: keyForm.scopes }); setSecret({ label: "Your new API key", value: created.key }); }, () => setKeyForm(null))}>Create key</Button></>}>
        {keyForm && (
          <div className="space-y-4">
            <Field label="Name" required><Input value={keyForm.name} maxLength={100} onChange={(event) => setKeyForm({ ...keyForm, name: event.target.value })} placeholder="e.g. Head office gate reader" /></Field>
            <Field label="What it can do">
              <div className="space-y-2">{catalogue?.scopes.map((scope) => <Checkbox key={scope.value} label={scope.label} description={scope.value} checked={keyForm.scopes.includes(scope.value)} onChange={() => setKeyForm({ ...keyForm, scopes: toggle(keyForm.scopes, scope.value) })} />)}</div>
            </Field>
          </div>
        )}
      </Dialog>

      <Dialog open={hookForm !== null} onClose={() => setHookForm(null)} dismissible={!busy} title="New webhook"
        footer={<><Button variant="secondary" onClick={() => setHookForm(null)} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!hookForm?.events.length} onClick={() => hookForm && void run(async () => { const created = await integrationsApi.createWebhook({ url: hookForm.url.trim(), events: hookForm.events, description: hookForm.description.trim() }); setSecret({ label: "Webhook signing secret", value: created.secret }); }, () => setHookForm(null))}>Create webhook</Button></>}>
        {hookForm && (
          <div className="space-y-4">
            <Field label="Address" required helper="Must be https and reachable on the public internet."><Input type="url" value={hookForm.url} onChange={(event) => setHookForm({ ...hookForm, url: event.target.value })} /></Field>
            <Field label="Description" optional><Input value={hookForm.description} maxLength={200} onChange={(event) => setHookForm({ ...hookForm, description: event.target.value })} /></Field>
            <Field label="Events">
              <div className="grid gap-2 sm:grid-cols-2">{catalogue?.events.map((event) => <Checkbox key={event} label={event} checked={hookForm.events.includes(event)} onChange={() => setHookForm({ ...hookForm, events: toggle(hookForm.events, event) })} />)}</div>
            </Field>
          </div>
        )}
      </Dialog>

      <Dialog open={deliveries !== null} onClose={() => setDeliveries(null)} size="lg" title={deliveries ? `Deliveries · ${deliveries.hook.url}` : "Deliveries"} footer={<Button variant="secondary" onClick={() => setDeliveries(null)}>Close</Button>}>
        {deliveries && (deliveries.rows.length === 0 ? <p className="text-support text-ink-muted">Nothing sent yet.</p> : (
          <ul className="max-h-[55vh] divide-y divide-line-soft overflow-y-auto">
            {deliveries.rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span><span className="font-medium text-ink-strong">{row.event}</span><span className="block text-caption text-ink-muted">{formatDateTime(row.created_at)} · {row.attempts} attempt{row.attempts === 1 ? "" : "s"}{row.last_error ? ` · ${row.last_error}` : ""}{row.next_attempt_at ? ` · next try ${formatDateTime(row.next_attempt_at)}` : ""}</span></span>
                <span className="flex items-center gap-2"><Badge size="sm" tone={row.status === "SUCCEEDED" ? "success" : row.status === "FAILED" ? "danger" : "warning"}>{row.status === "SUCCEEDED" ? "Delivered" : row.status === "FAILED" ? "Failed" : "Retrying"}</Badge>{row.status === "FAILED" && <Button size="sm" variant="ghost" onClick={() => void integrationsApi.retryDelivery(deliveries.hook.id, row.id).then(async () => setDeliveries({ hook: deliveries.hook, rows: await integrationsApi.webhookDeliveries(deliveries.hook.id) })).catch((caught) => setActionError(getApiErrorMessage(caught)))}>Retry</Button>}</span>
              </li>
            ))}
          </ul>
        ))}
      </Dialog>

      {secret && <SecretOnce label={secret.label} value={secret.value} onDone={() => setSecret(null)} />}
    </div>
  );
}
