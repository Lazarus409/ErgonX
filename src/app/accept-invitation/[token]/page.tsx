"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { authApi, getApiErrorMessage } from "@/lib/api";
import type { InvitationAccessPreview, InvitationDetails } from "@/lib/api/auth";

export default function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [acceptedPreview, setAcceptedPreview] = useState<InvitationAccessPreview | null>(null);
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authApi.getInvitation(token).then(setDetails).catch((caught) => setError(getApiErrorMessage(caught)));
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await authApi.acceptInvitation(token, {
        password,
        first_name: firstName,
        last_name: lastName,
      });
      setAccepted(true);
      setAcceptedPreview(result.access_preview ?? details?.access_preview ?? null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const preview = acceptedPreview ?? details?.access_preview;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_20px_55px_rgba(15,23,42,0.08)] sm:p-9">
        {accepted ? (
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-sky-700">Access configured</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">You are ready to sign in.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">Your {preview?.role_name ?? details?.role_name} access for {details?.institution_name} has been activated.</p>
            {preview && <AccessPreview preview={preview} />}
            <Link href="/login" className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Sign in to ErgonX</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">ErgonX invitation</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Accept invitation</h1>
            {details && <p className="mt-3 text-sm leading-6 text-slate-600">Join {details.institution_name} as {details.role_name} using {details.email}.</p>}
            {preview && <AccessPreview preview={preview} />}
            {details?.existing_account && <p className="mt-5 rounded-xl bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">This email already has an ErgonX account. Enter its current password to add this role.</p>}
            {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {details && <div className="mt-6 space-y-4">
              {!details.existing_account && <div className="grid gap-4 sm:grid-cols-2"><input required value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /><input required value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" /></div>}
              <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={details.existing_account ? "Current password" : "Create password"} autoComplete={details.existing_account ? "current-password" : "new-password"} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" />
              <button disabled={saving} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Activating access…" : "Accept invitation"}</button>
            </div>}
          </form>
        )}
      </section>
    </main>
  );
}

function AccessPreview({ preview }: { preview: InvitationAccessPreview }) {
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-sky-700" /><h2 className="font-semibold text-slate-950">Your access</h2></div><p className="mt-2 text-sm text-slate-600">Role: <span className="font-medium text-slate-900">{preview.role_name}</span></p><div className="mt-4 flex flex-wrap gap-2">{preview.modules.length ? preview.modules.map((module) => <span key={module.code} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">{module.name}</span>) : <span className="text-sm text-slate-500">Your administrator will enable the applicable modules.</span>}</div></section>;
}
