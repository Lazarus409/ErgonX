"use client";

import { useCallback, useState } from "react";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Create and maintain custom roles. Reserved system roles remain protected by the backend."
      />

      <div className="flex justify-end"><button onClick={openCreate} className={buttonClasses({ variant: "primary" })}>Create custom role</button></div>

      {editorRole !== undefined && (
        <form onSubmit={requestSave} className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-ink-strong">{editorRole ? `Edit ${editorRole.name}` : "Create custom role"}</h2><p className="mt-1 text-sm text-ink-muted">Only custom roles can be changed after creation.</p></div><button type="button" onClick={() => setEditorRole(undefined)} className="text-sm font-medium text-ink-muted">Cancel</button></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-ink">Role name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full h-9 rounded-lg border border-line-strong px-3" /></label><label className="text-sm font-medium text-ink">Role code<input value={code} disabled={Boolean(editorRole)} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="PEOPLE_MANAGER" className="mt-1 w-full h-9 rounded-lg border border-line-strong px-3 disabled:bg-surface-muted" /></label><label className="text-sm font-medium text-ink md:col-span-2">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2.5" /></label></div>
          {editorRole && <label className="mt-4 inline-flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Active role</label>}
          <fieldset className="mt-5"><legend className="text-sm font-semibold text-ink-strong">Permissions</legend><div className="mt-3 grid max-h-64 gap-2 overflow-auto rounded-xl border border-line p-3 sm:grid-cols-2 lg:grid-cols-3">{data.permissions.map((permission) => <label key={permission.code} className="flex items-start gap-2 rounded-lg p-2 text-sm text-ink hover:bg-surface-hover"><input type="checkbox" checked={permissionCodes.includes(permission.code)} onChange={() => togglePermission(permission.code)} className="mt-1" /><span><span className="block font-medium">{permission.name}</span><span className="text-xs text-ink-muted">{permission.code}</span></span></label>)}</div></fieldset>
          {actionError && <p className="mt-3 text-sm text-danger-ink">{actionError}</p>}<div className="mt-5 flex justify-end"><button className={buttonClasses({ variant: "primary" })}>Review changes</button></div>
        </form>
      )}

      <section className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line-soft px-5 py-4">
          <h2 className="font-semibold text-ink-strong">Institution roles</h2>
          <p className="mt-1 text-sm text-ink-muted">{data.roles.length} role{data.roles.length === 1 ? "" : "s"} available in this institution.</p>
        </div>
        {data.roles.length === 0 ? (
          <EmptyState title="No roles found" description="Roles created for this institution will appear here." />
        ) : (
          <div className="divide-y divide-line-soft">
            {data.roles.map((role) => (
              <div key={role.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink-strong">{role.name}</p>
                    <StatusBadge status={role.is_active ? "ACTIVE" : "INACTIVE"} />
                    {role.is_system_role && <span className="text-xs font-medium text-ink-muted">System role</span>}
                    {role.is_custom && <span className="text-xs font-medium text-ink-muted">Custom role</span>}
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{role.description || role.code}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3"><span className="text-sm text-ink-muted">{role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}</span>{role.is_custom && <button onClick={() => openEdit(role)} className="rounded-lg border border-line-strong px-3 py-2 text-sm font-medium text-ink">Edit</button>}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog open={confirming} title={editorRole ? "Update custom role?" : "Create custom role?"} description={editorRole ? "The selected permissions and status will immediately apply to memberships using this custom role." : "The new role will be available for institution membership assignment."} confirmLabel={editorRole ? "Update role" : "Create role"} loading={saving} onConfirm={() => void save()} onCancel={() => setConfirming(false)} />

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold text-ink-strong">Permission catalogue</h2>
        <p className="mt-1 text-sm text-ink-muted">Available permissions by module. This is read-only so current access can be reviewed safely.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(permissionGroups).map(([module, count]) => (
            <span key={module} className="rounded-full bg-surface-sunken px-3 py-1.5 text-sm text-ink">
              {moduleLabel(module)} · {count}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
