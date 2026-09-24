"use client";

import { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";
import { moduleAccessPermissions } from "@/components/navigation/navigation";

export default function LeaveLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell><ModuleAccessGate module="LEAVE" anyPermissions={[...moduleAccessPermissions.LEAVE]}>{children}</ModuleAccessGate></AppShell>;
}
