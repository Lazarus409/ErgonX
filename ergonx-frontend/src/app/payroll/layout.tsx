"use client";

import AppShell from "@/components/layout/AppShell";

export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}