"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import AuthenticationGate from "@/components/guards/AuthenticationGate";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const breakpointMatchesRef = useRef<boolean | null>(null);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    breakpointMatchesRef.current = desktopQuery.matches;

    const closeMobileNavigationAtBreakpoint = () => {
      if (breakpointMatchesRef.current === desktopQuery.matches) return;

      breakpointMatchesRef.current = desktopQuery.matches;
      setMobileNavigationOpen(false);
    };

    desktopQuery.addEventListener("change", closeMobileNavigationAtBreakpoint);
    return () => desktopQuery.removeEventListener("change", closeMobileNavigationAtBreakpoint);
  }, []);

  return (
    <AuthenticationGate>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          mobileOpen={mobileNavigationOpen}
          onMobileClose={() => setMobileNavigationOpen(false)}
        />

        <div className={`min-h-screen transition-[padding] duration-200 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
          <TopBar onOpenSidebar={() => setMobileNavigationOpen(true)} />

          <main className="p-4 sm:p-6 xl:p-8">
            <div className="mx-auto max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
    </AuthenticationGate>
  );
}
