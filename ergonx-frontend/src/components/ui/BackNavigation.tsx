"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackNavigation({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const router = useRouter();
  const goBack = () => {
    // A direct link, bookmark, or cross-site referrer must return to the
    // logical parent instead of unexpectedly navigating away from ErgonX.
    const cameFromThisApp = document.referrer
      ? new URL(document.referrer).origin === window.location.origin
      : false;
    if (cameFromThisApp && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  };
  return <button type="button" onClick={goBack} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />{label}</button>;
}
