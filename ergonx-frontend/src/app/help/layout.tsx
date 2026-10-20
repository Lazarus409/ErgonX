import AppShell from "@/components/layout/AppShell";

/** Help is open to everyone signed in. */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
