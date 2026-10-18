import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate anyPermissions={["settings.security.manage", "audit.view"]}>{children}</ModuleAccessGate></AppShell>;
}
