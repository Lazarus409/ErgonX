import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

import AuthShell, { AuthHeading } from "@/components/brand/AuthShell";
import Alert from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";

const steps = [
  ["Receive an invitation", "Your Super Admin, Institution Admin, or HR team sends an invitation to your work email."],
  ["Create your account", "Open the secure link in the email and set your password."],
  ["Sign in", "Return to ErgonX and access the workspace assigned to your role."],
];

export default function GetStartedPage() {
  return (
    <AuthShell>
      <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-support font-semibold text-ink-muted hover:text-ink-strong"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to sign in</Link>
      <AuthHeading eyebrow="Get started" title="Get your ErgonX account." description="ErgonX accounts are created through a secure invitation. It takes just a few steps." />
      <ol className="space-y-5">
        {steps.map(([title, description], index) => (
          <li key={title} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-ink">{index + 1}</span>
            <div>
              <h2 className="font-semibold text-ink-strong">{title}</h2>
              <p className="mt-0.5 text-support text-ink-muted">{description}</p>
            </div>
          </li>
        ))}
      </ol>
      <Alert tone="info" title="Need an invitation?" className="mt-8">
        Contact your organization&apos;s administrator. New organizations must be invited by an ErgonX Super Admin.
      </Alert>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-support text-ink-muted"><ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />Invitation links are secure and single-use.</p>
        <ButtonLink href="/login" trailingIcon={<ArrowRight className="h-4 w-4" />}>Go to sign in</ButtonLink>
      </div>
    </AuthShell>
  );
}
