"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Send, ShieldCheck } from "lucide-react";

import AuthShell, { AuthHeading } from "@/components/brand/AuthShell";
import Alert from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { authApi, getApiErrorMessage, isApiRequestError } from "@/lib/api";
import type { InstitutionAccessRequestPayload } from "@/lib/api/auth";

const steps = [
  ["Request an invitation", "Tell us about your organization below. An ErgonX Super Admin reviews every request."],
  ["Receive a secure link", "Once approved, the administrator you name gets a single-use link by email."],
  ["Set up your organization", "Open the link, create your administrator account, then invite your team."],
];

const countries = [
  ["GH", "Ghana"],
  ["NG", "Nigeria"],
  ["KE", "Kenya"],
  ["ZA", "South Africa"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
];

type FormState = Required<Omit<InstitutionAccessRequestPayload, "organization_size">> & { organization_size: InstitutionAccessRequestPayload["organization_size"] };

const emptyForm: FormState = {
  institution_name: "",
  contact_name: "",
  job_title: "",
  email: "",
  phone: "",
  country_code: "GH",
  organization_size: "",
  message: "",
  website: "",
};

const fieldNames = ["institution_name", "contact_name", "job_title", "email", "phone", "country_code", "organization_size", "message"] as const;

export default function GetStartedPage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedTo, setSubmittedTo] = useState<string | null>(null);

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.institution_name.trim()) nextErrors.institution_name = "Organization name is required.";
    if (!form.contact_name.trim()) nextErrors.contact_name = "Your name is required.";
    if (!form.email.trim()) nextErrors.email = "Work email is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await authApi.submitInstitutionAccessRequest({ ...form, email: form.email.trim() });
      setSubmittedTo(form.email.trim());
      setForm(emptyForm);
    } catch (caught) {
      if (isApiRequestError(caught) && caught.status === 429) {
        setFormError("Too many requests from this network. Please try again in an hour.");
      } else if (isApiRequestError(caught) && caught.fieldErrors) {
        const serverErrors: Partial<Record<keyof FormState, string>> = {};
        for (const name of fieldNames) {
          const message = caught.fieldError(name);
          if (message) serverErrors[name] = message;
        }
        setErrors(serverErrors);
        setFormError(Object.keys(serverErrors).length ? "Please correct the highlighted fields." : getApiErrorMessage(caught));
      } else {
        setFormError(getApiErrorMessage(caught));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell width="lg">
      <Link href="/login" className="mb-8 inline-flex items-center gap-2 text-support font-semibold text-ink-muted hover:text-ink-strong"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to sign in</Link>
      <AuthHeading eyebrow="Get started" title="Bring your organization to ErgonX." description="New organizations join by invitation from an ErgonX Super Admin. Request yours in a few steps." />
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map(([title, description], index) => (
          <li key={title} className="flex gap-3 sm:flex-col">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-ink">{index + 1}</span>
            <div>
              <h2 className="font-semibold text-ink-strong">{title}</h2>
              <p className="mt-0.5 text-support text-ink-muted">{description}</p>
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="request-heading" className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-elevation-1 sm:p-6">
        {submittedTo ? (
          <div className="flex flex-col items-center py-6 text-center" role="status">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden="true"><CheckCircle2 className="h-6 w-6" /></span>
            <h2 id="request-heading" className="mt-4 text-card-title font-semibold text-ink-strong">Request received</h2>
            <p className="mt-1 max-w-md text-support text-ink-muted">Thank you. Once a Super Admin approves it, an invitation will be sent to <span className="font-semibold text-ink-strong">{submittedTo}</span>.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/login" trailingIcon={<ArrowRight className="h-4 w-4" />}>Go to sign in</ButtonLink>
              <Button variant="secondary" onClick={() => setSubmittedTo(null)}>Send another request</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink" aria-hidden="true"><Building2 className="h-5 w-5" /></span>
              <div>
                <h2 id="request-heading" className="text-card-title font-semibold text-ink-strong">Request an invitation</h2>
                <p className="text-support text-ink-muted">The invitation goes to the email below, and that person becomes your organization&apos;s first administrator.</p>
              </div>
            </div>
            {formError && <Alert tone="danger" title="Request not sent" className="mb-5">{formError}</Alert>}
            <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
              <Field label="Organization name" required error={errors.institution_name} className="sm:col-span-2">
                <Input value={form.institution_name} maxLength={200} autoComplete="organization" onChange={(event) => update("institution_name", event.target.value)} placeholder="e.g. Volta Health Partners" />
              </Field>
              <Field label="Your full name" required error={errors.contact_name}>
                <Input value={form.contact_name} maxLength={150} autoComplete="name" onChange={(event) => update("contact_name", event.target.value)} />
              </Field>
              <Field label="Job title" optional error={errors.job_title}>
                <Input value={form.job_title} maxLength={120} autoComplete="organization-title" onChange={(event) => update("job_title", event.target.value)} placeholder="e.g. HR Director" />
              </Field>
              <Field label="Work email" required error={errors.email}>
                <Input type="email" value={form.email} autoComplete="email" onChange={(event) => update("email", event.target.value)} placeholder="you@organization.com" />
              </Field>
              <Field label="Phone" optional error={errors.phone}>
                <Input type="tel" value={form.phone} maxLength={40} autoComplete="tel" onChange={(event) => update("phone", event.target.value)} placeholder="e.g. 024 000 0000" />
              </Field>
              <Field label="Country" required error={errors.country_code}>
                <Select value={form.country_code} onChange={(event) => update("country_code", event.target.value)}>
                  {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </Select>
              </Field>
              <Field label="Organization size" optional error={errors.organization_size}>
                <Select value={form.organization_size} onChange={(event) => update("organization_size", event.target.value)}>
                  <option value="">Select size</option>
                  <option value="1-50">1–50 employees</option>
                  <option value="51-200">51–200 employees</option>
                  <option value="201-1000">201–1,000 employees</option>
                  <option value="1000+">More than 1,000 employees</option>
                </Select>
              </Field>
              <Field label="What would you like to use ErgonX for?" optional error={errors.message} className="sm:col-span-2">
                <Textarea rows={3} maxLength={2000} value={form.message} onChange={(event) => update("message", event.target.value)} placeholder="e.g. HR records, leave and payroll for three branches" />
              </Field>
              {/* Honeypot for bots: hidden from people and assistive technology. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} /></label>
              </div>
              <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-support text-ink-muted"><ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />Invitation links are secure and single-use.</p>
                <Button type="submit" loading={submitting} loadingLabel="Sending…" trailingIcon={<Send className="h-4 w-4" />}>Send request</Button>
              </div>
            </form>
          </>
        )}
      </section>

      <Alert tone="info" title="Joining an organization already on ErgonX?" className="mt-6">
        You don&apos;t need to request access. Ask your organization&apos;s administrator or HR team to invite you, then use the link in the email.
      </Alert>
    </AuthShell>
  );
}
