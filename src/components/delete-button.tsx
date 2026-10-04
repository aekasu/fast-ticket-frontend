"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CommandFailed, runCommand, useActionKey } from "@/lib/queries/commands";
import { NoticeBar, button, type Notice } from "./action-ui";

/** A delete behind a confirmation. osTicket's refusal (say, the user still has tickets) is shown as it words it. */
export function DeleteButton({
  noun,
  path,
  redirectTo,
  invalidate,
}: {
  noun: string;
  path: string;
  redirectTo: string;
  invalidate: readonly unknown[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = useActionKey();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function remove() {
    setBusy(true);
    setNotice(null);
    try {
      await runCommand({ method: "DELETE", path, key: key.current() });
      key.renew();
      await queryClient.invalidateQueries({ queryKey: invalidate });
      router.push(redirectTo);
    } catch (e) {
      if (e instanceof CommandFailed) key.renew();
      setNotice({ kind: "error", text: e instanceof Error ? e.message : "Request failed" });
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className={`${button} border-red-300 text-red-800`} onClick={() => setConfirming((v) => !v)} aria-expanded={confirming}>
        Delete
      </button>
      {confirming && (
        <div className="mt-3 max-w-xl space-y-3 border border-red-300 bg-red-50 p-4 text-sm">
          <p>
            Are you sure you want to delete this {noun}? <strong>This cannot be undone.</strong>
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={remove} className="rounded bg-red-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
              {busy ? "Deleting…" : `Delete ${noun}`}
            </button>
            <button type="button" className={button} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="mt-3">
        <NoticeBar notice={notice} />
      </div>
    </div>
  );
}
