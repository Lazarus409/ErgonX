"use client";

import { LogOut, Moon, ShieldAlert, Sun, UserRoundCog } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { AdaptiveLogo } from "@/components/brand/Logo";
import { useTheme } from "@/components/context/ThemeProvider";
import { useAuth } from "@/components/guards/AuthProvider";
import { Button, IconButton } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Card";
import LoadingState from "@/components/ui/LoadingState";
import Tabs from "@/components/ui/Tabs";

const sections = [
  { value: "overview", label: "Overview", href: "/platform" },
  { value: "organizations", label: "Organizations", href: "/platform/organizations" },
  { value: "invitations", label: "Invitations", href: "/platform/invitations" },
  { value: "audit", label: "Audit log", href: "/platform/audit" },
];

function activeSection(pathname: string) {
  const match = sections.slice(1).find((section) => pathname.startsWith(section.href));
  return match?.value ?? (pathname === "/platform" ? "overview" : "");
}

/** Super Admin console shell: one header and section nav for every /platform page. */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isPlatformAdmin, loading, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (loading) return <LoadingState variant="splash" />;
  if (!isPlatformAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-elevation-3">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger" aria-hidden="true"><ShieldAlert className="h-6 w-6" /></span>
          <h1 className="mt-5 text-heading font-semibold text-ink-strong">Platform access required</h1>
          <p className="mt-2 text-support text-ink-muted">This workspace is only available to ErgonX Super Admins.</p>
        </div>
      </main>
    );
  }

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Super Administrator";
  const section = activeSection(pathname);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-10">
          <AdaptiveLogo height={26} priority />
          <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
          <p className="hidden text-sm font-semibold text-ink-strong sm:block">Platform control</p>
          <div className="flex-1" />
          <IconButton label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</IconButton>
          <div className="hidden items-center gap-2.5 md:flex">
            <Avatar name={fullName} size="sm" />
            <div className="leading-tight"><p className="text-support font-semibold text-ink-strong">{fullName}</p><p className="text-caption text-ink-muted">Super Administrator</p></div>
          </div>
          <Button variant="secondary" size="sm" className="hidden md:inline-flex" leadingIcon={<UserRoundCog className="h-4 w-4" />} onClick={() => router.push("/platform/profile")}>My profile</Button>
          <Button variant="ghost" size="sm" leadingIcon={<LogOut className="h-4 w-4" />} onClick={() => { logout(); router.replace("/login"); }}><span className="hidden sm:inline">Sign out</span></Button>
        </div>
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <Tabs label="Platform sections" value={section} items={sections} />
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
