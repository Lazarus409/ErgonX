"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

import { authApi, getApiErrorMessage } from "@/lib/api";

export default function ResetPasswordPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("The new password and confirmation do not match.");
      return;
    }
    setSaving(true);
    try {
      await authApi.confirmPasswordReset({ uid, token, new_password: password });
      setSuccess(true);
      window.setTimeout(() => router.replace("/login"), 1300);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-9"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sky-300"><KeyRound className="h-6 w-6" /></div><h1 className="mt-5 text-2xl font-semibold tracking-tight">Choose a new password</h1><p className="mt-2 text-sm leading-6 text-slate-500">Use a strong password you have not used elsewhere.</p>{success ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Password updated. Redirecting you to sign in…</div> : <form onSubmit={submit} className="mt-7 space-y-5">{error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Field label="New password" value={password} onChange={setPassword} /><Field label="Confirm new password" value={confirmation} onChange={setConfirmation} /><button disabled={saving} className="h-11 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Updating..." : "Set new password"}</button></form>}<Link href="/login" className="mt-6 block text-center text-sm font-semibold text-slate-600 hover:text-slate-950">Return to sign in</Link></section></main>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-sm font-medium text-slate-700">{label}<input required minLength={8} type="password" autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100" /></label>; }
