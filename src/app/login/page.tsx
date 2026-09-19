"use client";

import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/guards/AuthProvider";
import { getApiErrorMessage } from "@/lib/api";
import type { SessionBootstrap } from "@/types/auth";

const dashboardLandingRoutes: Record<string, string> = {
  executive: "/dashboard",
  hr: "/hr/dashboard",
  leave: "/leave/dashboard",
  attendance: "/attendance/dashboard",
  payroll: "/payroll/dashboard",
  finance: "/accounting/dashboard",
};

function resolvePostLoginHref(bootstrap: SessionBootstrap): string {
  if (bootstrap.defaultLanding === "PLATFORM") {
    return "/platform";
  }

  const roleLanding: Record<string, string> = {
    HR_ADMIN: "/hr",
    FINANCE_MANAGER: "/accounting",
    ACCOUNTANT: "/accounting",
    AUDITOR: "/accounting",
    DIRECTOR: "/dashboard",
    EMPLOYEE: "/me",
  };
  const roleRoute = roleLanding[bootstrap.roleCode ?? ""];
  if (roleRoute) {
    return roleRoute;
  }
  if (bootstrap.defaultLanding !== "DASHBOARD") {
    return "/";
  }

  return (
    bootstrap.availableDashboards
      .map((dashboard) => dashboardLandingRoutes[dashboard])
      .find((route): route is string => Boolean(route)) ?? "/"
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      const bootstrap = await login(email, password);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : resolvePostLoginHref(bootstrap));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#f5f7fa] px-4 py-8 sm:px-6">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.09)] sm:px-10 sm:py-10">
        <div className="mb-10 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 p-2"><Image src="/ergonx-logo.png" alt="ErgonX" width={44} height={44} className="h-full w-full object-contain" priority /></div><div><p className="text-base font-bold tracking-[0.13em] text-slate-950">ERGONX</p><p className="text-xs text-slate-500">Workforce &amp; Financial Management</p></div></div>
          <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">Secure sign in</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h2><p className="mt-2 text-sm leading-6 text-slate-500">Sign in to continue to your ErgonX workspace.</p></div>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}
            <div><label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-800">Email address</label><div className="relative"><Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input id="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@organization.com" autoComplete="email" className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /></div></div>
            <div><div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-semibold text-slate-800">Password</label><Link href="/forgot-password" className="text-sm font-semibold text-sky-700 transition hover:text-sky-900">Forgot password?</Link></div><div className="relative"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input id="password" required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></div>
            <button type="submit" disabled={loading} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.15)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Signing in…" : <>Sign in <ArrowRight className="h-4 w-4" /></>}</button>
          </form>
          <p className="mt-8 text-center text-sm text-slate-500">New to ErgonX? <Link href="/get-started" className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900">Get started</Link></p>
    </section>
  </main>;
}
