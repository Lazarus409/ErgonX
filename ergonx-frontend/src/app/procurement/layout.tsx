"use client";

import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";
import { INSTITUTION_WIDE, moduleWorkspacePermissions } from "@/components/navigation/navigation";

export default function ProcurementLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <ModuleAccessGate module="PROCUREMENT" anyPermissions={moduleWorkspacePermissions.PROCUREMENT} scopes={INSTITUTION_WIDE} selfService={{ href: "/me/purchases", permission: "requisition.create_own" }}>
        {children}
      </ModuleAccessGate>
    </AppShell>
  );
}
