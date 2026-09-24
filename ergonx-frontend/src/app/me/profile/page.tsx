"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { Save, UserRound } from "lucide-react";
import { employeesApi, getApiErrorMessage, imagesApi } from "@/lib/api";
import { useAuth } from "@/components/guards/AuthProvider";
import type { Employee } from "@/types/hr";

export default function MyProfilePage() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [phone, setPhone] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [avatarKey, setAvatarKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    employeesApi.getCurrentEmployee().then((value) => {
      setEmployee(value);
      setPhone(value?.phone ?? "");
      setPersonalEmail(value?.personal_email ?? "");
      setAvatarKey(value?.avatar_key ?? "");
    }).catch((caught) => setError(getApiErrorMessage(caught)));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault(); setError(null); setMessage(null);
    if (!employee) return;
    try {
      const updated = await employeesApi.updateMyProfile({ phone, personal_email: personalEmail, avatar_key: avatarKey });
      setEmployee(updated); setMessage("Your contact details have been updated.");
    } catch (caught) { setError(getApiErrorMessage(caught)); }
  }

  async function uploadProfileImage(file: File | undefined) {
    if (!file || !employee || !user) return;
    setError(null);
    if (!["image/jpeg", "image/png", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Profile images must be JPEG, PNG, or GIF files no larger than 5 MB.");
      return;
    }
    setUploading(true); setUploadProgress(0);
    try {
      const image = await imagesApi.uploadImage(file, "EMPLOYEE", employee.id, setUploadProgress);
      await imagesApi.uploadImage(file, "USER", user.id, setUploadProgress);
      setImageId(image.id); setMessage("Profile picture updated.");
    } catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setUploading(false); }
  }

  return <div className="mx-auto max-w-4xl space-y-6">
    <section className="rounded-2xl bg-slate-950 px-7 py-8 text-white shadow-lg"><p className="text-sm font-semibold text-sky-300">EMPLOYEE SELF-SERVICE</p><h1 className="mt-2 text-3xl font-bold">My profile</h1><p className="mt-2 text-slate-300">Keep your personal contact details current.</p></section>
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}
    <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3"><span className="rounded-xl bg-sky-50 p-3 text-sky-700"><UserRound /></span><div><h2 className="font-semibold text-slate-950">Personal information</h2><p className="text-sm text-slate-500">Employment details are managed by HR.</p></div></div>
      <div className="grid gap-5 md:grid-cols-2"><Field label="Full name" value={employee?.full_name ?? "Loading…"} disabled /><Field label="Employee number" value={employee?.employee_number ?? ""} disabled /><Field label="Work email" value={employee?.work_email ?? ""} disabled /><Field label="Personal email" value={personalEmail} onChange={setPersonalEmail} type="email" /><Field label="Phone" value={phone} onChange={setPhone} /><label className="grid gap-2 text-sm font-medium text-slate-700">Fallback avatar<select value={avatarKey} onChange={(event) => setAvatarKey(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-slate-900"><option value="">Initials</option><option value="blue">Blue avatar</option><option value="green">Green avatar</option><option value="violet">Violet avatar</option><option value="amber">Amber avatar</option></select><span className={`mt-2 flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white ${avatarClass(avatarKey)}`}>{initials(employee?.full_name)}</span></label></div>
      <div className="mt-5 rounded-xl border border-slate-200 p-4"><label className="grid gap-2 text-sm font-medium text-slate-700">Profile picture<input type="file" accept="image/jpeg,image/png,image/gif" disabled={uploading} onChange={(event) => void uploadProfileImage(event.target.files?.[0])} className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5" /></label>{uploading && <p className="mt-2 text-xs text-slate-500">Uploading… {uploadProgress}%</p>}{imageId && <Image src={imagesApi.imageContentUrl(imageId)} alt="Profile preview" width={64} height={64} unoptimized className="mt-3 h-16 w-16 rounded-full object-cover" />}</div>
      {message && <p className="mt-5 text-sm text-emerald-700">{message}</p>}<button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"><Save className="h-4 w-4" />Save changes</button>
    </form>
  </div>;
}

function Field({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange?: (value: string) => void; disabled?: boolean; type?: string }) { return <label className="grid gap-2 text-sm font-medium text-slate-700">{label}<input type={type} value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-slate-900 disabled:bg-slate-50" /></label>; }
function initials(name?: string | null) { return (name ?? "ErgonX").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function avatarClass(key: string) { return key === "green" ? "bg-emerald-600" : key === "violet" ? "bg-violet-600" : key === "amber" ? "bg-amber-500" : key === "blue" ? "bg-sky-600" : "bg-slate-700"; }
