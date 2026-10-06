import { expect, test } from "@playwright/test";
import { command, createTicket } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketAgentDirectory, osticketProfileValues, osticketTaskQueue } from "./osticket";

type Queue = { key: string; count: number };

test.describe("dashboard, directory and profile as the admin", () => {
  test.use({ storageState: AUTH.admin });

  test("the dashboard shows the real queue and task counts, and says the activity report is missing", async ({ page, request }) => {
    const os = await osticketAdmin();
    const { queues } = (await (await request.get("/api/v1/tickets/queues")).json()) as { queues: Queue[] };
    await page.goto("/");
    const ticketCards = page.getByLabel("Ticket queues");
    const label: Record<string, string> = { open: "Open", answered: "Answered", overdue: "Overdue", closed: "Closed", mine: "My Tickets", assigned_me: "Assigned to Me", assigned_teams: "Assigned to Teams" };
    for (const [key, text] of Object.entries(label)) {
      const q = queues.find((x) => x.key === key)!;
      await expect(ticketCards.getByRole("link", { name: new RegExp(`^${q.count}\\s*${text}$`) }), key).toBeVisible();
    }
    // Task counts are osTicket's own tab counts.
    const tabs = (await osticketTaskQueue(os, "open")).tabs;
    const taskCards = page.getByLabel("Task queues");
    await expect(taskCards.getByRole("link", { name: new RegExp(`^${tabs["Open"]}\\s*Open$`) })).toBeVisible();
    if (tabs["My Tasks"] !== undefined) await expect(taskCards.getByRole("link", { name: new RegExp(`^${tabs["My Tasks"]}\\s*My Tasks$`) })).toBeVisible();
    if (tabs["Completed"] !== undefined) await expect(taskCards.getByRole("link", { name: new RegExp(`^${tabs["Completed"]}\\s*Completed$`) })).toBeVisible();

    await expect(page.getByRole("status")).toContainText("activity report");
    await expect(page.getByRole("list", { name: "Dashboard" })).toContainText("Agent Directory");
    // A card leads to its queue.
    await ticketCards.getByRole("link", { name: /Closed$/ }).click();
    await expect(page).toHaveURL(/\/tickets\?queue=closed/);
    await os.dispose();
  });

  test("Assigned to me lists the tickets assigned to the agent", async ({ page, request }) => {
    const ticket = await createTicket(request, { subject: "[e2e] assigned to me", message: "Claim me." });
    try {
      expect((await command(request, "POST", `/api/v1/tickets/${ticket.id}/claim`, {})).status).toBe("done");
      const detail = (await (await request.get(`/api/v1/tickets/${ticket.id}`)).json()) as { number: string };
      await page.goto("/");
      const table = page.locator("table").last();
      await expect(table.locator("tbody tr td:first-child a", { hasText: detail.number })).toBeVisible();
      const mine = (await (await request.get("/api/v1/tickets/?queue=assigned_me&page_size=5&sort=updated")).json()) as { items: { number: string }[] };
      expect(await table.locator("tbody tr td:first-child a").allTextContents()).toEqual(mine.items.map((t) => t.number));
    } finally {
      await ticket.remove();
    }
    // With nothing assigned any more, the empty state shows.
    await page.goto("/");
    await expect(page.getByText("Nothing is assigned to you.")).toBeVisible();
  });

  test("the agent directory lists the same people as osTicket's", async ({ page }) => {
    const os = await osticketAdmin();
    const theirs = await osticketAgentDirectory(os);
    expect(theirs.length).toBeGreaterThan(0);
    await page.goto("/directory");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(page.getByText("Loading…")).toHaveCount(0);
    const shown = await page.locator("tbody tr").evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll("td")].slice(0, 3).map((c) => c.textContent?.trim() ?? "")));
    expect([...shown].sort()).toEqual(theirs.map((r) => r.slice(0, 3)).sort());
    await os.dispose();
  });

  test("the directory filters by search and department", async ({ page, request }) => {
    await page.goto("/directory");
    await page.getByLabel("Search agents").fill("fron");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=fron/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody")).toContainText("Frontend Agent");

    await page.getByLabel("Search agents").fill("");
    await page.getByRole("button", { name: "Search" }).click();
    // Let the cleared search take effect first: two quick URL changes would otherwise build on a stale one.
    await expect(page).not.toHaveURL(/q=/);
    await page.getByLabel("Department").selectOption({ label: "Sales" });
    await expect(page).toHaveURL(/did=2/);
    const sales = (await (await request.get("/api/v1/agents?dept_id=2")).json()) as { items: unknown[] };
    if (sales.items.length === 0) await expect(page.getByText("No agents found.")).toBeVisible();
    else await expect(page.locator("tbody tr")).toHaveCount(sales.items.length);
  });

  test("My Profile shows the agent's own account, as osTicket's profile does", async ({ page, request }) => {
    const os = await osticketAdmin();
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { name: string; email: string; username: string; global_permissions: string[] };
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "My Account Profile" })).toBeVisible();
    const cell = (label: string) => page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");
    await expect(cell("Email Address")).toHaveText(me.email);
    await expect(cell("Username")).toHaveText(me.username);
    await expect(cell("Account type")).toHaveText("Administrator");
    const theirs = await osticketProfileValues(os);
    expect(theirs.email).toBe(me.email);
    expect(theirs.username).toBe(me.username);
    expect(`${theirs.firstname} ${theirs.lastname}`).toBe(me.name);
    await expect(page.getByRole("status")).toContainText("not available through the API");
    await os.dispose();
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("sees their own dashboard, the directory and their profile", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { username: string };
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText(`Signed in as ${me.username}`)).toBeVisible();
    await page.getByRole("link", { name: "Agent Directory" }).click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page.getByRole("link", { name: "My Profile" }).click();
    await expect(page.locator("th", { hasText: /^Account type:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("Agent");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" })).toBeVisible();
  });
});
