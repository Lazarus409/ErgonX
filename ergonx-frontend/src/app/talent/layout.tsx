import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";

/** Confidential: HR and leadership with talent.view only. */
export default function TalentLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate anyPermissions={["talent.view", "talent.manage"]}>{children}</ModuleAccessGate></AppShell>;
}
