"use client";

import Link from "next/link";
import { ArrowUpRight, Ban, Check, Copy, MailPlus, RotateCw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import AccessRequestsCard from "@/components/platform/AccessRequestsCard";
import { formatDateTime } from "@/components/platform/format";
import Alert from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar, Card } from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { DataTable, DataToolbar } from "@/components/ui/DataTable";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Input, Select } from "@/components/ui/Field";
import LoadingState from "@/components/ui/LoadingState";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { authApi, getApiErrorMessage } from "@/lib/api";
import type { PlatformInstitutionAdminInvitation } from "@/lib/api/auth";
import { useApiResource } from "@/lib/useApiResource";

type Invitation = PlatformInstitutionAdminInvitation;
type StatusFilter = "ALL" | Invitation["status"];

const statusTone: Record<Invitation["status"], BadgeTone> = {
  ACCEPTED: "success",
  PENDING: "warning",
  EXPIRED: "neutral",
  REVOKED: "danger",
};

const validityOptions = (
  <>
    <option value="24">24 hours</option>
    <option value="72">3 days</option>
    <option value="168">7 days</option>
    <option value="336">14 days</option>
  </>
);

type IssuedLink = { email: string; url: string; delivery: "SENT" | "FAILED" | "MANUAL_DELIVERY_REQUIRED" };

function IssuedLinkAlert({ issued, onDismiss }: { issued: IssuedLink; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(issued.url);
    setCopied(true);
  };
  const message = issued.delivery === "SENT"
    ? `Invitation emailed to ${issued.email}. Keep this link only as a secure recovery option.`
    : issued.delivery === "FAILED"
      ? `Email delivery to ${issued.email} failed. Copy and send this secure link through an approved channel.`
      : `Email delivery is not configured yet. Copy and send this secure link to ${issued.email} through an approved channel.`;
  return (
    <Alert tone="success" title="Secure setup link created">
      <p>{message} It is shown only once.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={issued.url} aria-label="Secure setup link" className="font-mono text-caption" />
        <Button variant="secondary" onClick={() => void copy()} leadingIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{copied ? "Copied" : "Copy link"}</Button>
        <Button variant="ghost" onClick={onDismiss}>Done</Button>
      </div>
    </Alert>
  );
}

