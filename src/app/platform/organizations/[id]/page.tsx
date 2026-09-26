"use client";

import Link from "next/link";
import { Ban, Building2, History, KeyRound, LayoutGrid, MailCheck, PlayCircle, ShieldCheck, UsersRound } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

import { countryName, formatDate, formatDateTime, formatRelative, onboardingLabel } from "@/components/platform/format";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, MetricCard, SummaryList } from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Textarea } from "@/components/ui/Field";
import LoadingState from "@/components/ui/LoadingState";
import { Dialog } from "@/components/ui/Overlay";
import PageHeader from "@/components/ui/PageHeader";
import { getApiErrorMessage, platformApi } from "@/lib/api";
import { auditActionLabel, type PlatformInstitutionDetail } from "@/lib/api/platform";
import { useApiResource } from "@/lib/useApiResource";

type Administrator = PlatformInstitutionDetail["administrators"][number];

export default function PlatformOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => platformApi.getInstitution(id), [id]);
  const { data: loaded, loading, error, reload } = useApiResource(load);
  const [updated, setUpdated] = useState<PlatformInstitutionDetail | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const data = updated?.id === loaded?.id && updated ? updated : loaded;

  const suspend = async () => {
    setBusy(true);
    setActionError(null);
    try {
      setUpdated(await platformApi.suspendInstitution(id, reason.trim()));
      setSuspending(false);
      setReason("");
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const reactivate = async () => {
    setBusy(true);
    setActionError(null);
    try {
      setUpdated(await platformApi.reactivateInstitution(id));
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
    } finally {
      setBusy(false);
      setReactivating(false);
    }
  };

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? "Could not load this organization."} onRetry={reload} />;

  const enabledModules = data.modules.filter((module) => module.enabled);
  const members = data.members_by_status;

  return (
    <>
      <PageHeader
        title={data.name}
        breadcrumbs={[{ label: "Organizations", href: "/platform/organizations" }, { label: data.name }]}
        description={`${data.code} · ${countryName(data.country_code)} · joined ${formatDate(data.created_at)}`}
        meta={data.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Suspended</Badge>}
        actions={data.is_active
          ? <Button variant="danger" leadingIcon={<Ban className="h-4 w-4" />} onClick={() => { setActionError(null); setSuspending(true); }}>Suspend organization</Button>
          : <Button leadingIcon={<PlayCircle className="h-4 w-4" />} onClick={() => { setActionError(null); setReactivating(true); }}>Reactivate</Button>}
      />

      {actionError && !suspending && <Alert tone="danger" title="That didn't work">{actionError}</Alert>}
      {!data.is_active && (
        <Alert tone="danger" title={`Suspended ${formatDateTime(data.suspended_at)}`}>
          <p>Nobody in this organization can sign in or use ErgonX until it is reactivated. Their data is kept.</p>
          {data.suspension_reason && <p className="mt-1"><span className="font-semibold">Reason:</span> {data.suspension_reason}</p>}
        </Alert>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Organization summary">
        <MetricCard size="sm" label="Active users" value={data.member_count} icon={UsersRound} accent="brand" description={members.INVITED ? `${members.INVITED} invited` : undefined} />
        <MetricCard size="sm" label="Employees" value={data.employee_count} icon={Building2} accent="hr" />
        <MetricCard size="sm" label="Setup" value={onboardingLabel[data.onboarding_status] ?? data.onboarding_status} icon={LayoutGrid} accent="settings" />
        <MetricCard size="sm" label="Last sign-in" value={formatRelative(data.last_sign_in_at)} icon={History} accent="audit" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card title="Organization details" icon={Building2} accent="brand">
          <SummaryList items={[
            { label: "Type", value: data.institution_type.charAt(0) + data.institution_type.slice(1).toLowerCase() },
            { label: "Contact email", value: data.email || "—" },
            { label: "Phone", value: data.phone || "—" },
            { label: "Time zone", value: data.timezone },
            { label: "Currency", value: data.default_currency },
            { label: "Users by status", value: `${members.ACTIVE} active · ${members.INVITED} invited · ${members.SUSPENDED} suspended · ${members.INACTIVE} inactive` },
          ]} />
        </Card>
        <Card title="Modules" description={`${enabledModules.length} of ${data.modules.length} switched on by the organization.`} icon={LayoutGrid} accent="settings">
          <ul className="flex flex-wrap gap-2">
            {data.modules.map((module) => (
              <li key={module.code}><Badge tone={module.enabled ? "brand" : "neutral"}>{module.name}{module.enabled ? "" : " · off"}</Badge></li>
            ))}
          </ul>
          <div className="mt-5 border-t border-line-soft pt-4">
            <h3 className="flex items-center gap-2 text-support font-semibold text-ink-strong"><MailCheck className="h-4 w-4 text-ink-muted" aria-hidden="true" />How they joined</h3>
            {data.origin_invitation ? (
              <p className="mt-1 text-support text-ink-muted">
                Invited as <span className="font-semibold text-ink-strong">{data.origin_invitation.email}</span> by {data.origin_invitation.invited_by_email ?? "a platform administrator"} on {formatDate(data.origin_invitation.created_at)}; accepted {formatDate(data.origin_invitation.accepted_at)}.
              </p>
            ) : (
              <p className="mt-1 text-support text-ink-muted">No platform invitation on record. The organization was created before invitations were tracked, or by a data import.</p>
            )}
          </div>
        </Card>
      </div>

      <DataTable<Administrator>
        caption="Institution Admins"
        rows={data.administrators}
        rowKey={(admin) => admin.email}
        minWidth={640}
        toolbar={<div><h2 className="text-card-title font-semibold text-ink-strong">Institution Admins</h2><p className="text-support text-ink-muted">People who can manage this organization&apos;s settings, roles and users.</p></div>}
        empty={{ title: "No administrators", description: "This organization has no active Institution Admin. Its users cannot change settings or invite anyone.", icon: ShieldCheck }}
        columns={[
          { key: "name", header: "Name", cell: (admin) => <span><span className="block font-semibold text-ink-strong">{admin.name}</span><span className="block text-caption text-ink-muted">{admin.email}</span></span> },
          { key: "status", header: "Status", cell: (admin) => <Badge size="sm" tone={admin.status === "ACTIVE" ? "success" : admin.status === "INVITED" ? "info" : "warning"}>{admin.status.charAt(0) + admin.status.slice(1).toLowerCase()}</Badge> },
          { key: "mfa", header: "Two-step sign-in", cell: (admin) => admin.mfa_enabled ? <Badge size="sm" tone="success" icon={KeyRound}>On</Badge> : <Badge size="sm" tone="warning">Off</Badge> },
          { key: "login", header: "Last sign-in", cell: (admin) => formatRelative(admin.last_login) },
        ]}
      />

      <Card title="Platform activity" description="Actions Super Admins have taken on this organization." icon={History} accent="audit" actions={<Link className="text-support font-semibold text-primary-ink hover:underline" href={`/platform/audit?institution=${data.id}`}>View all</Link>}>
        {data.recent_events.length === 0 ? (
          <p className="text-support text-ink-muted">No platform actions recorded yet.</p>
        ) : (
          <ol className="divide-y divide-line-soft">
            {data.recent_events.map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                <span>
                  <span className="font-semibold text-ink-strong">{auditActionLabel(event.action)}</span>
                  {typeof event.metadata.reason === "string" && event.metadata.reason && <span className="text-ink-muted"> — {event.metadata.reason}</span>}
                </span>
                <span className="text-caption text-ink-muted">{event.actor_email ?? "System"} · {formatDateTime(event.created_at)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Dialog
        open={suspending}
        onClose={() => { if (!busy) setSuspending(false); }}
        dismissible={!busy}
        size="sm"
        title={`Suspend ${data.name}?`}
        description="Everyone in this organization loses access to ErgonX immediately, until you reactivate it. No data is deleted."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSuspending(false)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={() => void suspend()} loading={busy} loadingLabel="Suspending…" disabled={!reason.trim()}>Suspend organization</Button>
          </>
        }
      >
        {actionError && <Alert tone="danger" className="mb-4">{actionError}</Alert>}
        <Field label="Reason" helper="Recorded in the platform audit log and shown on this page.">
          <Textarea required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Subscription unpaid since August" maxLength={1000} />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={reactivating}
        loading={busy}
        title={`Reactivate ${data.name}?`}
        description="Its users can sign in again straight away."
        confirmLabel="Reactivate"
        onConfirm={() => void reactivate()}
        onCancel={() => setReactivating(false)}
      />
    </>
  );
}
