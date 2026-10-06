// Mass actions: osTicket's lists act on every ticked row. The API has one command per ticket, so a mass action is that
// command run for each id (a few at a time), and the answer is how many osTicket accepted and why it refused the rest.

export interface BulkResult {
  done: number;
  failed: { id: number; message: string }[];
}

export async function runMany(ids: readonly number[], run: (id: number) => Promise<unknown>, concurrency = 3): Promise<BulkResult> {
  const result: BulkResult = { done: 0, failed: [] };
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        await run(id);
        result.done += 1;
      } catch (error) {
        result.failed.push({ id, message: error instanceof Error ? error.message : "Request failed" });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return result;
}

/** One line for the notice: what was done and, grouped by reason, what osTicket refused. */
export function summarize(verb: string, result: BulkResult, label: (id: number) => string = String): string {
  const parts = [`${verb} ${result.done} ticket${result.done === 1 ? "" : "s"}.`];
  const byReason = new Map<string, number[]>();
  for (const f of result.failed) byReason.set(f.message, [...(byReason.get(f.message) ?? []), f.id]);
  for (const [reason, ids] of byReason) parts.push(`${ids.map(label).join(", ")}: ${reason}`);
  return parts.join(" ");
}
