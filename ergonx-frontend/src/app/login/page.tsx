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
import PasswordStrength from "@/components/ui/PasswordStrength";

function resolvePostLoginHref(bootstrap: SessionBootstrap): string {
  if (bootstrap.defaultLanding === "PLATFORM") {
    return "/platform";
  }
  return "/";
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [emailOtp, setEmailOtp] = useState(false);
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
      const bootstrap = await login(email, password, mfaCode || undefined);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : resolvePostLoginHref(bootstrap));
    } catch (err: unknown) {
      const apiError = err as { code?: string };
      if (apiError.code === "mfa_required") { setMfaRequired(true); setEmailOtp(false); setError("Enter the six-digit code from your authenticator app."); }
      else if (apiError.code === "email_otp_required") { setMfaRequired(true); setEmailOtp(true); setError("Enter the six-digit verification code sent to your email."); }
      else setError(getApiErrorMessage(err));
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
            <PasswordStrength value={password} />
            {mfaRequired && <div><label htmlFor="mfa-code" className="mb-2 block text-sm font-semibold text-slate-800">{emailOtp ? "Email verification code" : "Authenticator code"}</label><input id="mfa-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-center text-lg tracking-[0.4em] text-slate-950 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /></div>}
            <button type="submit" disabled={loading} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(15,23,42,0.15)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Signing in…" : <>Sign in <ArrowRight className="h-4 w-4" /></>}</button>
          </form>
          <p className="mt-8 text-center text-sm text-slate-500">New to ErgonX? <Link href="/get-started" className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900">Get started</Link></p>
    </section>
  </main>;
}
