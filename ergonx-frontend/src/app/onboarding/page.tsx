"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  CreditCard,
  CalendarDays,
  Landmark,
  Layers3,
  RefreshCw,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/guards/AuthProvider";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, institutionsApi } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";
import type { InstitutionOnboardingStep } from "@/types/institutions";

type StepAction = { href: string; label: string };

type StepPresentation = {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: StepAction;
};

const stepPresentation: Record<string, StepPresentation> = {
  INSTITUTION_PROFILE: { title: "Institution profile", description: "Add your organization contact details, country, and time zone.", icon: Building2, action: { href: "/onboarding/profile", label: "Complete profile" } },
  MODULE_SELECTION: { title: "Choose your modules", description: "Enable the ErgonX modules your organization will use.", icon: Layers3, action: { href: "/settings/modules", label: "Choose modules" } },
  ORGANIZATION_SETUP: { title: "Organization structure", description: "Create a department, position, grade, and location for Core HR.", icon: Landmark, action: { href: "/onboarding/organization", label: "Create structure" } },
  HR_CONFIGURATION: { title: "Core HR readiness", description: "Review your starter organization structure before validation.", icon: BadgeCheck, action: { href: "/onboarding/organization", label: "Review structure" } },
  PAYROLL_CONFIGURATION: { title: "Payroll configuration", description: "Set up payroll preferences when Payroll is enabled.", icon: CreditCard, action: { href: "/payroll/configuration", label: "Configure payroll" } },
  SCHEDULING_CONFIGURATION: { title: "Scheduling configuration", description: "Create an active work schedule for Attendance.", icon: CalendarDays, action: { href: "/attendance/schedules", label: "Configure schedules" } },
  ACCOUNTING_CONFIGURATION: { title: "Accounting configuration", description: "Review accounting setup when Accounting is enabled.", icon: Landmark, action: { href: "/accounting", label: "Open accounting" } },
  PAYROLL_GL_MAPPING: { title: "Payroll-to-GL mapping", description: "Map payroll components to accounting accounts.", icon: Landmark, action: { href: "/accounting/chart-of-accounts", label: "Configure mapping" } },
  RECRUITMENT_CONFIGURATION: { title: "Recruitment configuration", description: "Review recruitment setup when Recruitment is enabled.", icon: UsersRound, action: { href: "/recruitment", label: "Open recruitment" } },
  USERS_AND_ROLES: { title: "Invite your setup owners", description: "Invite administrators without changing existing member access.", icon: UsersRound, action: { href: "/onboarding/users", label: "Invite administrators" } },
  VALIDATION: { title: "Validate your setup", description: "Run the server checks to confirm your institution is ready.", icon: ClipboardCheck },
};

const institutionAdminSteps = new Set([
  "INSTITUTION_PROFILE",
  "MODULE_SELECTION",
  "USERS_AND_ROLES",
]);

