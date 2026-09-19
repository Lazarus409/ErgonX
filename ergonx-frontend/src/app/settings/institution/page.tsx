"use client";

import { useCallback, useState } from "react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { getApiErrorMessage, institutionsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { InstitutionSetting } from "@/types/institutions";

function valueToJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function InstitutionSettingsPage() {
  const load = useCallback(() => institutionsApi.listInstitutionSettings(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const [editing, setEditing] = useState<InstitutionSetting | null | undefined>(undefined);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setKey("");
    setValue("{}");
    setActionError(null);
  };
  const openEdit = (setting: InstitutionSetting) => {
    setEditing(setting);
    setKey(setting.key);
    setValue(valueToJson(setting.value));
    setActionError(null);
  };
  const requestSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!key.trim()) {
      setActionError("A setting key is required.");
      return;
    }
    try {
      JSON.parse(value);
      setActionError(null);
      setConfirming(true);
    } catch {
      setActionError("Setting value must be valid JSON.");
    }
  };
  const save = async () => {
    setSaving(true);
    setActionError(null);
    try {
      await institutionsApi.saveInstitutionSetting(key.trim(), JSON.parse(value) as unknown);
      setConfirming(false);
      setEditing(undefined);
      reload();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error || !data) {
    return <ErrorState message={error ?? "You may not have permission to view institution settings."} onRetry={reload} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institution Settings"
        description="Only non-sensitive settings exposed by the backend are displayed. Editing requires institution-settings permission."
      />

      <div className="flex justify-end">
        <button onClick={openCreate} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Add setting</button>
      </div>

      {editing !== undefined && (
        <form onSubmit={requestSave} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-semibold text-slate-900">{editing ? `Edit ${editing.key}` : "Add institution setting"}</h2><p className="mt-1 text-sm text-slate-500">Values are sent as structured JSON and validated by the backend.</p></div>
            <button type="button" onClick={() => setEditing(undefined)} className="text-sm font-medium text-slate-600">Cancel</button>
          </div>
          <label className="mt-5 block text-sm font-medium text-slate-700">Setting key<input value={key} disabled={Boolean(editing)} onChange={(event) => setKey(event.target.value)} placeholder="example.feature" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 disabled:bg-slate-100" /></label>
          <label className="mt-4 block text-sm font-medium text-slate-700">JSON value<textarea value={value} onChange={(event) => setValue(event.target.value)} rows={8} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm" /></label>
          {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}
          <div className="mt-5 flex justify-end"><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Review changes</button></div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white"><div className="divide-y divide-slate-100">{data.length === 0 ? <p className="p-6 text-sm text-slate-500">No institution settings are available for your role.</p> : data.map((item) => <div key={item.id} className="flex items-start gap-4 p-5"><div className="min-w-0 flex-1"><p className="font-medium text-slate-900">{item.key}</p><pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{valueToJson(item.value)}</pre><p className="mt-2 text-xs text-slate-400">Updated {new Date(item.updated_at).toLocaleString()}</p></div><button onClick={() => openEdit(item)} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Edit</button></div>)}</div></div>

      <ConfirmDialog open={confirming} title={editing ? "Update institution setting?" : "Add institution setting?"} description="This changes a non-sensitive setting for the selected institution. The backend remains authoritative for validation and access control." confirmLabel={editing ? "Update setting" : "Add setting"} loading={saving} onConfirm={() => void save()} onCancel={() => setConfirming(false)} />
    </div>
  );
}
