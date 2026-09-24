import ModuleAccessGate from "@/components/guards/ModuleAccessGate";
import AppShell from "@/components/layout/AppShell";
import { moduleAccessPermissions } from "@/components/navigation/navigation";

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate module="ATTENDANCE" anyPermissions={[...moduleAccessPermissions.ATTENDANCE]}>{children}</ModuleAccessGate></AppShell>;
}
