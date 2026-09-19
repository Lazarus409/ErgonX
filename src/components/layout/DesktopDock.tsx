"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation, selfServiceNavigation } from "@/components/navigation/navigation";
import { useAuth } from "@/components/guards/AuthProvider";
import { hasModule } from "@/types/institutions";

export default function DesktopDock() {
  const pathname = usePathname();
  const { user, institution } = useAuth();
  // Employees use the same bottom dock as administrators, with only their
  // Self-Service destinations rather than administrative modules.
  const source = user?.role === "EMPLOYEE" ? selfServiceNavigation : navigation;
  const items = source.filter((item) => (!item.allowedRoles || item.allowedRoles.includes(user?.role ?? "")) && (!item.excludedRoles || !item.excludedRoles.includes(user?.role ?? "")) && (!item.module || hasModule(institution?.enabledModules, item.module)) && (!item.permission || user?.permissions.includes("*") || user?.permissions.includes(item.permission)));
  return <nav aria-label="Primary navigation" className="fixed bottom-5 left-1/2 z-40 hidden -translate-x-1/2 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-2 shadow-[0_16px_48px_-20px_rgba(15,23,42,0.65)] backdrop-blur lg:flex"><div className="flex items-center gap-1">{items.map((item) => { const Icon = item.icon; const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)); return <Link key={item.href} href={item.href} title={item.label} className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition ${active ? "bg-indigo-500 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><Icon className="h-5 w-5" /><span className="pointer-events-none absolute bottom-[calc(100%+10px)] whitespace-nowrap rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow transition group-hover:opacity-100">{item.label}</span></Link>; })}</div></nav>;
}
