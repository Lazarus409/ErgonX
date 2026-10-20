import Link from "next/link";

import { buttonClasses } from "@/components/ui/Button";

/** Unknown addresses: say so plainly and offer a way back. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-caption font-semibold uppercase tracking-[0.12em] text-primary-ink">Page not found</p>
      <h1 className="mt-2 text-section-title font-bold text-ink-strong">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-support text-ink-muted">The link may be old, or the page may have moved. Records you can&apos;t access also show here.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClasses({ variant: "primary" })}>Go to Home</Link>
        <Link href="/my-work" className={buttonClasses({ variant: "secondary" })}>Open My Work</Link>
      </div>
    </main>
  );
}
