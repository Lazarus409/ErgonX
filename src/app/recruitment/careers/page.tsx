"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ExternalLink, Globe } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Switch, Textarea } from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import { careersApi, getApiErrorMessage } from "@/lib/api";
import type { CareersSiteSettings } from "@/lib/api/careers";
import { useAccess } from "@/lib/access";
import { useApiResource } from "@/lib/useApiResource";

/** HR's public careers site: address, wording and privacy notice. Jobs appear once marked public. */
export default function CareersSettingsPage() {
  const { showToast } = useToast();
  const canEdit = useAccess().can("job_posting.update");
  const load = useCallback(() => careersApi.getCareersSettings(), []);
  const { data, error } = useApiResource(load);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Recruitment"
        title="Careers site"
       
        icon={Globe}
        accent="recruitment"
      />
      {error && <Alert tone="danger">{error}</Alert>}
      {data && <SettingsForm initial={data} canEdit={canEdit} onSaved={() => showToast({ tone: "success", message: "Careers site saved." })} />}
    </div>
  );
}

function SettingsForm({ initial, canEdit, onSaved }: { initial: CareersSiteSettings; canEdit: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({ slug: initial.slug, is_enabled: initial.is_enabled, headline: initial.headline, introduction: initial.introduction, privacy_notice: initial.privacy_notice });
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const publicUrl = `${origin}/careers/${saved.slug}`;

  const save = async () => {
    if (form.is_enabled && !form.privacy_notice.trim()) { setFormError("Add a privacy notice before switching the site on: applicants must know how their data is used."); return; }
    setSaving(true); setFormError("");
    try { setSaved(await careersApi.saveCareersSettings(form)); onSaved(); }
    catch (caught) { setFormError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };

  return (
    <Card title="Settings" icon={Globe} accent="recruitment" actions={saved.exists && saved.is_enabled ? <Link href={`/careers/${saved.slug}`} target="_blank" className="inline-flex items-center gap-1 text-support font-semibold text-primary-ink hover:underline">Open site<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Link> : undefined}>
      <div className="space-y-4">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Switch checked={form.is_enabled} onChange={(checked) => setForm({ ...form, is_enabled: checked })} label="Careers site is live" description={saved.exists && saved.is_enabled ? publicUrl : "Switched off: the public address shows nothing."} disabled={!canEdit} />
        <Field label="Web address" helper={`${origin}/careers/${form.slug || "…"}`}><Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} maxLength={60} disabled={!canEdit} /></Field>
        <Field label="Headline" optional><Input value={form.headline} maxLength={150} onChange={(event) => setForm({ ...form, headline: event.target.value })} placeholder="e.g. Build Ghana's energy future with us" disabled={!canEdit} /></Field>
        <Field label="Introduction" optional><Textarea rows={4} maxLength={3000} value={form.introduction} onChange={(event) => setForm({ ...form, introduction: event.target.value })} disabled={!canEdit} /></Field>
        <Field label="Privacy notice" required={form.is_enabled} helper="Shown next to the consent box: what you collect, why, who sees it and how long you keep it (Data Protection Act, 2012).">
          <Textarea rows={4} maxLength={4000} value={form.privacy_notice} onChange={(event) => setForm({ ...form, privacy_notice: event.target.value })} disabled={!canEdit} />
        </Field>
        {canEdit && <div className="flex justify-end"><Button loading={saving} onClick={() => void save()}>Save</Button></div>}
      </div>
    </Card>
  );
}
