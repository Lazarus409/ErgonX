"use client";

import { KeyRound, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import ErrorState from "@/components/ui/ErrorState";
import PageHeader from "@/components/ui/PageHeader";
import { authApi, beginMFASetup, confirmMFASetup, disableMFA, getApiErrorMessage, getMFAStatus, setMFAMethod } from "@/lib/api";
import PasswordStrength from "@/components/ui/PasswordStrength";
import { QRCodeSVG } from "qrcode.react";
import { buttonClasses } from "@/components/ui/Button";

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [mfa, setMfa] = useState<{ enabled: boolean; pending: boolean; method?: "AUTHENTICATOR_APP" | "EMAIL_OTP" | null; secret?: string; otpauth_uri?: string }>({ enabled: false, pending: false });
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMessage, setMfaMessage] = useState("");
  useEffect(() => { getMFAStatus().then(setMfa).catch(() => undefined); }, []);
  const startMFA = async () => { try { setMfa(await beginMFASetup()); setMfaMessage("Scan the URI with your authenticator app, then enter the generated six-digit code."); } catch (caught) { setMfaMessage(getApiErrorMessage(caught)); } };
  const confirmMFA = async () => { try { setMfa(await confirmMFASetup(mfaCode)); setMfaCode(""); setMfaMessage("Multi-factor authentication is enabled."); } catch (caught) { setMfaMessage(getApiErrorMessage(caught)); } };
  const removeMFA = async () => { try { setMfa(await disableMFA()); setMfaMessage("Multi-factor authentication is disabled."); } catch (caught) { setMfaMessage(getApiErrorMessage(caught)); } };
  const enableEmailMFA = async () => { try { setMfa(await setMFAMethod("EMAIL_OTP")); setMfaMessage("Email OTP MFA is enabled. A code will be sent at sign in."); } catch (caught) { setMfaMessage(getApiErrorMessage(caught)); } };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setSaved(false);
    if (newPassword !== confirmation) { setError("The new password and confirmation do not match."); return; }
    setSaving(true);
    try { await authApi.changePassword({ current_password: currentPassword, new_password: newPassword }); setCurrentPassword(""); setNewPassword(""); setConfirmation(""); setSaved(true); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };
  return <div className="mx-auto max-w-3xl space-y-6"><PageHeader title="Security" description="Manage password and optional multi-factor protection for your ErgonX account." />{error && <ErrorState title="Unable to change password" message={error} />}<form onSubmit={save} className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink"><KeyRound size={19} /></span><div><h2 className="font-semibold text-ink-strong">Change password</h2><p className="mt-1 text-sm leading-6 text-ink-muted">Confirm your current password before setting a new one.</p></div></div><div className="mt-6 space-y-5"><Field label="Current password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" /><Field label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" /><PasswordStrength value={newPassword} /><Field label="Confirm new password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" /></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-5"><a href="/forgot-password" className="text-sm font-semibold text-primary-ink hover:text-primary">Forgot your current password?</a><button type="submit" disabled={saving || !currentPassword || !newPassword || !confirmation} className={buttonClasses({ variant: "primary" })}><Save size={16} />{saving ? "Changing…" : "Change password"}</button></div>{saved && <p className="mt-4 rounded-xl border border-success/25 bg-success-soft p-3 text-sm text-success-ink">Your password was changed successfully.</p>}</form><section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><ShieldCheck className="text-primary-ink" /><div><h2 className="font-semibold text-ink-strong">Multi-factor authentication</h2><p className="mt-1 text-sm leading-6 text-ink-muted">Use an authenticator app or email code for an additional sign-in challenge. This is optional.</p></div></div>{mfa.enabled ? <><p className="mt-5 rounded-xl bg-success-soft p-3 text-sm text-success-ink">{mfa.method === "EMAIL_OTP" ? "Email OTP MFA is enabled for this account." : "Authenticator MFA is enabled for this account."}</p>{mfa.method !== "EMAIL_OTP" && <button type="button" onClick={() => void enableEmailMFA()} className="mt-4 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink">Switch to email OTP</button>}<button type="button" onClick={() => void removeMFA()} className="mt-4 ml-2 rounded-xl border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger-ink">Disable MFA</button></> : <><button type="button" onClick={() => void startMFA()} className={buttonClasses({ variant: "primary", className: "mt-4" })}>Set up authenticator</button><button type="button" onClick={() => void enableEmailMFA()} className="mt-4 ml-2 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink">Enable email OTP</button>{mfa.pending && <div className="mt-5 space-y-3 rounded-xl bg-surface-muted p-4"><div className="flex flex-wrap items-start gap-5"><div className="rounded-xl bg-surface p-3 shadow-sm"><QRCodeSVG value={mfa.otpauth_uri ?? ""} size={148} includeMargin /></div><div className="min-w-0 flex-1"><p className="text-xs text-ink-muted">Scan this QR code with your authenticator app, or use the manual key below.</p><p className="mt-3 text-xs font-medium text-ink-muted">Manual setup key</p><code className="block break-all font-mono text-sm text-ink-strong">{mfa.secret}</code></div></div><label className="grid gap-1 text-sm font-medium">Verification code<input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" className="h-11 rounded-xl border px-3" /></label><button type="button" onClick={() => void confirmMFA()} disabled={mfaCode.length !== 6} className={buttonClasses({ variant: "primary" })}>Confirm and enable</button></div>}</>}{mfaMessage && <p className="mt-3 text-sm text-ink-muted">{mfaMessage}</p>}</section></div>;
}

function Field({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) { return <label className="block text-sm font-medium text-ink"><span>{label}</span><input required type="password" value={value} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block w-full h-9 rounded-lg border border-line-strong px-3 text-sm text-ink-strong" /></label>; }
