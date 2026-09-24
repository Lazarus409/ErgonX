import ModuleAccessGate from "@/components/guards/ModuleAccessGate";
import AppShell from "@/components/layout/AppShell";
import { moduleAccessPermissions } from "@/components/navigation/navigation";

export default function RecruitmentLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate module="RECRUITMENT" anyPermissions={[...moduleAccessPermissions.RECRUITMENT]}>{children}</ModuleAccessGate></AppShell>;
}
