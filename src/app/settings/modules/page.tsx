"use client";

import { useCallback, useState } from "react";
import { BarChart3, Banknote, CalendarDays, Calculator, CheckCircle2, Layers3, Plane, UserRoundPlus, UsersRound, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getApiErrorMessage, institutionsApi } from "@/lib/api";
import { cx } from "@/lib/cx";
import { moduleAccents, type ModuleAccent } from "@/lib/moduleTheme";
import { useApiResource } from "@/lib/useApiResource";

const moduleDetails: Record<string, { name: string; description: string; icon: LucideIcon; accent: ModuleAccent }> = {
  CORE_HR: { name: "Core HR", description: "Employee records, organization structure and people data.", icon: UsersRound, accent: "hr" },
  RECRUITMENT: { name: "Recruitment", description: "Open roles, candidates, interviews and offers.", icon: UserRoundPlus, accent: "recruitment" },
  LEAVE: { name: "Leave", description: "Leave policies, balances, requests and approvals.", icon: Plane, accent: "leave" },
  ATTENDANCE: { name: "Attendance", description: "Schedules, shifts, time capture and work patterns.", icon: CalendarDays, accent: "attendance" },
  PAYROLL: { name: "Payroll", description: "Pay runs, payslips, components and statutory setup.", icon: Banknote, accent: "payroll" },
  ACCOUNTING: { name: "Accounting", description: "Financial records, journals, payables and receivables.", icon: Calculator, accent: "accounting" },
  REPORTS: { name: "Reports & Analytics", description: "Operational reports and organization insights.", icon: BarChart3, accent: "reports" },
};

function configurationLabel(status: string) { return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()); }

export default function ModuleSettingsPage() {
  const load = useCallback(() => institutionsApi.listInstitutionModules(), []);
  const { data, loading, error, reload } = useApiResource(load);
  const [updating, setUpdating] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const toggle = async (id: string, enabled: boolean) => { setUpdating(id); setActionError(null); try { await institutionsApi.updateInstitutionModule(id, !enabled); reload(); } catch (caught) { setActionError(getApiErrorMessage(caught)); } finally { setUpdating(null); } };
  if (loading) return <LoadingState variant="dashboard" />;
  if (error || !data) return <ErrorState message={error ?? "You may not have permission to manage modules."} onRetry={reload} />;
  const enabledCount = data.results.filter((module) => module.is_enabled).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Module configuration"
        description="Enable the modules your organization needs. Your selections can be changed as your organization grows."
        icon={Layers3}
        accent="settings"
        meta={<Badge tone="brand">{enabledCount} of {data.results.length} active</Badge>}
      />
      {actionError && <ErrorState variant="inline" title="Module could not be updated" message={actionError} />}
      <section className="grid gap-4 md:grid-cols-2" aria-label="Available modules">
        {data.results.map((module) => {
          const detail = moduleDetails[module.module_code] ?? { name: module.module_code.replaceAll("_", " "), description: "ErgonX workspace capability.", icon: CheckCircle2, accent: "settings" as ModuleAccent };
          return (
            <article key={module.id} className={cx("relative flex gap-4 overflow-hidden rounded-2xl border bg-surface p-5 shadow-elevation-1 transition-shadow hover:shadow-elevation-2", module.is_enabled ? "border-line" : "border-dashed border-line-strong")}>
              {module.is_enabled && <span aria-hidden="true" className={cx("absolute inset-y-0 left-0 w-1", moduleAccents[detail.accent].solid)} />}
              <IconTile icon={detail.icon} accent={detail.accent} className={module.is_enabled ? undefined : "opacity-60"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-card-title font-semibold text-ink-strong">{detail.name}</h2>
                    <p className="mt-0.5 text-support text-ink-muted">{detail.description}</p>
                  </div>
                  <StatusBadge status={module.is_enabled ? "ACTIVE" : "INACTIVE"} size="sm" />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <Badge size="sm" tone={module.configuration_status === "READY" ? "success" : module.configuration_status === "IN_PROGRESS" ? "warning" : "neutral"}>Setup: {configurationLabel(module.configuration_status)}</Badge>
                  <Button size="sm" variant={module.is_enabled ? "secondary" : "primary"} loading={updating === module.id} loadingLabel="Updating…" onClick={() => void toggle(module.id, module.is_enabled)}>
                    {module.is_enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
