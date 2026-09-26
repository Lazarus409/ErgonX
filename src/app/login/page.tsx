"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/guards/AuthProvider";
import { getApiErrorMessage } from "@/lib/api";
import type { SessionBootstrap } from "@/types/auth";
import PasswordStrength from "@/components/ui/PasswordStrength";
import AuthShell, { AuthHeading } from "@/components/brand/AuthShell";
import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { IDLE_MINUTES } from "@/components/guards/IdleSignOut";

function resolvePostLoginHref(bootstrap: SessionBootstrap): string {
  if (bootstrap.defaultLanding === "PLATFORM") {
    return "/platform";
  }
  return "/";
}

export default function LoginPage() {
  const { login, logout } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [emailOtp, setEmailOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // Read once on arrival; avoids a Suspense boundary for useSearchParams.
    if (new URLSearchParams(window.location.search).get("reason") === "idle") {
      queueMicrotask(() => setNotice(`You were signed out after ${IDLE_MINUTES} minutes of inactivity. Sign in again to continue.`));
    }
  }, []);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      const bootstrap = await login(email, password, mfaCode || undefined, remember);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : resolvePostLoginHref(bootstrap));
    } catch (err: unknown) {
      const apiError = err as { code?: string };
      if (apiError.code === "mfa_required") { setMfaRequired(true); setEmailOtp(false); setError("Enter the six-digit code from your authenticator app."); }
      else if (apiError.code === "email_otp_required") { setMfaRequired(true); setEmailOtp(true); setError("Enter the six-digit verification code sent to your email."); }
      else if (apiError.code === "institution_suspended") {
        // Credentials were valid but the organization is suspended: drop the session.
        logout();
        setError(getApiErrorMessage(err));
      }
      else setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resendEmailCode = async () => {
    setError("");
    setMfaCode("");
    try {
      setLoading(true);
      await login(email, password, undefined, remember);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "email_otp_required") setError("Enter the six-digit verification code sent to your email. A new code was sent; earlier codes no longer work.");
      else setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthHeading eyebrow="Secure sign in" title="Welcome back" description="Sign in to continue to your ErgonX workspace." />
      <form onSubmit={handleSubmit} className="space-y-5">
        {notice && !error && <Alert tone="info">{notice}</Alert>}
        {error && <Alert tone={error.startsWith("Enter the six-digit") ? "info" : "danger"}>{error}</Alert>}
        <Field label="Email address">
          <Input id="email" required type="email" size="lg" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@organization.com" autoComplete="email" leadingIcon={<Mail />} />
        </Field>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-support font-semibold text-ink-strong">Password</label>
            <Link href="/forgot-password" className="text-support font-semibold text-primary-ink hover:underline">Forgot password?</Link>
          </div>
          <Input
            id="password"
            required
            size="lg"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            leadingIcon={<LockKeyhole />}
            trailingSlot={
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="rounded-lg p-2 text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink-strong" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
          />
          <PasswordStrength value={password} />
        </div>
        {mfaRequired && (
          <div>
          <Field label={emailOtp ? "Email verification code" : "Authenticator code"}>
            <Input id="mfa-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required size="lg" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" autoComplete="one-time-code" className="text-center text-lg tracking-[0.4em] tabular-nums" />
          </Field>
          {emailOtp && <button type="button" disabled={loading} onClick={() => void resendEmailCode()} className="mt-2 text-support font-semibold text-primary-ink hover:underline disabled:opacity-60">Resend code</button>}
          </div>
        )}
        <Checkbox
          id="remember"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          label="Keep me signed in"
          description={`For 7 days on this device. Leave unticked on a shared computer: you'll be signed out when the browser closes or after ${IDLE_MINUTES} minutes of inactivity.`}
        />
        <Button type="submit" size="lg" block loading={loading} loadingLabel="Signing in…" trailingIcon={<ArrowRight className="h-4 w-4" />}>Sign in</Button>
      </form>
      <p className="mt-8 text-center text-support text-ink-muted">New to ErgonX? <Link href="/get-started" className="font-semibold text-primary-ink hover:underline">Get started</Link></p>
    </AuthShell>
  );
}
