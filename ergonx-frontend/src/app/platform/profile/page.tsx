"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowLeft, KeyRound, Save, ShieldAlert } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/guards/AuthProvider";
import ErrorState from "@/components/ui/ErrorState";
import LoadingState from "@/components/ui/LoadingState";
import { authApi, getApiErrorMessage } from "@/lib/api";
import { useApiResource } from "@/lib/useApiResource";

export default function PlatformProfilePage() {
  const router = useRouter();
  const { isPlatformAdmin, loading, refreshSession } = useAuth();
  const load = useCallback(() => authApi.getAccountProfile(), []);
  const { data, loading: loadingProfile, error, reload } = useApiResource(load);
  const [profile, setProfile] = useState<{ first_name?: string; last_name?: string; email?: string }>({});
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setSavingProfile(true); setProfileError(null); setProfileSuccess(false);
    try {
      await authApi.updateAccountProfile({
        first_name: profile.first_name ?? data?.first_name,
        last_name: profile.last_name ?? data?.last_name,
        email: profile.email ?? data?.email,
      });
      await refreshSession();
      setProfileSuccess(true);
      reload();
    } catch (caught) { setProfileError(getApiErrorMessage(caught)); } finally { setSavingProfile(false); }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setPasswordError(null); setPasswordSuccess(false);
    if (newPassword !== confirmPassword) { setPasswordError("The new password and confirmation do not match."); return; }
    setSavingPassword(true);
    try {
      await authApi.changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setPasswordSuccess(true);
    } catch (caught) { setPasswordError(getApiErrorMessage(caught)); } finally { setSavingPassword(false); }
  };

  if (loading || loadingProfile) return <LoadingState />;
  if (!isPlatformAdmin) return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6"><div className="max-w-md rounded-3xl bg-white p-8 text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-600" /><h1 className="mt-4 text-xl font-semibold">Platform access required</h1></div></main>;
  if (error || !data) return <ErrorState message={error ?? "Could not load your account."} onRetry={reload} />;

  return <main className="min-h-screen bg-[#f4f7fb] px-4 py-6 text-slate-950 sm:px-6 lg:px-10 lg:py-8"><div className="mx-auto max-w-5xl"><button onClick={() => router.push("/platform")} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"><ArrowLeft className="h-4 w-4" />Back to platform workspace</button><header className="mt-6 rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-lg"><img src="/ergonx-logo.png" alt="ErgonX" className="h-full w-full object-contain" /></div><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-sky-300">Account settings</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Your Super Admin profile</h1><p className="mt-2 text-sm text-slate-300">Manage your platform identity and account security.</p></div></div></header><div className="mt-6 grid gap-6 lg:grid-cols-2"><form onSubmit={saveProfile} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.04)]"><h2 className="text-lg font-semibold">Profile details</h2><p className="mt-1 text-sm text-slate-500">Your email is your sign-in identifier.</p>{profileError && <Notice type="error" message={profileError} />}{profileSuccess && <Notice type="success" message="Profile saved successfully." />}<div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="First name" value={profile.first_name ?? data.first_name ?? ""} onChange={(value) => setProfile((current) => ({ ...current, first_name: value }))} /><Field label="Last name" value={profile.last_name ?? data.last_name ?? ""} onChange={(value) => setProfile((current) => ({ ...current, last_name: value }))} /><div className="sm:col-span-2"><Field label="Sign-in email" type="email" value={profile.email ?? data.email ?? ""} onChange={(value) => setProfile((current) => ({ ...current, email: value }))} /></div></div><button disabled={savingProfile} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{savingProfile ? "Saving..." : "Save profile"}</button></form><form onSubmit={changePassword} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.04)]"><div className="flex items-start gap-3"><div className="rounded-xl bg-sky-50 p-2 text-sky-700"><KeyRound className="h-5 w-5" /></div><div><h2 className="text-lg font-semibold">Password and security</h2><p className="mt-1 text-sm text-slate-500">Set a new password by confirming your current password.</p></div></div>{passwordError && <Notice type="error" message={passwordError} />}{passwordSuccess && <Notice type="success" message="Your password has been updated." />}<div className="mt-6 space-y-4"><Field label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} /><Field label="New password" type="password" value={newPassword} onChange={setNewPassword} /><Field label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} /></div><button disabled={savingPassword} className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"><KeyRound className="h-4 w-4" />{savingPassword ? "Updating..." : "Change password"}</button><p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">Forgot your password? Use the <a className="font-semibold text-slate-700 underline" href="/forgot-password">email reset page</a> to receive a secure reset link.</p></form></div></div></main>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block text-sm font-medium text-slate-700">{label}<input required type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100" /></label>; }
function Notice({ type, message }: { type: "error" | "success"; message: string }) { return <p className={`mt-5 rounded-xl border p-3 text-sm ${type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</p>; }
