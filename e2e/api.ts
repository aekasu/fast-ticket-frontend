import { expect, type APIRequestContext } from "@playwright/test";

/** Send a write through the frontend's proxy and wait for the command's outcome (the 202 pattern). */
export async function command(
  request: APIRequestContext,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ status: string; error_message: string | null; result: Record<string, unknown> }> {
  const res = await request.fetch(path, {
    method,
    data: body,
    headers: { "Idempotency-Key": `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}` },
  });
  expect(res.status(), `${method} ${path}`).toBe(202);
  const { command_id } = (await res.json()) as { command_id: number };
  const done = (await (await request.get(`/api/v1/commands/${command_id}?wait=30`)).json()) as {
    status: string;
    error_message: string | null;
    result_payload: string | null;
  };
  return { status: done.status, error_message: done.error_message, result: done.result_payload ? JSON.parse(done.result_payload) : {} };
}

/** Create a ticket; returns its id and a function that deletes it again. */
export async function createTicket(request: APIRequestContext, body: { subject: string; message: string; name?: string; email?: string }) {
  const done = await command(request, "POST", "/api/v1/tickets/", { name: "E2E Tester", email: "e2e@example.com", ...body });
  expect(done.status, done.error_message ?? "").toBe("done");
  const id = done.result.ticket_id as number;
  return { id, remove: () => command(request, "DELETE", `/api/v1/tickets/${id}`) };
}

/** Create a task; returns its id and a function that deletes it again. */
export async function createTask(request: APIRequestContext, body: { title: string; description: string; ticket_id?: number }) {
  const done = await command(request, "POST", "/api/v1/tasks/", body);
  expect(done.status, done.error_message ?? "").toBe("done");
  const id = done.result.task_id as number;
  return { id, remove: () => command(request, "DELETE", `/api/v1/tasks/${id}`) };
}
