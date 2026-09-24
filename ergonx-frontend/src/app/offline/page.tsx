import Link from "next/link";

export const dynamic = "force-static";

/** Generic fallback only; authenticated work and API responses are never cached. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">ErgonX</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">You are offline</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">ErgonX does not cache institution records or authenticated actions. Reconnect to continue securely.</p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Try again</Link>
      </section>
    </main>
  );
}
