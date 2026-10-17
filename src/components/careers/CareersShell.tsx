import type { ReactNode } from "react";

/** The public careers pages: a plain branded frame, outside the signed-in app shell. */
export default function CareersShell({ organisation, children }: { organisation?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
          <p className="text-card-title font-bold text-ink-strong">{organisation ? `${organisation} careers` : "Careers"}</p>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-4xl px-4 pb-8 text-caption text-ink-muted">Recruitment powered by ErgonX.</footer>
    </div>
  );
}
