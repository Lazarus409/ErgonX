"use client";

export function passwordStrength(value: string): { label: string; score: number; tone: string } {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (score <= 2) return { label: value ? "Weak" : "", score, tone: "bg-rose-500" };
  if (score <= 3) return { label: "Fair", score, tone: "bg-amber-500" };
  if (score === 4) return { label: "Good", score, tone: "bg-sky-500" };
  return { label: "Strong", score, tone: "bg-emerald-500" };
}

export default function PasswordStrength({ value }: { value: string }) {
  const result = passwordStrength(value);
  if (!value) return null;
  return <div aria-live="polite" className="mt-2"><div className="flex gap-1">{Array.from({ length: 5 }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index < result.score ? result.tone : "bg-slate-200"}`} />)}</div><p className="mt-1 text-xs text-slate-500">Password strength: <span className="font-semibold">{result.label}</span>. Use 8+ characters with upper/lowercase, a number, and a symbol.</p></div>;
}
