import AppShell from "@/components/layout/AppShell";
import ModuleAccessGate from "@/components/guards/ModuleAccessGate";

/** Everyone signed in has a My Work page; each section is limited by the API to what they can act on. */
export default function MyWorkLayout({ children }: { children: React.ReactNode }) {
  return <AppShell><ModuleAccessGate anyPermissions={["home.view"]}>{children}</ModuleAccessGate></AppShell>;
}
