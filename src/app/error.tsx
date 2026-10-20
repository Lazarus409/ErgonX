"use client";

import Link from "next/link";
import { useEffect } from "react";

import { buttonClasses } from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";

/** Any page that throws while rendering lands here instead of a blank screen. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState
        title="Something went wrong"
        message="This page hit an unexpected problem. Your data is safe. Try again, or go back to Home."
        onRetry={reset}
        action={<Link href="/" className={buttonClasses({ variant: "secondary" })}>Go to Home</Link>}
        details={error.digest ? `Reference: ${error.digest}` : error.message}
      />
    </main>
  );
}
