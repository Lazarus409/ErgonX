"use client";

import ModuleAccessGate from "@/components/guards/ModuleAccessGate";
import AppShell from "@/components/layout/AppShell";
import { moduleAccessPermissions } from "@/components/navigation/navigation";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate module="REPORTS" anyPermissions={[...moduleAccessPermissions.REPORTS]}>{children}</ModuleAccessGate></AppShell>;
}