function formatStep(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function isFinished(status: string): boolean {
  return status === "COMPLETED" || status === "SKIPPED";
}

export default function OnboardingPage() {
  const router = useRouter();
  const load = useCallback(() => institutionsApi.getInstitutionOnboarding(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const { institution, refreshSession, user } = useAuth();
  const [validating, setValidating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const canManageOnboarding = user?.permissions.includes("*") || user?.permissions.includes("onboarding.manage");
  const isInstitutionSetupOwner = user?.permissions.includes("*") || [
    "settings.institution.manage", "settings.modules.manage", "settings.users.manage",
  ].every((permission) => user?.permissions.includes(permission));

  const validate = async () => {
    setValidating(true);
    setActionError(null);
    try {
      const onboarding = await institutionsApi.validateInstitutionOnboarding();
      await refreshSession();
      if (onboarding.status === "READY") {
        router.replace("/");
        return;
      }
      reload();
    } catch (caught) {
      setActionError(getApiErrorMessage(caught));
    } finally {
      setValidating(false);
    }
  };

  const visibleSteps = useMemo(
    () => data?.steps.filter((step) => !isInstitutionSetupOwner || institutionAdminSteps.has(step.code)) ?? [],
    [data, isInstitutionSetupOwner],
  );

  const setupSummary = useMemo(() => {
    if (!data) return { complete: 0, required: 0 };
    const required = visibleSteps.filter((step) => step.status !== "SKIPPED");
    return {
      complete: required.filter((step) => step.status === "COMPLETED").length,
      required: required.length,
    };
  }, [data, visibleSteps]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? "You may not have permission to view institution onboarding."} onRetry={reload} />;

  const blockers = (data.validation_summary.blockers ?? []).filter((blocker) =>
    !isInstitutionSetupOwner || institutionAdminSteps.has(blocker.step),
  );
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-[0_22px_55px_rgba(15,23,42,0.18)] sm:px-8 sm:py-9">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-24 h-28 w-28 rounded-full border border-sky-300/20" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Set up {institution?.name ?? "your institution"}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Complete the essentials to prepare your organization.</p></div>
            {canManageOnboarding && <button type="button" disabled={validating} onClick={() => void validate()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw className={validating ? "h-4 w-4 animate-spin" : "h-4 w-4"} />{validating ? "Validating…" : "Validate setup"}</button>}
          </div>
        </section>

        <section className="mt-6 max-w-3xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.04)] sm:p-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold tracking-tight text-slate-950">Setup progress</h2><StatusBadge status={data.status} /></div><p className="mt-2 text-sm text-slate-500">{setupSummary.complete} of {setupSummary.required} required setup items completed.</p></div>
              <p className="text-4xl font-semibold tracking-tight text-slate-950">{setupSummary.required ? Math.round((setupSummary.complete / setupSummary.required) * 100) : 100}<span className="text-xl text-slate-400">%</span></p>
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-500" style={{ width: `${setupSummary.required ? Math.round((setupSummary.complete / setupSummary.required) * 100) : 100}%` }} /></div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3"><ClipboardCheck className="h-5 w-5 shrink-0 text-sky-700" /><p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">Current focus:</span> {isInstitutionSetupOwner ? "Institution profile, module selection, and setup owners" : formatStep(data.current_step)}</p></div>
          </div>
        </section>

        {actionError && <div className="mt-6"><ErrorState title="Setup validation failed" message={actionError} onRetry={reload} /></div>}
        {blockers.length > 0 && <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6"><div className="flex gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><h2 className="font-semibold text-amber-950">Attention needed before setup can be completed</h2><p className="mt-1 text-sm text-amber-800">Resolve these server-identified requirements, then validate again.</p><ul className="mt-4 space-y-2 text-sm text-amber-900">{blockers.map((blocker) => <li key={`${blocker.step}-${blocker.code}`} className="rounded-xl bg-white/60 px-3 py-2"><span className="font-semibold">{formatStep(blocker.step)}:</span> {blocker.message}</li>)}</ul></div></div></section>}
        {data.status === "READY" && <section className="mt-6 flex items-start gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 sm:p-6"><CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" /><div><h2 className="font-semibold">Your institution is ready</h2><p className="mt-1 text-sm text-emerald-800">All enabled-module setup requirements have passed server validation.</p></div></section>}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.04)] sm:p-7"><div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">Guided checklist</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{isInstitutionSetupOwner ? "Prepare your organization" : "Complete your setup"}</h2><p className="mt-1 text-sm text-slate-500">{isInstitutionSetupOwner ? "Role owners complete their own authorized configuration after you invite them." : "Complete the setup items assigned to your permissions."}</p></div><p className="text-sm text-slate-500">{visibleSteps.length} setup steps</p></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleSteps.map((step) => <SetupStepCard key={step.code} step={step} validating={validating} canValidate={Boolean(canManageOnboarding)} onValidate={validate} />)}</div></section>
      </div>
    </main>
  );
}

function SetupStepCard({ step, validating, canValidate, onValidate }: { step: InstitutionOnboardingStep; validating: boolean; canValidate: boolean; onValidate: () => Promise<void> }) {
  const presentation = stepPresentation[step.code] ?? { title: formatStep(step.code), description: "Complete this setup requirement.", icon: ClipboardCheck };
  const Icon = presentation.icon;
  const complete = isFinished(step.status);
  const needsAttention = step.status === "BLOCKED";

  return <article className={`flex min-h-44 flex-col rounded-2xl border p-5 transition ${needsAttention ? "border-red-200 bg-red-50/40" : complete ? "border-slate-200 bg-slate-50/70" : "border-slate-200 bg-white shadow-sm"}`}><div className="flex items-start justify-between gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${needsAttention ? "bg-red-100 text-red-700" : complete ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}><Icon className="h-5 w-5" /></div><StatusBadge status={step.status} /></div><h3 className="mt-5 font-semibold text-slate-950">{presentation.title}</h3>{step.blocker_message && <p className="mt-2 text-sm leading-5 text-red-700">{step.blocker_message}</p>}{step.required_module && <p className="mt-2 text-xs font-medium text-slate-400">Required for {formatStep(step.required_module)}</p>}<div className="mt-auto flex flex-wrap items-center gap-4 pt-5">{step.code === "VALIDATION" && !complete && canValidate ? <button type="button" disabled={validating} onClick={() => void onValidate()} className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900 disabled:opacity-60">{validating ? "Validating…" : "Validate setup"} <ArrowRight className="h-4 w-4" /></button> : presentation.action ? <Link href={presentation.action.href} className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900">{complete ? "Manage" : presentation.action.label} <ArrowRight className="h-4 w-4" /></Link> : <span className={`inline-flex items-center gap-2 text-sm font-semibold ${step.status === "SKIPPED" ? "text-slate-400" : "text-emerald-700"}`}>{step.status === "SKIPPED" ? "Skipped" : complete ? "Completed" : "View only"}{complete && step.status !== "SKIPPED" && <CheckCircle2 className="h-4 w-4" />}</span>}</div></article>;
}
