"use client";

import { useCallback, useState } from "react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, institutionsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { InstitutionMembership } from "@/types/institutions";

const setupOwnerRoles = [
  { code: "HR_ADMIN", label: "HR Admin", scope: "HR, Leave, Attendance, Payroll, and Recruitment" },
  { code: "FINANCE_MANAGER", label: "Finance Manager", scope: "Payroll and Accounting oversight" },
  { code: "ACCOUNTANT", label: "Accountant", scope: "Accounting operations and finance records" },
  { code: "AUDITOR", label: "Auditor", scope: "Read-only financial and compliance review" },
  { code: "DIRECTOR", label: "Director", scope: "Executive oversight and approvals" },
] as const;

function memberName(firstName: string | undefined, lastName: string | undefined, email: string | undefined): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email || "Unknown user";
}

export default function MembershipSettingsPage() {
  const [editing, setEditing] = useState<InstitutionMembership | null>(null);
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [isPrimary, setIsPrimary] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [acceptanceUrl, setAcceptanceUrl] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [memberships, roles] = await Promise.all([institutionsApi.listInstitutionMemberships(), institutionsApi.listInstitutionRoles()]);
    return { memberships, roles: roles.results.filter((role) => role.is_active) };
  }, []);
  const { data, loading, error, reload } = useApiResource(load);

  if (loading) return <LoadingState />;
  if (error || !data) {
    return <ErrorState message={error ?? "You may not have permission to review institution memberships."} onRetry={reload} />;
  }

  const openEdit = (membership: InstitutionMembership) => { setEditing(membership); setRoleId(membership.role?.id ?? ""); setStatus(membership.status); setIsPrimary(membership.is_primary); setActionError(null); };
  const save = async () => {
    if (!editing || !roleId) return;
    setSaving(true); setActionError(null);
    try { await institutionsApi.updateInstitutionMembership(editing.id, { role_id: roleId, status, is_primary: isPrimary }); setConfirming(false); setEditing(null); reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); setConfirming(false); } finally { setSaving(false); }
  };
  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim() || !inviteRoleId || inviting) { setActionError("Enter an account email and choose a role."); return; }
    setInviting(true); setActionError(null);
    try { await institutionsApi.inviteInstitutionMember({ email: inviteEmail.trim(), role_id: inviteRoleId }); setInviteEmail(""); setInviteRoleId(""); reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); } finally { setInviting(false); }
  };
  const createLink = async () => {
    if (!inviteEmail.trim() || !inviteRoleId || inviting) { setActionError("Enter an account email and choose a role."); return; }
    setInviting(true); setActionError(null);
    try { const invitation = await institutionsApi.createInvitationLink({ email: inviteEmail.trim(), role_id: inviteRoleId }); setAcceptanceUrl(`${window.location.origin}/accept-invitation/${invitation.acceptance_token}`); } catch (caught) { setActionError(getApiErrorMessage(caught)); } finally { setInviting(false); }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-950 p-6 text-white sm:p-8">
        <p className="text-sm font-medium text-slate-300">Institution settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Users &amp; memberships</h1>
        <p className="mt-2 text-sm text-slate-300">Manage access to your workspace.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">Setup owners</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Invite the people who will configure your workspace</h2>
        <p className="mt-1 text-sm text-slate-500">Choose a role to preselect it in the invitation form, then enter the recipient’s email.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {setupOwnerRoles.map((owner) => {
            const role = data.roles.find((item) => item.code === owner.code);
            return <button key={owner.code} type="button" disabled={!role} onClick={() => { setInviteRoleId(role?.id ?? ""); setActionError(null); }} className={`rounded-xl border p-4 text-left transition ${inviteRoleId === role?.id ? "border-sky-400 bg-sky-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"} disabled:cursor-not-allowed disabled:opacity-50`}><p className="font-semibold text-slate-950">{owner.label}</p><p className="mt-2 text-xs leading-5 text-slate-500">{owner.scope}</p></button>;
          })}
        </div>
      </section>

      <form onSubmit={invite} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-[1fr_1fr_auto]">
        <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Existing account email" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
        <select value={inviteRoleId} onChange={(event) => setInviteRoleId(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm"><option value="">Select role</option>{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
        <div className="flex gap-2"><button disabled={inviting} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{inviting ? "Inviting…" : "Invite member"}</button><button type="button" disabled={inviting} onClick={() => void createLink()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Create link</button></div>
        <p className="text-xs text-slate-500 md:col-span-3">Invitations are created for existing ErgonX accounts. Email delivery will be added when the delivery contract is available.</p>
      </form>

      {acceptanceUrl && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="font-medium text-blue-950">One-time acceptance link</p><p className="mt-1 text-sm text-blue-800">Copy and send this through an approved channel. It is not shown again after leaving this screen.</p><div className="mt-3 flex gap-2"><input readOnly value={acceptanceUrl} className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm" /><button type="button" onClick={() => void navigator.clipboard.writeText(acceptanceUrl)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Copy</button></div></div>}

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Institution members</h2>
          <p className="mt-1 text-sm text-slate-500">{data.memberships.count} membership{data.memberships.count === 1 ? "" : "s"} found.</p>
        </div>
        {data.memberships.results.length === 0 ? (
          <EmptyState title="No memberships found" description="Users with institution access will appear here." />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.memberships.results.map((membership) => {
              const user = membership.user;
              return (
                <div key={membership.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-950">{memberName(user?.first_name, user?.last_name, user?.email)}</p>
                      {membership.is_primary && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Primary institution</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{user?.email ?? "User information unavailable"}</p>
                  </div>
                  <div className="flex items-center gap-3 sm:text-right">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{membership.role?.name ?? "No role assigned"}</p>
                      <p className="mt-1 text-xs text-slate-500">{membership.role?.code ?? "—"}</p>
                    </div>
                    <StatusBadge status={membership.status} />
                    <button onClick={() => openEdit(membership)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Edit access</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {editing && <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-slate-900">Update access</h2><p className="mt-1 text-sm text-slate-500">{memberName(editing.user?.first_name, editing.user?.last_name, editing.user?.email)}</p></div><button onClick={() => setEditing(null)} className="text-sm font-medium text-slate-600">Cancel</button></div><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm font-medium text-slate-700">Role<select value={roleId} onChange={(event) => setRoleId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5">{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="INVITED">Invited</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="INACTIVE">Inactive</option></select></label><label className="flex items-center gap-2 pt-7 text-sm font-medium text-slate-700"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} /> Primary institution</label></div>{actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}<div className="mt-5 flex justify-end"><button disabled={!roleId} onClick={() => setConfirming(true)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Review changes</button></div></div>}

      <ConfirmDialog open={confirming} title="Update membership access?" description="This will change the member’s role, status, or primary institution selection. The backend prevents removing the final active Institution Admin." confirmLabel="Update access" destructive={status === "SUSPENDED" || status === "INACTIVE"} loading={saving} onConfirm={() => void save()} onCancel={() => setConfirming(false)} />
    </div>
  );
}
