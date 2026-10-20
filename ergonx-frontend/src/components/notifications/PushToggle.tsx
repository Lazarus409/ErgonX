"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/api";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";

const EXPLANATION: Record<PushState, string> = {
  unsupported: "This browser can't show push notifications. On iPhone, add ErgonX to your Home Screen first.",
  unavailable: "Push notifications aren't set up on this server yet.",
  denied: "Notifications are blocked for ErgonX in this browser's settings. Allow them there, then come back.",
  off: "Get approvals, payslips and other updates on this device's lock screen, even when ErgonX is closed.",
  on: "This device receives push notifications.",
};

/** Turns web push on or off for the current browser or phone. */
export default function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pushState().then((result) => { setState(result.state); setPublicKey(result.publicKey); }).catch(() => setState("unavailable"));
  }, []);

  const toggle = async () => {
    setBusy(true); setError(null);
    try { setState(state === "on" ? await disablePush() : await enablePush(publicKey)); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  if (state === null) return null;
  return (
    <section className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-line p-3" aria-label="Push notifications on this device">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink-strong">Notifications on this device</p>
        <p className="text-caption text-ink-muted">{EXPLANATION[state]}</p>
        {error && <p role="alert" className="mt-1 text-caption text-danger-ink">{error}</p>}
      </div>
      {(state === "on" || state === "off") && <Button size="sm" variant={state === "on" ? "secondary" : "primary"} loading={busy} onClick={() => void toggle()}>{state === "on" ? "Turn off" : "Turn on"}</Button>}
    </section>
  );
}
