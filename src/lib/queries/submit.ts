import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CommandFailed, runCommand, useActionKey } from "./commands";

/**
 * A form's submit as the 202 pattern: run the command, refetch what it touches, go to the next page. osTicket's
 * refusal is kept in `error` for the form to show; the key is renewed once osTicket has answered either way.
 */
export function useSubmitCommand(invalidate: readonly (readonly unknown[])[]) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = useActionKey();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(method: "POST" | "PATCH", path: string, body: Record<string, unknown>, next: (result: Record<string, unknown>) => string) {
    setError(null);
    setBusy(true);
    try {
      const result = await runCommand({ method, path, body, key: key.current() });
      key.renew();
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      router.push(next(result));
    } catch (e) {
      if (e instanceof CommandFailed) key.renew();
      setError(e instanceof Error ? e.message : "Request failed");
      setBusy(false);
    }
  }
  return { submit, error, setError, busy };
}
