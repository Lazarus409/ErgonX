"use client";

import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";
import { moduleAccessPermissions } from "@/components/navigation/navigation";

export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell><ModuleAccessGate module="PAYROLL" anyPermissions={[...moduleAccessPermissions.PAYROLL]}>{children}</ModuleAccessGate></AppShell>;
}
