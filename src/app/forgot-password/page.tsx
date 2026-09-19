"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";

import { authApi, getApiErrorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-9"><Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />Back to sign in</Link><div className="mt-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sky-300"><MailCheck className="h-6 w-6" /></div><h1 className="mt-5 text-2xl font-semibold tracking-tight">Reset your password</h1><p className="mt-2 text-sm leading-6 text-slate-500">Enter your sign-in email and we’ll send a secure password reset link if an active account exists.</p>{sent ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">If an active ErgonX account matches that email, a password reset link has been sent. Check your inbox and spam folder.</div> : <form onSubmit={submit} className="mt-7 space-y-5">{error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<label className="block text-sm font-medium text-slate-700">Sign-in email<input required autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100" /></label><button disabled={saving} className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Sending..." : "Send reset link"}</button></form>}</section></main>;
}
