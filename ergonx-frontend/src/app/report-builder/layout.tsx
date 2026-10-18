import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";

/** Department heads build reports on their team too, so this isn't limited to the Reports module. */
export default function ReportBuilderLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate anyPermissions={["employee.view", "candidate.view", "report.view"]}>{children}</ModuleAccessGate></AppShell>;
}
