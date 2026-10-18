"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronLeft } from "lucide-react";

import CareersShell from "@/components/careers/CareersShell";
import Alert from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, FileInput, Input, Select, Textarea } from "@/components/ui/Field";
import { careersApi, getApiErrorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApiResource } from "@/lib/useApiResource";

const QUALIFICATIONS: Record<string, string> = {
  SECONDARY: "Secondary school", DIPLOMA: "Diploma or certificate", BACHELORS: "Bachelor's degree", MASTERS: "Master's degree",
  DOCTORATE: "Doctorate", PROFESSIONAL: "Professional qualification", OTHER: "Other",
};

function Section({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return <section><h2 className="text-card-title font-semibold text-ink-strong">{title}</h2><p className="mt-1 whitespace-pre-line text-support text-ink">{text}</p></section>;
}

/** A public job advert with the application form. No sign-in. */
export default function CareersJobPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const load = useCallback(() => careersApi.getCareersJob(slug, id), [slug, id]);
  const { data, error } = useApiResource(load);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", location: "", linkedin_url: "", current_title: "", years_experience: "", highest_qualification: "", cover_letter: "", website: "" });
  const [cv, setCv] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState<{ token: string | null; emailed: boolean } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cv) { setFormError("Attach your CV."); return; }
    if (!consent) { setFormError("Agree to how your information will be used."); return; }
    setSaving(true); setFormError("");
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => { if (value !== "") body.append(key, value); });
    body.append("consent", "true");
    body.append("cv", cv);
    try {
      const result = await careersApi.applyForJob(slug, id, body);
      setDone({ token: result.tracking_token, emailed: result.email_delivery_status === "sent" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) { setFormError(getApiErrorMessage(caught)); }
    finally { setSaving(false); }
  };

  const job = data?.job;
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });

  return (
    <CareersShell organisation={data?.organisation}>
      <Link href={`/careers/${slug}`} className="inline-flex items-center gap-1 text-support font-semibold text-primary-ink hover:underline"><ChevronLeft className="h-4 w-4" aria-hidden="true" />All jobs</Link>
      {error && <Alert tone="warning">This job is no longer advertised.</Alert>}
      {done ? (
        <Alert tone="success" title="Application sent">
          <p>Thank you. Your application for {job?.title} has been received.</p>
          {done.token && (
            <p className="mt-2">
              Follow its progress, confirm interviews and send more documents here: <Link className="font-semibold underline" href={`/careers/track/${done.token}`}>track your application</Link>.
              {done.emailed ? " We've also emailed you this link." : " Save this link: it's the only way back to your application."} Keep it private.
            </p>
          )}
        </Alert>
      ) : job && (
        <>
          <header>
            <h1 className="text-page-title font-bold text-ink-strong">{job.title}</h1>
            <p className="mt-1 text-support text-ink-muted">{[job.department, job.location, job.employment_type].filter(Boolean).join(" · ")}{job.closes_on ? ` · apply by ${formatDate(job.closes_on)}` : ""}</p>
            {job.salary && <p className="mt-1 text-support text-ink">{job.salary.currency} {Number(job.salary.min).toLocaleString()} – {Number(job.salary.max).toLocaleString()} per month</p>}
          </header>
          <Section title="About the role" text={job.description} />
          <Section title="What you'll do" text={job.responsibilities} />
          <Section title="What you need" text={job.qualifications_essential} />
          <Section title="Nice to have" text={job.qualifications_desirable} />

          <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-elevation-1" noValidate>
            <h2 className="text-card-title font-semibold text-ink-strong">Apply</h2>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required><Input value={form.first_name} onChange={set("first_name")} autoComplete="given-name" required maxLength={100} /></Field>
              <Field label="Last name" required><Input value={form.last_name} onChange={set("last_name")} autoComplete="family-name" required maxLength={100} /></Field>
              <Field label="Email" required><Input type="email" value={form.email} onChange={set("email")} autoComplete="email" required /></Field>
              <Field label="Phone" optional><Input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" maxLength={30} /></Field>
              <Field label="Where you live" optional><Input value={form.location} onChange={set("location")} maxLength={150} /></Field>
              <Field label="Current job title" optional><Input value={form.current_title} onChange={set("current_title")} maxLength={200} /></Field>
              <Field label="Years of experience" optional><Input type="number" min={0} max={60} value={form.years_experience} onChange={set("years_experience")} /></Field>
              <Field label="Highest qualification" optional>
                <Select value={form.highest_qualification} onChange={set("highest_qualification")}><option value="">Choose</option>{Object.entries(QUALIFICATIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
              </Field>
            </div>
            <Field label="LinkedIn profile" optional><Input type="url" value={form.linkedin_url} onChange={set("linkedin_url")} placeholder="https://www.linkedin.com/in/…" /></Field>
            <Field label="CV" required><FileInput accept=".pdf,.doc,.docx,.odt,.txt" fileName={cv?.name} hint="PDF or Word, up to 10 MB." onChange={(event) => setCv(event.target.files?.[0] ?? null)} /></Field>
            <Field label="Why you're a good fit" optional><Textarea rows={5} maxLength={6000} value={form.cover_letter} onChange={set("cover_letter")} /></Field>
            {/* Hidden from people; bots fill it in. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} /></label></div>
            <Checkbox
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              label={`I agree that ${data?.organisation ?? "the employer"} may store and use my information to assess this application.`}
              description={data?.privacy_notice || undefined}
            />
            <div className="flex justify-end"><Button type="submit" loading={saving} leadingIcon={<CheckCircle2 className="h-4 w-4" />}>Send application</Button></div>
          </form>
        </>
      )}
    </CareersShell>
  );
}
