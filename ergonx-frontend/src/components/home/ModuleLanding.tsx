"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { useAuth } from "@/components/guards/AuthProvider";
import PageHeader from "@/components/ui/PageHeader";
import { hasModule } from "@/types/institutions";

export interface ModuleLandingArea {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permission: string;
}

interface ModuleLandingProps {
  title: string;
  description: string;
  module: string;
  accentClassName: string;
  areas: ModuleLandingArea[];
}

export default function ModuleLanding({
  title,
  description,
  module,
  accentClassName,
  areas,
}: ModuleLandingProps) {
  const { user, institution } = useAuth();
  const permissions = user?.permissions ?? [];
  const can = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const enabled = hasModule(institution?.enabledModules, module);
  const visibleAreas = enabled ? areas.filter((area) => can(area.permission)) : [];

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-12">
      <PageHeader title={title} description={description} />
      <section className={`rounded-2xl border p-5 sm:p-6 ${accentClassName}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em]">{title} workspace</p>
        <h2 className="mt-2 text-xl font-semibold">Operational areas</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 opacity-80">Open the authorized workspace you need. Records, totals, and workflow state remain owned by the server.</p>
      </section>
      {visibleAreas.length ? <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleAreas.map((area) => {
        const Icon = area.icon;
        return <Link key={area.href} href={area.href} className="group flex min-h-48 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
          <div className="flex items-start justify-between gap-4"><span className="rounded-xl bg-slate-100 p-3 text-slate-700"><Icon className="h-5 w-5" /></span><ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" /></div>
          <h2 className="mt-5 font-semibold text-slate-950">{area.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{area.description}</p>
          <span className="mt-auto pt-4 text-sm font-semibold text-slate-700">Open workspace</span>
        </Link>;
      })}</section> : <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">No {title.toLowerCase()} areas are available for your active membership. An administrator can enable the module or assign the required permissions.</section>}
    </main>
  );
}
