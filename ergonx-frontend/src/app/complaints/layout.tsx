import AppShell from "@/components/layout/AppShell";

/** A complaint is opened by the employee who filed it or by HR; the API decides who sees what. */
export default function ComplaintsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
