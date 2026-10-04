import { useRef } from "react";
import { errorMessage } from "@/lib/api/errors";

/** osTicket's own refusal (a failed command's `error_message`), kept apart from transport errors. */
export class CommandFailed extends Error {}

interface CommandStatus {
  status: "pending" | "processing" | "done" | "failed";
  error_message: string | null;
  result_payload: string | null;
}

async function json(res: Response) {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

/**
 * The 202 pattern: queue the write, then wait for its outcome with `GET /commands/{id}?wait=` (held up to 30 s).
 * Resolves with the parsed `result_payload` once the command is done; rejects with `CommandFailed` carrying
 * osTicket's reason when it failed. `key` is the Idempotency-Key: reuse it only to retry the same action.
 */
export async function runCommand(opts: { method: "POST" | "PATCH" | "DELETE"; path: string; body?: unknown; key: string }) {
  const res = await fetch(opts.path, {
    method: opts.method,
    headers: { "Content-Type": "application/json", "Idempotency-Key": opts.key },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }
  if (res.status !== 202) throw new Error(errorMessage(await json(res), `Request failed (${res.status})`));
  const { command_id } = (await res.json()) as { command_id: number };

  for (let waited = 0; waited < 4; waited++) {
    const poll = await fetch(`/api/v1/commands/${command_id}?wait=30`);
    if (!poll.ok) throw new Error(errorMessage(await json(poll), `Could not read the command (${poll.status})`));
    const command = (await poll.json()) as CommandStatus;
    if (command.status === "failed") throw new CommandFailed(command.error_message ?? "The command failed.");
    if (command.status === "done") return command.result_payload ? (JSON.parse(command.result_payload) as Record<string, unknown>) : {};
  }
  throw new Error("The command is still queued. Check again in a moment.");
}

/**
 * One Idempotency-Key per user action, made when the form is first used and kept across a retry after a network
 * error. Once osTicket has answered (done or refused) the action is over, so the next submit gets a fresh key.
 */
export function useActionKey() {
  const key = useRef<string | null>(null);
  return {
    current: () => (key.current ??= crypto.randomUUID()),
    renew: () => {
      key.current = null;
    },
  };
}
