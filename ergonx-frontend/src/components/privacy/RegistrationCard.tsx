"use client";

import { useState } from "react";
import { BadgeCheck, Save } from "lucide-react";

import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { getApiErrorMessage, privacyApi } from "@/lib/api";
import type { PrivacyProfile } from "@/lib/api/privacy";

type Form = Omit<PrivacyProfile, "compliance">;

/** Data Protection Commission registration and the organisation's data protection officer. */
export default function RegistrationCard({ profile, canManage, onSaved }: { profile: PrivacyProfile; canManage: boolean; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(() => ({
    registration_number: profile.registration_number, registered_on: profile.registered_on, registration_expires_on: profile.registration_expires_on,
    officer_name: profile.officer_name, officer_email: profile.officer_email, officer_phone: profile.officer_phone,
  }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const set = (update: Partial<Form>) => setForm({ ...form, ...update });
  const save = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      await privacyApi.updatePrivacyProfile({ ...form, registered_on: form.registered_on || null, registration_expires_on: form.registration_expires_on || null });
      setMessage("Saved."); onSaved();
    } catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };
  return (
    <Card title="Registration and data protection officer" icon={BadgeCheck} accent="audit">
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {message && <Alert tone="success" className="mb-4" onDismiss={() => setMessage("")}>{message}</Alert>}
      <fieldset disabled={!canManage || busy} className="grid gap-4 sm:grid-cols-3">
        <Field label="Data Protection Commission registration number"><Input value={form.registration_number} maxLength={60} onChange={(event) => set({ registration_number: event.target.value })} /></Field>
        <Field label="Registered on"><Input type="date" value={form.registered_on ?? ""} onChange={(event) => set({ registered_on: event.target.value || null })} /></Field>
        <Field label="Renewal due"><Input type="date" value={form.registration_expires_on ?? ""} onChange={(event) => set({ registration_expires_on: event.target.value || null })} /></Field>
        <Field label="Data protection officer"><Input value={form.officer_name} maxLength={150} onChange={(event) => set({ officer_name: event.target.value })} /></Field>
        <Field label="Officer email"><Input type="email" value={form.officer_email} onChange={(event) => set({ officer_email: event.target.value })} /></Field>
        <Field label="Officer phone" optional><Input type="tel" value={form.officer_phone} maxLength={30} onChange={(event) => set({ officer_phone: event.target.value })} /></Field>
      </fieldset>
      {canManage && <div className="mt-5 flex justify-end"><Button loading={busy} leadingIcon={<Save className="h-4 w-4" />} onClick={() => void save()}>Save</Button></div>}
    </Card>
  );
}
