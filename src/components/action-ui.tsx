"use client";

import { useState } from "react";
import { CommandFailed, useActionKey } from "@/lib/queries/commands";
import { useResourceAction } from "@/lib/queries/actions";

export type Notice = { kind: "ok" | "error"; text: string };

export const button = "rounded border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50";
export const primary = "rounded bg-sky-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-900 disabled:opacity-60";
export const field = "w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm";

/** Runs one action on a resource with its own idempotency key and reports osTicket's answer. */
export function useRunner(basePath: string, invalidate: readonly unknown[]) {
  const action = useResourceAction(basePath, invalidate);
  const key = useActionKey();
  const [notice, setNotice] = useState<Notice | null>(null);

  async function run(name: string, body: Record<string, unknown>, success: string, method?: "POST" | "PATCH" | "DELETE"): Promise<boolean> {
    setNotice(null);
    try {
      await action.mutateAsync({ action: name, body, key: key.current(), method });
      key.renew();
      setNotice({ kind: "ok", text: success });
      return true;
    } catch (error) {
      // osTicket's own refusal ends the action; a transport error keeps the key so a retry is the same action.
      if (error instanceof CommandFailed) key.renew();
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
      return false;
    }
  }
  return { run, busy: action.isPending, notice, clear: () => setNotice(null) };
}

export function NoticeBar({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p
      role={notice.kind === "error" ? "alert" : "status"}
      className={`mb-3 border px-3 py-2 text-sm ${notice.kind === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}
    >
      {notice.text}
    </p>
  );
}
