"use client";

/** Last resort when the root layout itself fails, so styles and providers may be missing. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "4rem 1rem", color: "#0f172a" }}>
        <main style={{ maxWidth: 520, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.5rem" }}>Something went wrong</h1>
          <p>ErgonX could not load. Your data is safe. Try again in a moment.</p>
          {error.digest && <p style={{ color: "#64748b", fontSize: "0.875rem" }}>Reference: {error.digest}</p>}
          <button type="button" onClick={reset} style={{ marginTop: "1rem", padding: "0.6rem 1rem", borderRadius: 8, border: 0, background: "#0b192c", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
