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

/**
 * Delete a ticket and then its requester. Deleting a ticket leaves the requester in osTicket's user directory, so a
 * test that creates a ticket would otherwise leave a user behind. A refusal (the user still has other tickets) is
 * ignored: the user is only removed when nothing else uses it.
 */
export async function deleteTicketAndUser(request: APIRequestContext, ticketId: number) {
  const ticket = await request.get(`/api/v1/tickets/${ticketId}`);
  const userId = ticket.ok() ? ((await ticket.json()) as { user_id: number | null }).user_id : null;
  await command(request, "DELETE", `/api/v1/tickets/${ticketId}`);
  if (userId != null) await command(request, "DELETE", `/api/v1/users/${userId}`).catch(() => undefined);
}

/** Create a ticket; returns its id and a function that deletes it (and its requester) again. */
export async function createTicket(request: APIRequestContext, body: { subject: string; message: string; name?: string; email?: string; topic_id?: number }) {
  // osTicket's staff form requires a help topic (the API refuses a create without one); 1 is "General Inquiry".
  const done = await command(request, "POST", "/api/v1/tickets/", { name: "E2E Tester", email: "e2e@example.com", topic_id: 1, ...body });
  expect(done.status, done.error_message ?? "").toBe("done");
  const id = done.result.ticket_id as number;
  return { id, remove: () => deleteTicketAndUser(request, id) };
}

/** Create a task; returns its id and a function that deletes it again. */
export async function createTask(request: APIRequestContext, body: { title: string; description: string; ticket_id?: number }) {
  const done = await command(request, "POST", "/api/v1/tasks/", body);
  expect(done.status, done.error_message ?? "").toBe("done");
  const id = done.result.task_id as number;
  return { id, remove: () => command(request, "DELETE", `/api/v1/tasks/${id}`) };
}

/**
 * Wait until the page has stopped fetching. Buttons that depend on the agent's permissions appear only once
 * `/auth/me` has loaded, so a test that asserts one is absent must not look before then.
 */
export async function settled(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
}

export interface NewField {
  label: string;
  type: string;
  name: string;
  choices?: string;
  multiselect?: boolean;
  mode?: string;
}

/** Add a custom field to one of osTicket's forms (1 user, 2 ticket, 4 organization, 5 task); returns its id. */
export async function addFormField(request: APIRequestContext, formId: number, f: NewField): Promise<number> {
  const configuration = f.choices ? { choices: f.choices, ...(f.multiselect ? { multiselect: true } : {}) } : undefined;
  const done = await command(request, "POST", `/api/v1/forms/${formId}/fields`, { label: f.label, type: f.type, name: f.name, mode: f.mode ?? "optional", configuration });
  expect(done.status, done.error_message ?? "").toBe("done");
  return done.result.field_id as number;
}

/** Remove a form field and the answers given to it. */
export async function removeFormField(request: APIRequestContext, formId: number, fieldId: number) {
  await command(request, "DELETE", `/api/v1/forms/${formId}/fields/${fieldId}?delete_data=true`).catch(() => undefined);
}
