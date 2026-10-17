import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";

/** Anyone can be asked for 360 feedback; the API lists only their own requests. */
export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate anyPermissions={["home.view"]}>{children}</ModuleAccessGate></AppShell>;
}
