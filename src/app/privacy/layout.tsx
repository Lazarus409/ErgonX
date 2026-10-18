import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate anyPermissions={["privacy.view", "privacy.manage"]}>{children}</ModuleAccessGate></AppShell>;
}
