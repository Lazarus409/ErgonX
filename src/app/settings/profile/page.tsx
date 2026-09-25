"use client";

import { Check, Pin, Save } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { getApiErrorMessage, homeApi, institutionsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import { buttonClasses } from "@/components/ui/Button";

type PreferenceData = Awaited<ReturnType<typeof institutionsApi.listMyPreferences>>;

function pinnedCodes(preferences: PreferenceData): string[] {
  const preference = preferences.find((item) => item.preference_key === "quick_actions");
  const value = preference?.value_json.pinned;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Settings only exposes preferences that currently drive server-owned behavior. */
export default function ProfileSettingsPage() {
  const load = useCallback(async () => {
    const [preferences, home] = await Promise.all([
      institutionsApi.listMyPreferences(),
      homeApi.getHome(),
    ]);
    return { preferences, actions: home.quick_actions };
  }, []);
  const { data, loading, error, reload } = useApiResource(load);
  const initialPinned = useMemo(() => data ? pinnedCodes(data.preferences) : [], [data]);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const pinned = selected ?? initialPinned;

  const toggle = (code: string) => {
    setSaved(false);
    setSelected((current) => {
      const source = current ?? initialPinned;
      return source.includes(code) ? source.filter((item) => item !== code) : [...source, code];
    });
  };

  const save = async () => {
    setSaving(true); setSaveError(null); setSaved(false);
    try {
      await institutionsApi.savePreference("quick_actions", { pinned });
      setSelected(null); setSaved(true); await reload();
    } catch (caught) { setSaveError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState title="Unable to load personal preferences" message={error ?? "Your preferences could not be loaded."} onRetry={reload} />;
  const legacyPreferences = data.preferences.filter((item) => item.preference_key !== "quick_actions");

  return <div className="mx-auto max-w-4xl space-y-6"><PageHeader title="Personal Preferences" description="Preferences apply only to you in the active institution." />
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink"><Pin size={19} /></span><div><h2 className="font-semibold text-ink-strong">Home quick actions</h2><p className="mt-1 text-sm leading-6 text-ink-muted">Pin the server-authorized actions you want prioritized on Home. Actions remain permission- and module-aware.</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{data.actions.map((action) => { const checked = pinned.includes(action.code); return <button key={action.code} type="button" onClick={() => toggle(action.code)} aria-pressed={checked} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${checked ? "border-primary bg-primary-soft ring-1 ring-primary/20" : "border-line hover:border-line-strong hover:bg-surface-hover"}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-primary bg-primary text-white" : "border-line-strong bg-surface"}`}>{checked && <Check size={14} strokeWidth={3} />}</span><span><span className="block text-sm font-semibold text-ink-strong">{action.label}</span><span className="mt-0.5 block text-xs text-ink-muted">Available to your active role</span></span></button>; })}</div>{data.actions.length === 0 && <p className="mt-5 rounded-xl bg-surface-muted p-4 text-sm text-ink-muted">No quick actions are currently authorized for your active role.</p>}<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-5"><p className="text-xs text-ink-muted">Pinned actions appear first; unpinned actions remain available when authorized.</p><button type="button" disabled={saving || selected === null} onClick={() => void save()} className={buttonClasses({ variant: "primary" })}><Save size={16} />{saving ? "Saving…" : "Save preferences"}</button></div>{saveError && <p className="mt-4 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger-ink">{saveError}</p>}{saved && <p className="mt-4 rounded-xl border border-success/25 bg-success-soft p-3 text-sm text-success-ink">Your quick-action preferences were saved.</p>}</section>
    {legacyPreferences.length > 0 && <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="font-semibold text-ink-strong">Stored preferences</h2><p className="mt-1 text-sm text-ink-muted">These older preference values are retained without changing their meaning. They are not editable until a supported product control exists.</p><div className="mt-5 divide-y divide-line-soft">{legacyPreferences.map((item) => <div key={item.id} className="py-4 first:pt-0"><p className="text-sm font-medium text-ink-strong">{item.preference_key.replaceAll("_", " ")}</p><pre className="mt-2 overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs text-ink-muted">{JSON.stringify(item.value_json, null, 2)}</pre></div>)}</div></section>}
  </div>;
}
