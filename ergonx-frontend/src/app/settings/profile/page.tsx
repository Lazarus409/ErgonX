"use client";

import { useCallback, useState } from "react";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { getApiErrorMessage, institutionsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

export default function ProfileSettingsPage() {
  const load = useCallback(() => institutionsApi.listMyPreferences(), []); const { data, loading, error, reload } = useApiResource(load); const [key, setKey] = useState(""); const [value, setValue] = useState("{}"); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState<string | null>(null);
  const save = async (event: React.FormEvent) => { event.preventDefault(); try { const parsed = JSON.parse(value) as Record<string, unknown>; if (!key.trim() || saving) { setSaveError("Preference key is required."); return; } setSaving(true); setSaveError(null); await institutionsApi.savePreference(key.trim(), parsed); setKey(""); setValue("{}"); reload(); } catch (caught) { setSaveError(caught instanceof SyntaxError ? "Value must be valid JSON." : getApiErrorMessage(caught)); } finally { setSaving(false); } };
  if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error ?? "Unable to load preferences."} onRetry={reload} />; return <div className="space-y-6"><PageHeader title="Personal Preferences" description="Preferences belong to your user account in the active institution." /><form onSubmit={save} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-[1fr_2fr_auto]"><input value={key} onChange={(event) => setKey(event.target.value)} placeholder="Preference key" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /><input value={value} onChange={(event) => setValue(event.target.value)} placeholder='{"value": true}' className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono" /><button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">{saving ? "Saving…" : "Save"}</button>{saveError && <p className="text-sm text-red-600 md:col-span-3">{saveError}</p>}</form><div className="rounded-2xl border border-slate-200 bg-white"><div className="divide-y divide-slate-100">{data.length === 0 ? <p className="p-6 text-sm text-slate-500">No preferences saved.</p> : data.map((item) => <div key={item.id} className="p-5"><p className="font-medium text-slate-900">{item.preference_key}</p><pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(item.value_json, null, 2)}</pre></div>)}</div></div></div>;
}
