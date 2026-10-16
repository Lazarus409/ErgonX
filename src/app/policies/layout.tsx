import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";

/** Policies sit outside /hr so Directors and Auditors with policy.view can follow up on acknowledgements. */
export default function PoliciesLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate anyPermissions={["policy.view", "policy.manage"]}>{children}</ModuleAccessGate></AppShell>;
}
