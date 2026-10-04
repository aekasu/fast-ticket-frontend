import { request, type APIRequestContext } from "@playwright/test";

type Item = Record<string, unknown>;

async function list(api: APIRequestContext, path: string, query = ""): Promise<Item[]> {
  const res = await api.get(`${path}${path.includes("?") ? "&" : "?"}page_size=200${query}`);
  return res.ok() ? (((await res.json()) as { items: Item[] }).items ?? []) : [];
}

async function remove(api: APIRequestContext, path: string) {
  const res = await api.fetch(path, { method: "DELETE", headers: { "Idempotency-Key": `sweep-${Date.now()}-${Math.random().toString(36).slice(2)}` } });
  if (res.status() !== 202) return;
  const { command_id } = (await res.json()) as { command_id: number };
  for (let i = 0; i < 3; i++) {
    const d = (await (await api.get(`/api/v1/commands/${command_id}?wait=20`)).json()) as { status: string };
    if (d.status === "done" || d.status === "failed") return;
  }
}

const startsWith = (value: unknown, prefix: string) => typeof value === "string" && value.startsWith(prefix);

/**
 * Delete what the end-to-end tests create, by the names they give it, so a run that died halfway leaves nothing behind
 * and the next run starts clean. Only records that clearly belong to the tests are touched: `[e2e]` tickets and tasks,
 * `E2E …` / `e2e-…` records, and the requesters those tickets created.
 */
export async function sweepTestData(baseURL: string, storageState: string) {
  const api = await request.newContext({ baseURL, storageState });
  try {
    // Tickets first (a user cannot be deleted while it has tickets), then the people they belonged to.
    const owners = new Set<number>();
    for (const t of await list(api, "/api/v1/tickets/", `&q=${encodeURIComponent("[e2e]")}`)) {
      if (!startsWith(t.subject, "[e2e]")) continue;
      owners.add(t.user_id as number);
      await remove(api, `/api/v1/tickets/${t.ticket_id}`);
    }
    for (const t of await list(api, "/api/v1/tasks/", `&q=${encodeURIComponent("[e2e]")}`)) {
      if (startsWith(t.title, "[e2e]")) await remove(api, `/api/v1/tasks/${t.task_id}`);
    }
    for (const u of await list(api, "/api/v1/users")) {
      if (startsWith(u.name, "E2E") || /^e2e[._-]/i.test(String(u.email)) || owners.has(u.id as number) && /e2e/i.test(`${u.name} ${u.email}`)) {
        await remove(api, `/api/v1/users/${u.id}`);
      }
    }
    for (const o of await list(api, "/api/v1/orgs")) if (startsWith(o.name, "E2E")) await remove(api, `/api/v1/orgs/${o.id}`);

    for (const c of await list(api, "/api/v1/kb/categories")) if (startsWith(c.name, "E2E")) await remove(api, `/api/v1/kb/categories/${c.id}`);
    for (const f of await list(api, "/api/v1/kb/faqs")) if (startsWith(f.question, "E2E")) await remove(api, `/api/v1/kb/faqs/${f.id}`);
    for (const c of await list(api, "/api/v1/canned")) if (startsWith(c.title, "E2E")) await remove(api, `/api/v1/canned/${c.id}`);

    const byName: [string, string, string][] = [
      ["/api/v1/staff", "username", "e2e-"],
      ["/api/v1/departments", "name", "E2E"],
      ["/api/v1/teams", "name", "E2E"],
      ["/api/v1/topics", "topic", "E2E"],
      ["/api/v1/slas", "name", "E2E"],
      ["/api/v1/banlist", "val", "e2e-"],
      ["/api/v1/priorities", "name", "e2e-"],
    ];
    for (const [path, key, prefix] of byName) {
      for (const item of await list(api, path)) if (startsWith(item[key], prefix)) await remove(api, `${path}/${item.id}`);
    }
  } finally {
    await api.dispose();
  }
}
