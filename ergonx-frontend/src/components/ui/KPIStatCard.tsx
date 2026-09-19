"use client";

import { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

interface KPIStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  href?: string;
}

export default function KPIStatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendDirection = "neutral",
}: KPIStatCardProps) {
  const trendIsUp = trendDirection === "up";
  const trendIsDown = trendDirection === "down";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-1.5 text-xs">
          {trendIsUp && (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          )}

          {trendIsDown && (
            <TrendingDown className="h-3.5 w-3.5 text-red-600" />
          )}

          <span
            className={
              trendIsUp
                ? "font-medium text-emerald-600"
                : trendIsDown
                  ? "font-medium text-red-600"
                  : "font-medium text-slate-500"
            }
          >
            {trend}
          </span>
        </div>
      )}
    </div>
  );
}
