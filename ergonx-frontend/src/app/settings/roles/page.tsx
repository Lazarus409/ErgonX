"use client";

import { useCallback, useState } from "react";
import { FileCheck2, Info, LayoutGrid, Lock, Plus, UsersRound, X } from "lucide-react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, institutionsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { InstitutionRole } from "@/types/institutions";
import { buttonClasses } from "@/components/ui/Button";

function moduleLabel(code: string): string {
  return code.replaceAll("_", " ");
}

export default function RoleSettingsPage() {
  const [editorRole, setEditorRole] = useState<InstitutionRole | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [permissionCodes, setPermissionCodes] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const load = useCallback(
    async () => {
      const [roles, permissions] = await Promise.all([
        institutionsApi.listInstitutionRoles(),
        institutionsApi.listPermissionCatalog(),
      ]);

      return { roles: roles.results, permissions };
    },
    [],
  );
  const { data, loading, error, reload } = useApiResource(load);

  if (loading) return <LoadingState />;
  if (error || !data) {
    return <ErrorState message={error ?? "You may not have permission to review roles."} onRetry={reload} />;
  }

  const openCreate = () => {
    setEditorRole(null); setName(""); setCode(""); setDescription(""); setPermissionCodes([]); setIsActive(true); setActionError(null);
  };
  const openEdit = (role: InstitutionRole) => {
    setEditorRole(role); setName(role.name); setCode(role.code); setDescription(role.description); setPermissionCodes(role.permissions); setIsActive(role.is_active); setActionError(null);
  };
  const togglePermission = (permissionCode: string) => {
    setPermissionCodes((current) => current.includes(permissionCode) ? current.filter((item) => item !== permissionCode) : [...current, permissionCode]);
  };
  const requestSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || (editorRole === null && !code.trim())) { setActionError("Role name and code are required."); return; }
    setConfirming(true);
  };
  const save = async () => {
    setSaving(true); setActionError(null);
    try {
      if (editorRole === null) {
        await institutionsApi.createInstitutionRole({ code: code.trim().toUpperCase(), name: name.trim(), description: description.trim(), permission_codes: permissionCodes });
      } else if (editorRole) {
        await institutionsApi.updateInstitutionRole(editorRole.id, { name: name.trim(), description: description.trim(), permission_codes: permissionCodes, is_active: isActive });
      }
      setConfirming(false); setEditorRole(undefined); reload();
    } catch (caught) { setActionError(getApiErrorMessage(caught)); setConfirming(false); } finally { setSaving(false); }
  };

  const permissionGroups = data.permissions.reduce<Record<string, number>>(
    (groups, permission) => {
      groups[permission.module_code] = (groups[permission.module_code] ?? 0) + 1;
      return groups;
    },
    {},
  );

  const permissionsByModule = data.permissions.reduce<Record<string, typeof data.permissions>>((groups, permission) => {
    (groups[permission.module_code] ??= []).push(permission);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Create and maintain custom roles. Reserved system roles remain protected by the backend."
        actions={<button onClick={openCreate} className={buttonClasses({ variant: "primary", size: "lg" })}><Plus className="h-5 w-5" aria-hidden="true" />Create custom role</button>}
      />

      {editorRole !== undefined && (
        <form onSubmit={requestSave} className="rounded-2xl border border-line bg-surface p-5 shadow-elevation-1 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden="true"><UsersRound className="h-7 w-7" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-heading font-bold text-headline">{editorRole ? `Edit ${editorRole.name}` : "Create custom role"}</h2>
                  <span className="rounded-full bg-mod-recruitment-soft px-2.5 py-0.5 text-caption font-semibold text-mod-recruitment">Custom role</span>
                </div>
                <p className="mt-0.5 text-support text-heading-support">Only custom roles can be changed after creation.</p>
              </div>
            </div>
            <button type="button" onClick={() => setEditorRole(undefined)} className="rounded-lg p-2 text-ink-muted hover:bg-surface-hover hover:text-ink-strong" aria-label="Cancel"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold text-ink-strong">Role name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-line-strong px-3 font-normal" /></label><label className="text-sm font-semibold text-ink-strong">Role code<input value={code} disabled={Boolean(editorRole)} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="PEOPLE_MANAGER" className="mt-1.5 h-10 w-full rounded-lg border border-line-strong px-3 font-normal disabled:bg-surface-muted" /></label><label className="text-sm font-semibold text-ink-strong md:col-span-2">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface-muted/50 px-3 py-2.5 font-normal" /></label></div>
          {editorRole && <label className="mt-4 inline-flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Active role</label>}
          <fieldset className="mt-6">
            <legend className="flex items-start gap-3">
              <LayoutGrid className="mt-0.5 h-6 w-6 text-section-icon" aria-hidden="true" />
              <span>
                <span className="block text-card-title font-bold text-headline">Permissions</span>
                <span className="block text-support text-heading-support">{permissionCodes.length} of {data.permissions.length} selected, grouped by module.</span>
              </span>
            </legend>
            <div className="mt-4 max-h-[28rem] divide-y divide-line-soft overflow-auto rounded-xl border border-line">
              {Object.entries(permissionsByModule).map(([module, permissions]) => {
                const selected = permissions.filter((permission) => permissionCodes.includes(permission.code)).length;
                return (
                  <div key={module} className="p-4">
                    <p className="mb-2 flex items-center justify-between gap-3"><span className="font-semibold text-headline">{module.length <= 3 ? module : moduleLabel(module).toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())}</span><span className="text-caption text-ink-muted">{selected}/{permissions.length}</span></p>
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {permissions.map((permission) => <label key={permission.code} className="flex items-start gap-2.5 rounded-lg p-2 text-sm text-ink hover:bg-surface-hover"><input type="checkbox" checked={permissionCodes.includes(permission.code)} onChange={() => togglePermission(permission.code)} className="mt-1 h-4 w-4" /><span><span className="block font-medium text-ink-strong">{permission.name}</span><span className="text-xs text-ink-muted">{permission.code}</span></span></label>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary-soft/70 px-4 py-3 text-support text-ink"><Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />Permission changes are confirmed before they apply to memberships using this role.</div>
          {actionError && <p className="mt-3 text-sm text-danger-ink">{actionError}</p>}
          <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setEditorRole(undefined)} className={buttonClasses({ variant: "secondary", size: "lg" })}>Cancel</button><button className={buttonClasses({ variant: "primary", size: "lg" })}><FileCheck2 className="h-5 w-5" aria-hidden="true" />Review changes</button></div>
        </form>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-elevation-1">
        <div className="flex items-start gap-3 border-b border-line-soft px-5 py-4">
          <UsersRound className="mt-0.5 h-6 w-6 text-section-icon" aria-hidden="true" />
          <div>
            <h2 className="text-card-title font-bold text-headline">Institution roles</h2>
            <p className="mt-0.5 text-support text-heading-support">{data.roles.length} role{data.roles.length === 1 ? "" : "s"} available in this institution.</p>
          </div>
        </div>
        {data.roles.length === 0 ? (
          <EmptyState size="compact" title="No roles found" description="Roles created for this institution will appear here." />
        ) : (
          <div className="divide-y divide-line-soft">
            {data.roles.map((role) => (
              <div key={role.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-headline">{role.name}</p>
                    <StatusBadge status={role.is_active ? "ACTIVE" : "INACTIVE"} />
                    {role.is_system_role && <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-0.5 text-caption font-semibold text-ink-muted"><Lock className="h-3 w-3" aria-hidden="true" />System role (read-only)</span>}
                    {role.is_custom && <span className="rounded-full bg-mod-recruitment-soft px-2.5 py-0.5 text-caption font-semibold text-mod-recruitment">Custom role</span>}
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{role.description || role.code}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3"><span className="text-sm text-ink-muted">{role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}</span>{role.is_custom && <button onClick={() => openEdit(role)} className={buttonClasses({ variant: "secondary", size: "sm" })}>Edit</button>}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog open={confirming} title={editorRole ? "Update custom role?" : "Create custom role?"} description={editorRole ? "The selected permissions and status will immediately apply to memberships using this custom role." : "The new role will be available for institution membership assignment."} confirmLabel={editorRole ? "Update role" : "Create role"} loading={saving} onConfirm={() => void save()} onCancel={() => setConfirming(false)} />

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-elevation-1">
        <h2 className="text-card-title font-bold text-headline">Permission catalogue</h2>
        <p className="mt-1 text-sm text-ink-muted">Available permissions by module. This is read-only so current access can be reviewed safely.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(permissionGroups).map(([module, count]) => (
            <span key={module} className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary-ink">
              {moduleLabel(module)} · {count}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
