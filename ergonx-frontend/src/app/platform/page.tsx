"use client";

/* eslint-disable @next/next/no-img-element */

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
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/guards/AuthProvider";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import { authApi, getApiErrorMessage } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { PlatformInstitutionAdminInvitation } from "@/lib/api/auth";

const PLATFORM_COLOR_MODE_KEY = "ergonx-platform-color-mode";
const PLATFORM_COLOR_MODE_EVENT = "ergonx-platform-color-mode-change";

function subscribeToPlatformColorMode(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PLATFORM_COLOR_MODE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PLATFORM_COLOR_MODE_EVENT, onStoreChange);
  };
}

function getPlatformColorModeSnapshot() {
  return window.localStorage.getItem(PLATFORM_COLOR_MODE_KEY) === "dark";
}

function invitationStatusStyle(status: PlatformInstitutionAdminInvitation["status"]) {
  if (status === "ACCEPTED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "EXPIRED") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-red-200 bg-red-50 text-red-700";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function PlatformAdminPage() {
  const router = useRouter();
  const { isPlatformAdmin, loading, logout, user } = useAuth();
  const [email, setEmail] = useState("");
  const [hours, setHours] = useState("168");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acceptanceUrl, setAcceptanceUrl] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<"SENT" | "FAILED" | "MANUAL_DELIVERY_REQUIRED" | null>(null);
  const [copied, setCopied] = useState(false);
  const darkMode = useSyncExternalStore(
    subscribeToPlatformColorMode,
    getPlatformColorModeSnapshot,
    () => false,
  );
  const load = useCallback(() => authApi.listInstitutionAdminInvitations(), []);
  const { data, loading: loadingInvitations, error, reload } = useApiResource(load);

  const toggleColorMode = () => {
    window.localStorage.setItem(PLATFORM_COLOR_MODE_KEY, darkMode ? "light" : "dark");
    window.dispatchEvent(new Event(PLATFORM_COLOR_MODE_EVENT));
  };

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

  if (loading || loadingInvitations) return <LoadingState />;
  if (!isPlatformAdmin) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6"><div className="max-w-md rounded-3xl border border-white/10 bg-white p-8 text-center shadow-2xl"><ShieldAlert className="mx-auto h-10 w-10 text-red-600" /><h1 className="mt-4 text-xl font-semibold text-slate-950">Platform access required</h1><p className="mt-2 text-sm text-slate-600">This workspace is only available to ErgonX Super Admins.</p></div></main>;
  }
  if (error || !data) return <ErrorState message={error ?? "Could not load invitations."} onRetry={reload} />;

  const firstName = user?.firstName || "Super";

  return (
    <main className={`min-h-screen bg-[#f4f7fb] text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100 ${darkMode ? "dark" : ""}`}>
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-10 lg:py-7">
        <header className="flex items-center justify-between rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.04)] transition-colors dark:border-slate-700 dark:bg-slate-900 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 p-2 shadow-lg shadow-slate-950/15"><img src="/ergonx-logo.png" alt="ErgonX" className="h-full w-full object-contain" /></div>
            <div><p className="text-sm font-bold tracking-[0.18em] text-slate-950 dark:text-white">ERGONX</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-400">Platform control</p></div>
          </div>
          <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-semibold text-slate-900 dark:text-white">{firstName} {user?.lastName}</p><p className="text-xs text-slate-500 dark:text-slate-400">Super Administrator</p></div><button type="button" onClick={toggleColorMode} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} title={darkMode ? "Light mode" : "Dark mode"} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-950 p-1.5 shadow-md"><img src="/ergonx-logo.png" alt="ErgonX" className="h-full w-full object-contain" /></div><button onClick={() => router.push("/platform/profile")} className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 md:inline-flex"><UserRoundCog className="h-4 w-4" />My profile</button><button onClick={() => { logout(); router.replace("/login"); }} className="ml-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button></div>
        </header>

        <section className="relative mt-6 overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-[0_24px_55px_rgba(15,23,42,0.18)] sm:px-9 lg:py-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" /><div className="absolute bottom-0 right-28 h-36 w-36 rounded-full border border-sky-300/20" />
          <div className="relative"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Good to see you, {firstName}.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Manage organizations and their administrator access from one place.</p></div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-3 lg:max-w-3xl"><Metric label="Total invitations" value={metrics.total} icon={<UsersRound className="h-5 w-5" />} tone="text-sky-700 bg-sky-50" /><Metric label="Awaiting activation" value={metrics.pending} icon={<Clock3 className="h-5 w-5" />} tone="text-amber-700 bg-amber-50" /><Metric label="Organizations started" value={metrics.accepted} icon={<Check className="h-5 w-5" />} tone="text-emerald-700 bg-emerald-50" /></section>

        <div className="mt-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.04)] transition-colors dark:border-slate-700 dark:bg-slate-900 sm:p-7"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sky-300"><MailPlus className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-sky-700 dark:text-sky-400">New organization</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Invite an Institution Admin</h2><p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">The recipient creates their organization and becomes its primary administrator through a single-use secure link.</p></div></div>
            {actionError && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4"><p className="text-sm font-semibold text-red-800">Invitation could not be created</p><p className="mt-1 text-sm text-red-700">{actionError}</p><p className="mt-2 text-xs text-red-700">Use an email address that does not already have an ErgonX account.</p></div>}
            <form onSubmit={createInvitation} className="mt-7 grid gap-4 md:grid-cols-[minmax(0,1fr)_11.5rem_auto]"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Administrator work email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="administrator@organization.com" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100" /></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Link validity</span><select value={hours} onChange={(event) => setHours(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option><option value="336">14 days</option></select></label><button disabled={creating} className="mt-[1.65rem] inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{creating ? "Creating..." : <>Create invite <ArrowUpRight className="h-4 w-4" /></>}</button></form>
            {acceptanceUrl && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5"><div className="flex items-start gap-3"><div className="mt-0.5 rounded-full bg-emerald-600 p-1 text-white"><Check className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-emerald-950">Secure setup link created</p><p className="mt-1 text-xs text-emerald-800">{deliveryStatus === "SENT" ? "Invitation email sent successfully. Keep this link only as a secure recovery option." : deliveryStatus === "FAILED" ? "Email delivery failed. Copy and send this secure link through an approved channel." : "Email delivery is not configured yet. Copy and send this secure link through an approved channel."}</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input readOnly value={acceptanceUrl} className="h-11 min-w-0 flex-1 rounded-xl border border-emerald-200 bg-white px-3 text-xs text-slate-600" /><button type="button" onClick={() => void copy()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100">{copied ? <><Check className="h-4 w-4" />Copied</> : <><Copy className="h-4 w-4" />Copy link</>}</button></div></div></div></div>}
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.04)] transition-colors dark:border-slate-700 dark:bg-slate-900"><div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-sky-700 dark:text-sky-400">Activity</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Institution Admin invitations</h2></div><p className="text-sm text-slate-500 dark:text-slate-400">{metrics.total} invitation{metrics.total === 1 ? "" : "s"} recorded</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50/90 text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800/80 dark:text-slate-400"><tr><th className="px-6 py-4 font-bold">Administrator</th><th className="px-6 py-4 font-bold">Status</th><th className="px-6 py-4 font-bold">Expiration</th><th className="px-6 py-4 font-bold">Created</th><th className="px-6 py-4 font-bold">Created by</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{data.map((invitation) => <tr key={invitation.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800"><td className="px-6 py-4"><p className="font-semibold text-slate-900 dark:text-slate-100">{invitation.email}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Institution Admin</p></td><td className="px-6 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${invitationStatusStyle(invitation.status)}`}>{invitation.status}</span></td><td className="px-6 py-4 text-slate-600 dark:text-slate-300">{formatDate(invitation.expires_at)}</td><td className="px-6 py-4 text-slate-600 dark:text-slate-300">{formatDate(invitation.created_at)}</td><td className="px-6 py-4 text-slate-600 dark:text-slate-300">{invitation.invited_by_email ?? "Platform administrator"}</td></tr>)}{data.length === 0 && <tr><td colSpan={5} className="px-6 py-16 text-center"><div className="mx-auto flex max-w-sm flex-col items-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><MailPlus className="h-5 w-5" /></div><p className="mt-4 font-semibold text-slate-900 dark:text-white">No invitations yet</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create the first secure setup link to begin onboarding an organization.</p></div></td></tr>}</tbody></table></div></section>
      </div>
    </main>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,0.035)] transition-colors dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}>{icon}</span></div><p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p></div>;
}
