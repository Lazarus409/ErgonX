"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

type Toast = { id: number; title?: string; message: string; tone?: "success" | "error" | "info" };
type ToastContextValue = { showToast: (toast: Omit<Toast, "id">) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...toast, id }].slice(-4));
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 5000);
  }, []);
  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<Omit<Toast, "id">>).detail;
      if (detail?.message) showToast(detail);
    };
    window.addEventListener("ergonx:toast", handleToast);
    return () => window.removeEventListener("ergonx:toast", handleToast);
  }, [showToast]);
  const value = useMemo(() => ({ showToast }), [showToast]);
  return <ToastContext.Provider value={value}>{children}<div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[min( calc(100vw-2rem),24rem)] flex-col gap-3" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"><span className={toast.tone === "error" ? "text-red-500" : toast.tone === "success" ? "text-emerald-500" : "text-sky-500"}>{toast.tone === "error" ? <XCircle size={18} /> : toast.tone === "success" ? <CheckCircle2 size={18} /> : <Info size={18} />}</span><span className="min-w-0 flex-1"><strong className="block text-slate-950 dark:text-white">{toast.title ?? (toast.tone === "error" ? "Action failed" : "Update")}</strong><span className="mt-0.5 block text-slate-600 dark:text-slate-300">{toast.message}</span></span><button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss notification"><X size={16} /></button></div>)}</div></ToastContext.Provider>;
}
