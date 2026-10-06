import { expect, request as playwrightRequest, test } from "@playwright/test";
import { command, createTask, createTicket } from "./api";
import { AUTH } from "./global-setup";

test.use({ storageState: AUTH.admin });

test.describe("live updates", () => {
  test("the header says the connection is live", async ({ page }) => {
    await page.goto("/tickets");
    await expect(page.locator("[data-live]")).toHaveAttribute("data-live", "live");
    await expect(page.locator("[data-live]")).toHaveText("Live");
  });

  test("an event names what changed and carries no payload", async ({ page, request }) => {
    await page.goto("/tickets");
    await expect(page.locator("[data-live='live']")).toBeVisible();
    // A second stream of our own, to look at the raw messages the server relays.
    await page.evaluate(() => {
      const w = window as unknown as { __events: Record<string, unknown>[] };
      w.__events = [];
      const source = new EventSource("/api/events");
      source.onmessage = (e) => w.__events.push(JSON.parse(e.data));
    });
    await page.waitForTimeout(1500); // let it connect

    const ticket = await createTicket(request, { subject: "[e2e] live event", message: "Raise an event." });
    try {
      await expect
        .poll(async () => (await page.evaluate(() => (window as unknown as { __events: { aggregate_type?: string; aggregate_id?: string }[] }).__events)).some((e) => e.aggregate_type === "ticket" && e.aggregate_id === String(ticket.id)), { timeout: 15_000 })
        .toBe(true);
      const events = await page.evaluate(() => (window as unknown as { __events: Record<string, unknown>[] }).__events);
      for (const e of events) expect(Object.keys(e).sort()).toEqual(["aggregate_id", "aggregate_type", "type"]);
    } finally {
      await ticket.remove();
    }
  });

  test("a ticket someone else opens raises an N new tickets bar, which leads to the open queue", async ({ page, request }) => {
    await page.goto("/dashboard");
    await expect(page.locator("[data-live='live']")).toBeVisible();
    await expect(page.locator("[data-new-tickets]")).toHaveCount(0);
    const ticket = await createTicket(request, { subject: "[e2e] new ticket bar", message: "Tell the agent." });
    try {
      const bar = page.locator("[data-new-tickets]");
      await expect(bar).toBeVisible({ timeout: 20_000 });
      await expect(bar).toContainText(/new tickets? arrived/);
      await bar.getByRole("link", { name: "Show open tickets" }).click();
      await expect(page).toHaveURL(/\/tickets\?queue=open/);
      await expect(bar).toHaveCount(0);
    } finally {
      await ticket.remove();
    }
  });

  test("the ticket list shows a new ticket without a reload", async ({ page, request }) => {
    const subject = `[e2e] live list ${Date.now()}`;
    await page.goto(`/tickets?queue=open&q=${encodeURIComponent(subject)}`);
    await expect(page.getByText("No tickets match your search.")).toBeVisible();
    await expect(page.locator("[data-live='live']")).toBeVisible();
    let navigations = 0;
    page.on("framenavigated", () => navigations++);

    const ticket = await createTicket(request, { subject, message: "Appear by yourself." });
    try {
      await expect(page.locator("tbody tr", { hasText: subject })).toBeVisible({ timeout: 20_000 });
      expect(navigations).toBe(0);
    } finally {
      await ticket.remove();
    }
    // And it goes again when the ticket is deleted
    await expect(page.getByText("No tickets match your search.")).toBeVisible({ timeout: 20_000 });
  });

  test("the queue counts change by themselves", async ({ page, request }) => {
    await page.goto("/tickets?queue=open");
    await expect(page.locator("[data-live='live']")).toBeVisible();
    const tab = page.getByRole("list", { name: "Queues", exact: true }).getByRole("link", { name: /^Open/ });
    const read = async () => Number(/\((\d+)\)/.exec((await tab.innerText()) ?? "")?.[1]);
    const before = await read();
    const ticket = await createTicket(request, { subject: "[e2e] live count", message: "Count me." });
    try {
      await expect.poll(read, { timeout: 20_000 }).toBe(before + 1);
    } finally {
      await ticket.remove();
    }
    await expect.poll(read, { timeout: 20_000 }).toBe(before);
  });

  test("a ticket's thread shows a reply posted elsewhere", async ({ page, request }) => {
    const ticket = await createTicket(request, { subject: "[e2e] live thread", message: "Wait for a reply." });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await expect(page.getByRole("heading", { name: /Ticket Thread \(1\)/ })).toBeVisible();
      await expect(page.locator("[data-live='live']")).toBeVisible();
      expect((await command(request, "POST", `/api/v1/tickets/${ticket.id}/reply`, { message: "A reply from another session." })).status).toBe("done");
      await expect(page.getByText("A reply from another session.")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("heading", { name: /Ticket Thread \(2\)/ })).toBeVisible();
    } finally {
      await ticket.remove();
    }
  });

  test("the task list shows a new task without a reload", async ({ page, request }) => {
    const title = `[e2e] live task ${Date.now()}`;
    await page.goto(`/tasks?queue=open&q=${encodeURIComponent(title)}`);
    await expect(page.getByText("No tasks match your search.")).toBeVisible();
    await expect(page.locator("[data-live='live']")).toBeVisible();
    const task = await createTask(request, { title, description: "Appear by yourself." });
    try {
      await expect(page.locator("tbody tr", { hasText: title })).toBeVisible({ timeout: 20_000 });
    } finally {
      await task.remove();
    }
  });

  test("after a reconnect the page refetches what it may have missed", async ({ page, request }) => {
    const subject = `[e2e] live reconnect ${Date.now()}`;
    // Replace the real stream with one that says it is ready and then ends: the browser reconnects after its retry
    // delay and gets "ready" again. No event is delivered in between, as if the connection had dropped.
    let connections = 0;
    await page.route("**/api/events", (route) => {
      connections += 1;
      return route.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }, body: "retry: 500\nevent: ready\ndata: {}\n\n" });
    });
    await page.goto(`/tickets?queue=open&q=${encodeURIComponent(subject)}`);
    await expect(page.getByText("No tickets match your search.")).toBeVisible();
    await expect.poll(() => connections).toBeGreaterThanOrEqual(1);

    const ticket = await createTicket(request, { subject, message: "Created while the page was not listening." });
    try {
      // No event was delivered, so only the reconnect's refetch can make it appear.
      await expect(page.locator("tbody tr", { hasText: subject })).toBeVisible({ timeout: 20_000 });
      expect(connections).toBeGreaterThanOrEqual(2);
    } finally {
      await ticket.remove();
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("also gets live updates, for the tickets in their list", async ({ page }) => {
    // The ticket is made by the administrator, in the agent's department, so it is in the agent's list.
    const admin = await playwrightRequest.newContext({ baseURL: "http://localhost:3100", storageState: AUTH.admin });
    const subject = `[e2e] live for agent ${Date.now()}`;
    let ticket: Awaited<ReturnType<typeof createTicket>> | undefined;
    try {
      await page.goto(`/tickets?queue=open&q=${encodeURIComponent(subject)}`);
      await expect(page.getByText("No tickets match your search.")).toBeVisible();
      await expect(page.locator("[data-live='live']")).toBeVisible();
      ticket = await createTicket(admin, { subject, message: "For the agent's list." });
      await expect(page.locator("tbody tr", { hasText: subject })).toBeVisible({ timeout: 20_000 });
    } finally {
      await ticket?.remove();
      await admin.dispose();
    }
  });
});

test("closing a page releases its socket to the backend", async ({ browser }) => {
  // The backend allows 10 sockets per agent (WS_MAX_CONNECTIONS_PER_STAFF). If the relay kept its WebSocket after the
  // page went away, a dozen visits would use them all up and the next page could never go live.
  for (let i = 0; i < 14; i++) {
    const context = await browser.newContext({ storageState: AUTH.admin });
    const page = await context.newPage();
    await page.goto("/tickets");
    await expect(page.locator("[data-live='live']")).toBeVisible({ timeout: 15_000 });
    await context.close();
  }
  const context = await browser.newContext({ storageState: AUTH.admin });
  const page = await context.newPage();
  await page.goto("/tickets");
  await expect(page.locator("[data-live='live']")).toBeVisible({ timeout: 15_000 });
  await context.close();
});

test("the event stream needs a session", async () => {
  // Explicitly empty: a context made in a test inherits the file's storageState (the admin's session) otherwise.
  const anonymous = await playwrightRequest.newContext({ baseURL: "http://localhost:3100", storageState: { cookies: [], origins: [] } });
  const res = await anonymous.get("/api/events", { timeout: 8000 });
  expect(res.status()).toBe(401);
  await anonymous.dispose();
});
