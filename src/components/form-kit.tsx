"use client";

import Link from "next/link";

export function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid items-start gap-1 sm:grid-cols-[11rem_1fr]">
      <span className="pt-1.5 text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-3 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}

export function FormButtons({ busy, submitLabel, cancelHref }: { busy: boolean; submitLabel: string; cancelHref: string }) {
  return (
    <div className="flex gap-2">
      <button type="submit" disabled={busy} className="rounded bg-sky-800 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-60">
        {busy ? "Saving…" : submitLabel}
      </button>
      <Link href={cancelHref} className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
        Cancel
      </Link>
    </div>
  );
}

export const formBox = "max-w-3xl space-y-3 border border-slate-300 bg-white p-4";
