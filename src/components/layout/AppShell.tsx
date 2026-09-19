"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import DesktopDock from "@/components/layout/DesktopDock";
import TopBar from "@/components/layout/TopBar";
import AuthenticationGate from "@/components/guards/AuthenticationGate";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <AuthenticationGate>
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="lg:hidden"><Sidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} /></div>
      <DesktopDock />

      <div
        className="min-h-screen"
      >
        <TopBar />

        <main className="p-4 pb-24 sm:p-6 sm:pb-28">
          {children}
        </main>
      </div>
    </div>
    </AuthenticationGate>
  );
}
