"use client";

import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";
import { moduleAccessPermissions } from "@/components/navigation/navigation";

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell><ModuleAccessGate module="ACCOUNTING" anyPermissions={[...moduleAccessPermissions.ACCOUNTING]}>{children}</ModuleAccessGate></AppShell>;
}
