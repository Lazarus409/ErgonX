"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import AuthShell, { AuthHeading } from "@/components/brand/AuthShell";
import { useAuth } from "@/components/guards/AuthProvider";
import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Input } from "@/components/ui/Field";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { authApi, getApiErrorMessage } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

export default function CreateOrganizationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [form, setForm] = useState({ institution_name: "", first_name: "", last_name: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const load = useCallback(() => authApi.getInstitutionAdminInvitation(token), [token]);
  const { data, loading, error, reload } = useApiResource(load);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setSaveError(null);
    try {
      await authApi.acceptInstitutionAdminInvitation(token, { ...form, institution_name: form.institution_name.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim(), country_code: "GH", default_currency: "GHS", timezone: "Africa/Accra" });
      await refreshSession();
      router.replace("/onboarding");
    } catch (caught) { setSaveError(getApiErrorMessage(caught)); } finally { setSaving(false); }
  };

  return (
    <AuthShell width="lg">
      {loading ? (
        <FormSkeleton fields={5} label="Loading invitation" />
      ) : error || !data ? (
        <ErrorState title="Invitation unavailable" message={error ?? "This invitation is invalid or expired."} onRetry={reload} />
      ) : (
        <form onSubmit={submit}>
          <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary" aria-hidden="true"><Building2 className="h-6 w-6" /></span>
          <AuthHeading eyebrow="Institution Admin invitation" title="Create your organization" description={<>You were invited as the first administrator for <span className="font-semibold text-ink-strong">{data.email}</span>. Completing this form creates your organization and signs you in.</>} />
          {saveError && <Alert tone="danger" title="Could not create the organization" className="mb-5">{saveError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organization name" required className="sm:col-span-2"><Input value={form.institution_name} onChange={(event) => update("institution_name", event.target.value)} /></Field>
            <Field label="First name" required><Input value={form.first_name} onChange={(event) => update("first_name", event.target.value)} autoComplete="given-name" /></Field>
            <Field label="Last name" required><Input value={form.last_name} onChange={(event) => update("last_name", event.target.value)} autoComplete="family-name" /></Field>
            <Field label="Work email" className="sm:col-span-2"><Input value={data.email} disabled /></Field>
            <Field label="Create password" required helper="At least 8 characters." className="sm:col-span-2"><Input type="password" minLength={8} value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete="new-password" /></Field>
          </div>
          <Button type="submit" size="lg" block className="mt-7" loading={saving} loadingLabel="Creating organization…">Create organization and continue</Button>
        </form>
      )}
    </AuthShell>
  );
}
