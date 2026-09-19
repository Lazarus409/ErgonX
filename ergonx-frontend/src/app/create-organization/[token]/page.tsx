"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/components/guards/AuthProvider";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
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

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState title="Invitation unavailable" message={error ?? "This invitation is invalid or expired."} onRetry={reload} />;

  return <main className="min-h-screen bg-slate-50 px-6 py-10"><form onSubmit={submit} className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Institution Admin invitation</p><h1 className="mt-3 text-3xl font-semibold text-slate-950">Create your organization</h1><p className="mt-3 text-sm text-slate-600">You were invited as the first administrator for <span className="font-semibold">{data.email}</span>. Completing this form creates your organization and signs you in.</p>{saveError && <ErrorState title="Could not create the organization" message={saveError} />}<div className="mt-7 grid gap-4 sm:grid-cols-2"><Field label="Organization name" value={form.institution_name} onChange={(value) => update("institution_name", value)} className="sm:col-span-2" /><Field label="First name" value={form.first_name} onChange={(value) => update("first_name", value)} /><Field label="Last name" value={form.last_name} onChange={(value) => update("last_name", value)} /><Field label="Work email" value={data.email} disabled className="sm:col-span-2" /><Field label="Create password" type="password" value={form.password} onChange={(value) => update("password", value)} className="sm:col-span-2" /></div><button disabled={saving} className="mt-7 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Creating organization..." : "Create organization and continue"}</button></form></main>;
}

function Field({ label, value, onChange, type = "text", className = "", disabled = false }: { label: string; value: string; onChange?: (value: string) => void; type?: string; className?: string; disabled?: boolean }) {
  return <label className={`space-y-1 ${className}`}><span className="text-sm font-medium text-slate-700">{label}</span><input required={!disabled} disabled={disabled} minLength={type === "password" ? 8 : undefined} type={type} value={value} onChange={(event) => onChange?.(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100" /></label>;
}
