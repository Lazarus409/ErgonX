"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe2, Sparkles } from "lucide-react";

import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { getApiErrorMessage, institutionsApi } from "@/lib/api";
import type { InstitutionProfilePayload } from "@/lib/api/institutions";
import { useApiResource } from "@/lib/useApiResource";

const countryOptions = [
  { value: "GH", label: "Ghana (GH)", currency: "GHS", timezone: "Africa/Accra" },
  { value: "NG", label: "Nigeria (NG)", currency: "NGN", timezone: "Africa/Lagos" },
  { value: "KE", label: "Kenya (KE)", currency: "KES", timezone: "Africa/Nairobi" },
  { value: "ZA", label: "South Africa (ZA)", currency: "ZAR", timezone: "Africa/Johannesburg" },
  { value: "UG", label: "Uganda (UG)", currency: "UGX", timezone: "Africa/Kampala" },
  { value: "TZ", label: "Tanzania (TZ)", currency: "TZS", timezone: "Africa/Dar_es_Salaam" },
  { value: "RW", label: "Rwanda (RW)", currency: "RWF", timezone: "Africa/Kigali" },
  { value: "GB", label: "United Kingdom (GB)", currency: "GBP", timezone: "Europe/London" },
  { value: "US", label: "United States (US)", currency: "USD", timezone: "America/New_York" },
  { value: "CA", label: "Canada (CA)", currency: "CAD", timezone: "America/Toronto" },
  { value: "AE", label: "United Arab Emirates (AE)", currency: "AED", timezone: "Asia/Dubai" },
  { value: "IN", label: "India (IN)", currency: "INR", timezone: "Asia/Kolkata" },
  { value: "AU", label: "Australia (AU)", currency: "AUD", timezone: "Australia/Sydney" },
];

const currencyOptions = [
  ["GHS", "Ghanaian cedi (GHS)"], ["NGN", "Nigerian naira (NGN)"], ["KES", "Kenyan shilling (KES)"],
  ["ZAR", "South African rand (ZAR)"], ["UGX", "Ugandan shilling (UGX)"], ["TZS", "Tanzanian shilling (TZS)"],
  ["RWF", "Rwandan franc (RWF)"], ["USD", "US dollar (USD)"], ["GBP", "Pound sterling (GBP)"],
  ["EUR", "Euro (EUR)"], ["CAD", "Canadian dollar (CAD)"], ["AED", "UAE dirham (AED)"],
  ["INR", "Indian rupee (INR)"], ["AUD", "Australian dollar (AUD)"], ["JPY", "Japanese yen (JPY)"],
] as const;

const timezoneOptions = [
  ["Africa/Accra", "Accra (GMT)"], ["Africa/Lagos", "Lagos (WAT)"], ["Africa/Nairobi", "Nairobi (EAT)"],
  ["Africa/Johannesburg", "Johannesburg (SAST)"], ["Africa/Kampala", "Kampala (EAT)"], ["Africa/Dar_es_Salaam", "Dar es Salaam (EAT)"],
  ["Africa/Kigali", "Kigali (CAT)"], ["Europe/London", "London (GMT/BST)"], ["Europe/Paris", "Paris (CET/CEST)"],
  ["America/New_York", "New York (ET)"], ["America/Chicago", "Chicago (CT)"], ["America/Los_Angeles", "Los Angeles (PT)"],
  ["America/Toronto", "Toronto (ET)"], ["Asia/Dubai", "Dubai (GST)"], ["Asia/Kolkata", "India (IST)"],
  ["Asia/Singapore", "Singapore (SGT)"], ["Australia/Sydney", "Sydney (AEST/AEDT)"],
] as const;

export default function OnboardingProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<InstitutionProfilePayload>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const load = useCallback(() => institutionsApi.getCurrentInstitution(), []);
  const { data, loading, error, reload } = useApiResource(load);

  const update = (key: keyof InstitutionProfilePayload, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateCountry = (countryCode: string) => {
    const locale = countryOptions.find((country) => country.value === countryCode);
    setForm((current) => ({
      ...current,
      country_code: countryCode,
      ...(locale ? { default_currency: locale.currency, timezone: locale.timezone } : {}),
    }));
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await institutionsApi.updateCurrentInstitution({
        name: form.name ?? data?.institution.name,
        email: form.email ?? data?.institution.email,
        phone: form.phone ?? data?.institution.phone,
        address: form.address ?? data?.institution.address,
        country_code: form.country_code ?? data?.institution.country_code,
        default_currency: form.default_currency ?? data?.institution.default_currency,
        timezone: form.timezone ?? data?.institution.timezone,
      });
      await institutionsApi.validateInstitutionOnboarding();
      router.replace("/onboarding");
    } catch (caught) {
      setSaveError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? "Could not load the institution profile."} onRetry={reload} />;

  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"><PageHeader title="Institution profile" description="Set the organization details that tailor ErgonX to your location and operations." actions={<Link href="/onboarding" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">Back to setup</Link>} />{saveError && <ErrorState title="Could not save the profile" message={saveError} />}<section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]"><div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-sky-50/50 px-6 py-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm"><Building2 className="h-5 w-5" /></div><div><h2 className="text-base font-semibold text-slate-950">Organization details</h2><p className="mt-1 text-sm text-slate-500">Contact information and operating location.</p></div></div><div className="inline-flex items-center gap-2 self-start rounded-full border border-sky-100 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 sm:self-auto"><Sparkles className="h-3.5 w-3.5" />You can update this anytime</div></div><div className="p-6 sm:p-8"><div className="grid gap-x-6 gap-y-5 sm:grid-cols-2"><Field label="Organization name" value={form.name ?? data.institution.name ?? ""} onChange={(value) => update("name", value)} /><Field label="Institution email" type="email" value={form.email ?? data.institution.email ?? ""} onChange={(value) => update("email", value)} /><SelectField label="Country or region" value={form.country_code ?? data.institution.country_code ?? "GH"} options={countryOptions.map(({ value, label }) => [value, label])} onChange={updateCountry} /><SelectField label="Default currency" value={form.default_currency ?? data.institution.default_currency ?? "GHS"} options={currencyOptions} onChange={(value) => update("default_currency", value)} /><SelectField label="Timezone" value={form.timezone ?? data.institution.timezone ?? "Africa/Accra"} options={timezoneOptions} onChange={(value) => update("timezone", value)} /><Field label="Phone (optional)" value={form.phone ?? data.institution.phone ?? ""} onChange={(value) => update("phone", value)} /><div className="sm:col-span-2"><Field label="Address (optional)" value={form.address ?? data.institution.address ?? ""} onChange={(value) => update("address", value)} /></div></div><div className="mt-7 flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-slate-600"><Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" /><p>Choose a country to suggest its local currency and timezone. You can refine either setting before saving.</p></div><div className="mt-8 flex justify-end border-t border-slate-100 pt-6"><button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.14)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save profile"}</button></div></div></section></main>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) {
  const knownValue = options.some(([optionValue]) => optionValue === value);
  return <label className="block text-sm font-semibold text-slate-700">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100">{!knownValue && <option value={value}>{value}</option>}{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