export default function PlatformInvitationsPage() {
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState("168");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [reissuing, setReissuing] = useState<Invitation | null>(null);
  const [reissueHours, setReissueHours] = useState("168");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(() => authApi.listInstitutionAdminInvitations(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const loadRequests = useCallback(() => authApi.listInstitutionAccessRequests(), []);
  const { data: requests, loading: loadingRequests, error: requestsError, reload: reloadRequests } = useApiResource(loadRequests);

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { ALL: 0, PENDING: 0, ACCEPTED: 0, EXPIRED: 0, REVOKED: 0 };
    for (const invitation of data ?? []) {
      result.ALL += 1;
      result[invitation.status] += 1;
    }
    return result;
  }, [data]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data ?? []).filter((invitation) =>
      (status === "ALL" || invitation.status === status)
      && (!term || invitation.email.toLowerCase().includes(term) || (invitation.institution_name ?? "").toLowerCase().includes(term)),
    );
  }, [data, search, status]);

  const showLink = (link: { email: string; acceptance_token: string; email_delivery_status: IssuedLink["delivery"] }) => {
    setIssued({ email: link.email, url: `${window.location.origin}/create-organization/${link.acceptance_token}`, delivery: link.email_delivery_status });
  };

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setActionError(null);
    setIssued(null);
    try {
      const invitation = await authApi.createInstitutionAdminInvitation({ email: email.trim(), expires_in_hours: Number(hours) });
      showLink(invitation);
      setEmail("");
      reload();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    setRowError(null);
    try {
      await authApi.revokeInstitutionAdminInvitation(revoking.id);
      setRevoking(null);
      reload();
    } catch (caught) {
      setRowError(getApiErrorMessage(caught));
      setRevoking(null);
    } finally {
      setBusy(false);
    }
  };

  const reissue = async () => {
    if (!reissuing) return;
    setBusy(true);
    setRowError(null);
    try {
      const result = await authApi.reissueInstitutionAdminInvitation(reissuing.id, Number(reissueHours));
      showLink(result.invitation);
      setReissuing(null);
      reload();
      reloadRequests();
    } catch (caught) {
      setRowError(getApiErrorMessage(caught));
      setReissuing(null);
    } finally {
      setBusy(false);
    }
  };

  // Splash only on first load: a reload after an action must not wipe the one-time link.
  if ((loading && !data) || (loadingRequests && !requests)) return <LoadingState />;

  return (
    <>
      <PageHeader title="Invitations" description="Review organizations asking to join, and manage the secure setup links that let an Institution Admin create their organization." />

      {issued && <IssuedLinkAlert issued={issued} onDismiss={() => setIssued(null)} />}

      {requestsError || !requests ? (
        <ErrorState message={requestsError ?? "Could not load access requests."} onRetry={reloadRequests} />
      ) : (
        <AccessRequestsCard requests={requests} onChanged={() => { reloadRequests(); reload(); }} />
      )}

      <Card title="Invite an Institution Admin" description="The recipient creates their organization and becomes its primary administrator through a single-use secure link." icon={MailPlus} accent="brand" accentLine>
        {actionError && <Alert tone="danger" title="Invitation could not be created" className="mb-5">{actionError}<p className="mt-1 text-caption">Use an email address that does not already have an ErgonX account.</p></Alert>}
        <form onSubmit={createInvitation} className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
          <Field label="Administrator work email"><Input required type="email" size="lg" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="administrator@organization.com" /></Field>
          <Field label="Link validity"><Select size="lg" value={hours} onChange={(event) => setHours(event.target.value)}>{validityOptions}</Select></Field>
          <Button type="submit" size="lg" loading={creating} loadingLabel="Creating…" trailingIcon={<ArrowUpRight className="h-4 w-4" />}>Create invite</Button>
        </form>
      </Card>

      {rowError && <Alert tone="danger" title="That didn't work">{rowError}</Alert>}

      {error || !data ? (
        <ErrorState message={error ?? "Could not load invitations."} onRetry={reload} />
      ) : (
        <DataTable<Invitation>
          caption="Institution Admin invitations"
          rows={rows}
          rowKey={(invitation) => invitation.id}
          minWidth={900}
          toolbar={
            <div className="space-y-3">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div><h2 className="text-card-title font-semibold text-ink-strong">Institution Admin invitations</h2><p className="text-support text-ink-muted">Every invitation issued from this platform. Expired links are marked automatically.</p></div>
              </div>
              <DataToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search email or organization…"
                filters={
                  <SegmentedControl<StatusFilter>
                    label="Invitation status"
                    value={status}
                    onChange={setStatus}
                    options={(["ALL", "PENDING", "ACCEPTED", "EXPIRED", "REVOKED"] as const).map((value) => ({ value, label: `${value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()} · ${counts[value]}` }))}
                  />
                }
              />
            </div>
          }
          empty={data.length === 0
            ? { title: "No invitations yet", description: "Create the first secure setup link to begin onboarding an organization.", icon: MailPlus }
            : { title: "No matching invitations", description: "Try a different search or status." }}
          columns={[
            { key: "email", header: "Administrator", sortValue: (invitation) => invitation.email, cell: (invitation) => <span className="flex items-center gap-3"><Avatar name={invitation.email} size="sm" /><span className="min-w-0"><span className="block truncate font-semibold text-ink-strong">{invitation.email}</span><span className="block text-caption text-ink-muted">Institution Admin</span></span></span> },
            { key: "status", header: "Status", sortValue: (invitation) => invitation.status, cell: (invitation) => <Badge size="sm" tone={statusTone[invitation.status] ?? "neutral"}>{invitation.status.charAt(0) + invitation.status.slice(1).toLowerCase()}</Badge> },
            { key: "organization", header: "Organization", hideBelow: "md", cell: (invitation) => invitation.institution_id ? <Link className="font-semibold text-primary-ink hover:underline" href={`/platform/organizations/${invitation.institution_id}`}>{invitation.institution_name}</Link> : <span className="text-ink-subtle">—</span> },
            { key: "expires", header: "Expires", sortValue: (invitation) => invitation.expires_at, cell: (invitation) => formatDateTime(invitation.expires_at) },
            { key: "created", header: "Created", hideBelow: "lg", sortValue: (invitation) => invitation.created_at, cell: (invitation) => <span><span className="block">{formatDateTime(invitation.created_at)}</span><span className="block text-caption text-ink-muted">{invitation.invited_by_email ?? "Platform administrator"}</span></span> },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              cell: (invitation) => invitation.status === "ACCEPTED" ? null : (
                <span className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" leadingIcon={<RotateCw className="h-3.5 w-3.5" />} onClick={() => { setReissueHours("168"); setReissuing(invitation); }}>Re-issue</Button>
                  {invitation.status === "PENDING" && <Button size="sm" variant="ghost" leadingIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => setRevoking(invitation)}>Revoke</Button>}
                </span>
              ),
            },
          ]}
        />
      )}

      <ConfirmDialog
        open={revoking !== null}
        destructive
        loading={busy}
        title="Revoke this invitation?"
        description={`The setup link sent to ${revoking?.email ?? ""} will stop working immediately. You can issue a new one later.`}
        confirmLabel="Revoke link"
        onConfirm={() => void revoke()}
        onCancel={() => setRevoking(null)}
      />

      <Dialog
        open={reissuing !== null}
        onClose={() => { if (!busy) setReissuing(null); }}
        dismissible={!busy}
        size="sm"
        title="Re-issue invitation"
        description={reissuing ? `A new secure link will be created for ${reissuing.email}.${reissuing.status === "PENDING" ? " The current link will stop working." : ""}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReissuing(null)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void reissue()} loading={busy} loadingLabel="Issuing…">Issue new link</Button>
          </>
        }
      >
        <Field label="Link validity"><Select value={reissueHours} onChange={(event) => setReissueHours(event.target.value)}>{validityOptions}</Select></Field>
      </Dialog>
    </>
  );
}
