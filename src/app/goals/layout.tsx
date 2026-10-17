import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";

/** Everyone has goals; the API limits which goals each person sees and may change. */
export default function GoalsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate anyPermissions={["home.view"]}>{children}</ModuleAccessGate></AppShell>;
}
