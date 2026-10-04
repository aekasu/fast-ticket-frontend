"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// osTicket's own wording for each refusal reason the API reports in X-Login-Error.
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid login",
  account_disabled: "Access denied. Contact admin.",
  two_factor_required: "Accounts with two-factor authentication cannot use the API yet.",
  password_change_required: "A password change is required. Change it in osTicket first.",
  backend_unreachable: "The API is unreachable.",
};

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("userid"), password: form.get("passwd") }),
    }).catch(() => null);

    if (res?.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    const body = (await res?.json().catch(() => ({}))) as { error?: string; retry_after?: number };
    setBusy(false);
    if (!res) setError(MESSAGES.backend_unreachable);
    else if (res.status === 429) setError(`Too many failed attempts. Try again in ${body.retry_after ?? "a few"} seconds.`);
    else setError((body.error && MESSAGES[body.error]) ?? "Login failed");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        name="userid"
        type="text"
        placeholder="Email or Username"
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600"
      />
      <input
        name="passwd"
        type="password"
        placeholder="Password"
        maxLength={128}
        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600"
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-sky-800 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-60"
        >
          {busy ? "Verifying…" : "Log In"}
        </button>
      </div>
    </form>
  );
}
