"use client";

import { useCallback, useState } from "react";

import { UsersRound } from "lucide-react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, institutionsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { InstitutionMembership } from "@/types/institutions";
import { buttonClasses } from "@/components/ui/Button";

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
  type InvitationAction = "member" | "link" | "resend" | "revoke";
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
  const [invitationAction, setInvitationAction] = useState<InvitationAction | null>(null);
  const [pendingInvitationId, setPendingInvitationId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [memberships, roles, invitations] = await Promise.all([
      institutionsApi.listInstitutionMemberships(),
      institutionsApi.listInstitutionRoles(),
      institutionsApi.listInstitutionInvitations(),
    ]);
    return { memberships, roles: roles.results.filter((role) => role.is_active), invitations };
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
    setActionError(null); setInvitationAction("member");
  };
  const createLink = async () => {
    if (!inviteEmail.trim() || !inviteRoleId || inviting) { setActionError("Enter an account email and choose a role."); return; }
    setActionError(null); setInvitationAction("link");
  };
  const confirmInvitationAction = async () => {
    if (!invitationAction || inviting) return;
    setInviting(true); setActionError(null); setActionNotice(null);
    try {
      if (invitationAction === "member") {
        await institutionsApi.inviteInstitutionMember({ email: inviteEmail.trim(), role_id: inviteRoleId });
        setActionNotice("Invitation sent successfully.");
        setInviteEmail(""); setInviteRoleId("");
      } else if (invitationAction === "link") {
        const invitation = await institutionsApi.createInvitationLink({ email: inviteEmail.trim(), role_id: inviteRoleId });
        setAcceptanceUrl(`${window.location.origin}/accept-invitation/${invitation.acceptance_token}`);
        setActionNotice("Invitation link created successfully.");
        setInviteEmail(""); setInviteRoleId("");
      } else if (pendingInvitationId) {
        if (invitationAction === "resend") {
          const result = await institutionsApi.resendInstitutionInvitation(pendingInvitationId);
          setAcceptanceUrl(`${window.location.origin}/accept-invitation/${result.acceptance_token}`);
          setActionNotice("Invitation reissued successfully.");
        } else {
          await institutionsApi.revokeInstitutionInvitation(pendingInvitationId);
          setActionNotice("Invitation revoked successfully.");
        }
      }
      setInvitationAction(null); setPendingInvitationId(null); await reload();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
      setInvitationAction(null); setPendingInvitationId(null);
    } finally { setInviting(false); }
  };
  const invitationConfirmCopy = invitationAction === "member"
    ? { title: `Invite ${inviteEmail.trim()}?`, description: `Email: ${inviteEmail.trim()} · Role: ${data.roles.find((role) => role.id === inviteRoleId)?.name ?? "Selected role"}`, label: "Send invitation", destructive: false }
    : invitationAction === "link"
      ? { title: `Create an invitation link for ${inviteEmail.trim()}?`, description: `Email: ${inviteEmail.trim()} · Role: ${data.roles.find((role) => role.id === inviteRoleId)?.name ?? "Selected role"}`, label: "Create invitation link", destructive: false }
      : invitationAction === "resend"
        ? { title: "Reissue this invitation?", description: "The current pending invitation will be revoked and replaced with a new secure link.", label: "Reissue invitation", destructive: false }
        : invitationAction === "revoke"
          ? { title: "Revoke this invitation?", description: "The recipient will no longer be able to use the current invitation link.", label: "Revoke invitation", destructive: true }
          : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Institution settings" title="Users & memberships" description="Manage access to your workspace." icon={UsersRound} accent="settings" />

      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-ink">Setup owners</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink-strong">Invite the people who will configure your workspace</h2>
        <p className="mt-1 text-sm text-ink-muted">Choose a role to preselect it in the invitation form, then enter the recipient’s email.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {setupOwnerRoles.map((owner) => {
            const role = data.roles.find((item) => item.code === owner.code);
            return <button key={owner.code} type="button" disabled={!role} onClick={() => { setInviteRoleId(role?.id ?? ""); setActionError(null); }} className={`rounded-xl border p-4 text-left transition ${inviteRoleId === role?.id ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong hover:bg-surface-hover"} disabled:cursor-not-allowed disabled:opacity-50`}><p className="font-semibold text-ink-strong">{owner.label}</p><p className="mt-2 text-xs leading-5 text-ink-muted">{owner.scope}</p></button>;
          })}
        </div>
      </section>

      <form onSubmit={invite} className="grid gap-3 rounded-2xl border border-line bg-surface p-5 md:grid-cols-[1fr_1fr_auto]">
        <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Existing account email" className="h-9 rounded-lg border border-line-strong px-3 text-sm" />
        <select value={inviteRoleId} onChange={(event) => setInviteRoleId(event.target.value)} className="h-9 rounded-lg border border-line-strong px-3 text-sm"><option value="">Select role</option>{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
        <div className="flex gap-2"><button disabled={inviting} className={buttonClasses({ variant: "primary" })}>{inviting ? "Inviting…" : "Invite member"}</button><button type="button" disabled={inviting} onClick={() => void createLink()} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50">Create link</button></div>
        <p className="text-xs text-ink-muted md:col-span-3">Invitations are created for existing ErgonX accounts. Email delivery will be added when the delivery contract is available.</p>
      </form>

      {actionNotice && <p role="status" className="rounded-xl border border-success/25 bg-success-soft p-4 text-sm font-medium text-success-ink">{actionNotice}</p>}

      {acceptanceUrl && <div className="rounded-2xl border border-primary/25 bg-primary-soft p-5"><p className="font-medium text-primary-ink">One-time acceptance link</p><p className="mt-1 text-sm text-primary-ink">Copy and send this through an approved channel. It is not shown again after leaving this screen.</p><div className="mt-3 flex gap-2"><input readOnly value={acceptanceUrl} className="h-9 min-w-0 flex-1 rounded-lg border border-primary/25 bg-surface px-3 text-sm" /><button type="button" onClick={() => void navigator.clipboard.writeText(acceptanceUrl)} className={buttonClasses({ variant: "primary" })}>Copy</button></div></div>}

      <section className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line-soft px-5 py-4"><h2 className="font-semibold text-ink-strong">Invitation status</h2><p className="mt-1 text-sm text-ink-muted">Pending invitations show their expiry and can be reissued or revoked. Established member access is managed separately below.</p></div>
        {data.invitations.results.length === 0 ? <EmptyState title="No invitation records" description="Pending invitations will appear here after creation." /> : <div className="divide-y divide-line-soft">{data.invitations.results.map((invitation) => <div key={invitation.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-medium text-ink-strong">{invitation.email}</p><p className="mt-1 text-sm text-ink-muted">{invitation.role?.name ?? "No role"} · Expires {new Date(invitation.expires_at).toLocaleString()}</p></div><StatusBadge status={invitation.status} /><div className="flex gap-2">{invitation.status === "PENDING" && <><button type="button" onClick={() => { setPendingInvitationId(invitation.id); setInvitationAction("resend"); }} className="rounded-lg border border-line-strong px-3 py-2 text-sm font-medium text-ink">Reissue</button><button type="button" onClick={() => { setPendingInvitationId(invitation.id); setInvitationAction("revoke"); }} className="rounded-lg border border-danger/25 px-3 py-2 text-sm font-medium text-danger-ink">Revoke</button></>}</div></div>)}</div>}
      </section>

      <section className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line-soft px-5 py-4">
          <h2 className="font-semibold text-ink-strong">Institution members</h2>
          <p className="mt-1 text-sm text-ink-muted">{data.memberships.count} membership{data.memberships.count === 1 ? "" : "s"} found.</p>
        </div>
        {data.memberships.results.length === 0 ? (
          <EmptyState title="No memberships found" description="Users with institution access will appear here." />
        ) : (
          <div className="divide-y divide-line-soft">
            {data.memberships.results.map((membership) => {
              const user = membership.user;
              return (
                <div key={membership.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink-strong">{memberName(user?.first_name, user?.last_name, user?.email)}</p>
                      {membership.is_primary && <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-ink">Primary institution</span>}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{user?.email ?? "User information unavailable"}</p>
                  </div>
                  <div className="flex items-center gap-3 sm:text-right">
                    <div>
                      <p className="text-sm font-medium text-ink">{membership.role?.name ?? "No role assigned"}</p>
                      <p className="mt-1 text-xs text-ink-muted">{membership.role?.code ?? "—"}</p>
                    </div>
                    <StatusBadge status={membership.status} />
                    <button onClick={() => openEdit(membership)} className="rounded-lg border border-line-strong px-3 py-2 text-sm font-medium text-ink">Edit access</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {editing && <div className="rounded-2xl border border-line bg-surface p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-ink-strong">Update access</h2><p className="mt-1 text-sm text-ink-muted">{memberName(editing.user?.first_name, editing.user?.last_name, editing.user?.email)}</p></div><button onClick={() => setEditing(null)} className="text-sm font-medium text-ink-muted">Cancel</button></div><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm font-medium text-ink">Role<select value={roleId} onChange={(event) => setRoleId(event.target.value)} className="mt-1 w-full h-9 rounded-lg border border-line-strong px-3">{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label className="text-sm font-medium text-ink">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full h-9 rounded-lg border border-line-strong px-3"><option value="INVITED">Invited</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="INACTIVE">Inactive</option></select></label><label className="flex items-center gap-2 pt-7 text-sm font-medium text-ink"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} /> Primary institution</label></div>{actionError && <p className="mt-3 text-sm text-danger-ink">{actionError}</p>}<div className="mt-5 flex justify-end"><button disabled={!roleId} onClick={() => setConfirming(true)} className={buttonClasses({ variant: "primary" })}>Review changes</button></div></div>}

      <ConfirmDialog open={confirming} title="Update membership access?" description="This will change the member’s role, status, or primary institution selection. The backend prevents removing the final active Institution Admin." confirmLabel="Update access" destructive={status === "SUSPENDED" || status === "INACTIVE"} loading={saving} onConfirm={() => void save()} onCancel={() => setConfirming(false)} />
      {invitationConfirmCopy && <ConfirmDialog open title={invitationConfirmCopy.title} description={invitationConfirmCopy.description} confirmLabel={invitationConfirmCopy.label} destructive={invitationConfirmCopy.destructive} loading={inviting} onConfirm={() => void confirmInvitationAction()} onCancel={() => { setInvitationAction(null); setPendingInvitationId(null); }} />}
    </div>
  );
}
