"use client";

import {
  ArrowUpRight,
  Check,
  Clock3,
  Copy,
  LogOut,
  MailPlus,
  Moon,
  ShieldAlert,
  Sun,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import HomeHero from "@/components/home/HomeHero";
import { AdaptiveLogo } from "@/components/brand/Logo";
import { useTheme } from "@/components/context/ThemeProvider";
import { useAuth } from "@/components/guards/AuthProvider";
import Alert from "@/components/ui/Alert";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Avatar, Card, MetricCard } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import ErrorState from "@/components/ui/ErrorState";
import { Field, Input, Select } from "@/components/ui/Field";
import LoadingState from "@/components/ui/LoadingState";
import { authApi, getApiErrorMessage } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { PlatformInstitutionAdminInvitation } from "@/lib/api/auth";

const statusTone: Record<PlatformInstitutionAdminInvitation["status"], BadgeTone> = {
  ACCEPTED: "success",
  PENDING: "warning",
  EXPIRED: "neutral",
  REVOKED: "danger",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/**
 * Super Admin platform workspace. Uses the single canonical theme; the former
 * Platform-only colour mode is migrated by ThemeProvider on first load.
 */
export default function PlatformAdminPage() {
  const router = useRouter();
  const { isPlatformAdmin, loading, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState("168");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acceptanceUrl, setAcceptanceUrl] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<"SENT" | "FAILED" | "MANUAL_DELIVERY_REQUIRED" | null>(null);
  const [copied, setCopied] = useState(false);
  const load = useCallback(() => authApi.listInstitutionAdminInvitations(), []);
  const { data, loading: loadingInvitations, error, reload } = useApiResource(load);

  const metrics = useMemo(() => ({
    total: data?.length ?? 0,
    pending: data?.filter((invitation) => invitation.status === "PENDING").length ?? 0,
    accepted: data?.filter((invitation) => invitation.status === "ACCEPTED").length ?? 0,
  }), [data]);

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setActionError(null);
    setAcceptanceUrl(null);
    setDeliveryStatus(null);
    setCopied(false);
    try {
      const invitation = await authApi.createInstitutionAdminInvitation({
        email: email.trim(),
        expires_in_hours: Number(hours),
      });
      setAcceptanceUrl(`${window.location.origin}/create-organization/${invitation.acceptance_token}`);
      setDeliveryStatus(invitation.email_delivery_status);
      setEmail("");
      reload();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!acceptanceUrl) return;
    await navigator.clipboard.writeText(acceptanceUrl);
    setCopied(true);
  };

  if (loading || loadingInvitations) return <LoadingState variant="splash" />;
  if (!isPlatformAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-elevation-3">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger" aria-hidden="true"><ShieldAlert className="h-6 w-6" /></span>
          <h1 className="mt-5 text-heading font-semibold text-ink-strong">Platform access required</h1>
          <p className="mt-2 text-support text-ink-muted">This workspace is only available to ErgonX Super Admins.</p>
        </div>
      </main>
    );
  }

  const firstName = user?.firstName || "Super";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Super Administrator";

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-10">
          <AdaptiveLogo height={26} priority />
          <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          <p className="hidden text-sm font-semibold text-ink-strong sm:block">Platform control</p>
          <div className="flex-1" />
          <IconButton label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</IconButton>
          <div className="hidden items-center gap-2.5 md:flex">
            <Avatar name={fullName} size="sm" />
            <div className="leading-tight"><p className="text-support font-semibold text-ink-strong">{fullName}</p><p className="text-caption text-ink-muted">Super Administrator</p></div>
          </div>
          <Button variant="secondary" size="sm" className="hidden md:inline-flex" leadingIcon={<UserRoundCog className="h-4 w-4" />} onClick={() => router.push("/platform/profile")}>My profile</Button>
          <Button variant="ghost" size="sm" leadingIcon={<LogOut className="h-4 w-4" />} onClick={() => { logout(); router.replace("/login"); }}><span className="hidden sm:inline">Sign out</span></Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {error || !data ? (
          <ErrorState message={error ?? "Could not load invitations."} onRetry={reload} />
        ) : (
          <>
            <HomeHero eyebrow="ErgonX platform" title={`Good to see you, ${firstName}.`} subtitle="Manage organizations and their administrator access from one place." />

            <section className="grid gap-4 sm:grid-cols-3 lg:max-w-4xl" aria-label="Invitation summary">
              <MetricCard size="sm" label="Total invitations" value={metrics.total} icon={UsersRound} accent="brand" />
              <MetricCard size="sm" label="Awaiting activation" value={metrics.pending} icon={Clock3} accent="payroll" />
              <MetricCard size="sm" label="Organizations started" value={metrics.accepted} icon={Check} accent="accounting" />
            </section>

            <Card title="Invite an Institution Admin" description="The recipient creates their organization and becomes its primary administrator through a single-use secure link." icon={MailPlus} accent="brand" accentLine>
              {actionError && <Alert tone="danger" title="Invitation could not be created" className="mb-5">{actionError}<p className="mt-1 text-caption">Use an email address that does not already have an ErgonX account.</p></Alert>}
              <form onSubmit={createInvitation} className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
                <Field label="Administrator work email"><Input required type="email" size="lg" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="administrator@organization.com" /></Field>
                <Field label="Link validity"><Select size="lg" value={hours} onChange={(event) => setHours(event.target.value)}><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option><option value="336">14 days</option></Select></Field>
                <Button type="submit" size="lg" loading={creating} loadingLabel="Creating…" trailingIcon={<ArrowUpRight className="h-4 w-4" />}>Create invite</Button>
              </form>
              {acceptanceUrl && (
                <Alert tone="success" title="Secure setup link created" className="mt-5">
                  <p>{deliveryStatus === "SENT" ? "Invitation email sent successfully. Keep this link only as a secure recovery option." : deliveryStatus === "FAILED" ? "Email delivery failed. Copy and send this secure link through an approved channel." : "Email delivery is not configured yet. Copy and send this secure link through an approved channel."}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input readOnly value={acceptanceUrl} aria-label="Secure setup link" className="font-mono text-caption" />
                    <Button variant="secondary" onClick={() => void copy()} leadingIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{copied ? "Copied" : "Copy link"}</Button>
                  </div>
                </Alert>
              )}
            </Card>

            <DataTable<PlatformInstitutionAdminInvitation>
              caption="Institution Admin invitations"
              rows={data}
              rowKey={(invitation) => invitation.id}
              minWidth={760}
              toolbar={
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div><h2 className="text-card-title font-semibold text-ink-strong">Institution Admin invitations</h2><p className="text-support text-ink-muted">Every invitation issued from this platform.</p></div>
                  <span className="text-support text-ink-muted">{metrics.total} invitation{metrics.total === 1 ? "" : "s"} recorded</span>
                </div>
              }
              empty={{ title: "No invitations yet", description: "Create the first secure setup link to begin onboarding an organization.", icon: MailPlus }}
              columns={[
                { key: "email", header: "Administrator", sortValue: (invitation) => invitation.email, cell: (invitation) => <span className="flex items-center gap-3"><Avatar name={invitation.email} size="sm" /><span><span className="block font-semibold text-ink-strong">{invitation.email}</span><span className="block text-caption text-ink-muted">Institution Admin</span></span></span> },
                { key: "status", header: "Status", cell: (invitation) => <Badge size="sm" tone={statusTone[invitation.status] ?? "neutral"}>{invitation.status.charAt(0) + invitation.status.slice(1).toLowerCase()}</Badge> },
                { key: "expires", header: "Expiration", sortValue: (invitation) => invitation.expires_at, cell: (invitation) => formatDate(invitation.expires_at) },
                { key: "created", header: "Created", sortValue: (invitation) => invitation.created_at, cell: (invitation) => formatDate(invitation.created_at) },
                { key: "by", header: "Created by", hideBelow: "lg", cell: (invitation) => invitation.invited_by_email ?? "Platform administrator" },
              ]}
            />
          </>
        )}
      </div>
    </main>
  );
}
