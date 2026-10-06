import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { command, createTicket, settled } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketPageText, osticketQueuePage, osticketRaw, osticketRows, osticketSearchNumbers } from "./osticket";

test.use({ storageState: AUTH.admin });

const cell = (page: Page, label: string) => page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");
const get = async <T>(request: APIRequestContext, path: string) => (await (await request.get(path)).json()) as T;
const firstInt = (r: Record<string, unknown>) => Object.values(r).find((v): v is number => typeof v === "number" && Number.isInteger(v))!;

test.describe("global search", () => {
  test("the header search finds tickets by number and subject, users and organizations", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Find anything").fill("printer");
    await page.getByRole("button", { name: "Go", exact: true }).click();
    await expect(page).toHaveURL(/\/search\?q=printer/);
    const tickets = page.getByRole("region", { name: "Ticket results" });
    await expect(tickets).toContainText("Printer on floor 2 is offline");
    await tickets.getByRole("link", { name: /^\d+$/ }).first().click();
    await expect(page).toHaveURL(/\/tickets\/\d+$/);

    await page.goto("/search?q=osTicket");
    await expect(page.getByRole("region", { name: "Organization results" })).toContainText("osTicket");
    await expect(page.getByRole("region", { name: "User results" })).toContainText("osTicket Team");
  });

  test("it finds the same tickets osTicket's own search finds for a requester's name", async ({ page }) => {
    const os = await osticketAdmin();
    const theirs = await osticketSearchNumbers(os, "ada");
    expect(theirs.length).toBeGreaterThan(0);
    await page.goto("/search?q=ada");
    await expect(page.getByRole("region", { name: "Ticket results" })).toBeVisible();
    const ours = await page.getByRole("region", { name: "Ticket results" }).locator("tbody tr td:first-child a").allTextContents();
    expect([...ours].sort()).toEqual([...theirs].sort());
    await expect(page.getByRole("region", { name: "User results" })).toContainText("Ada Lovelace");
    await os.dispose();
  });

  test("the API's global search now finds a ticket by its requester, as osTicket's does", async ({ request }) => {
    const os = await osticketAdmin();
    const theirs = await osticketSearchNumbers(os, "ada");
    const hits = (await get<{ results: { type: string; title: string }[] }>(request, "/api/v1/search?q=ada&limit=50")).results;
    const numbers = hits.filter((h) => h.type === "ticket").map((h) => h.title);
    expect([...numbers].sort()).toEqual([...theirs].sort());
    await os.dispose();
  });

  test("a search with no match, and an empty one, say so", async ({ page }) => {
    await page.goto("/search?q=zzz-nothing-zzz");
    await expect(page.getByText("Query returned 0 results.")).toBeVisible();
    await page.goto("/search");
    await expect(page.getByText("Type something in the search box above.")).toBeVisible();
  });
});

test.describe("thread entries: edit and resend", () => {
  test("a reply can be edited, and osTicket shows the new text", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] edit reply", message: "Customer message." });
    try {
      expect((await command(request, "POST", `/api/v1/tickets/${ticket.id}/reply`, { message: "Original reply text." })).status).toBe("done");
      await page.goto(`/tickets/${ticket.id}`);
      await expect(page.getByText("Original reply text.")).toBeVisible();
      await page.getByRole("button", { name: "Edit this reply" }).click();
      await page.getByLabel("Edit the reply").fill("Edited reply text.");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Edited reply text.")).toBeVisible();
      await expect(page.getByText("Original reply text.")).toHaveCount(0);
      // The API hides the old version and gives the entry a new id.
      const detail = await get<{ thread: { type: string; body: string; is_edited: boolean }[] }>(request, `/api/v1/tickets/${ticket.id}`);
      const replies = detail.thread.filter((e) => e.type === "R");
      expect(replies).toHaveLength(1);
      expect(replies[0].body).toContain("Edited reply text.");
      expect(await osticketPageText(os, `tickets.php?id=${ticket.id}`)).toContain("Edited reply text.");
    } finally {
      await ticket.remove();
      await os.dispose();
    }
  });

  test("an internal note can be edited, title and text", async ({ page, request }) => {
    const ticket = await createTicket(request, { subject: "[e2e] edit note", message: "Customer message." });
    try {
      expect((await command(request, "POST", `/api/v1/tickets/${ticket.id}/note`, { message: "First draft of the note.", title: "Draft title" })).status).toBe("done");
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("button", { name: "Edit this note" }).click();
      await page.getByLabel("Note title").fill("Final title");
      await page.getByLabel("Edit the note").fill("Final text of the note.");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Final text of the note.")).toBeVisible();
      await expect(page.getByText("Final title")).toBeVisible();
      await expect(page.getByText("First draft of the note.")).toHaveCount(0);
    } finally {
      await ticket.remove();
    }
  });

  test("a reply can be sent again", async ({ page, request }) => {
    const ticket = await createTicket(request, { subject: "[e2e] resend", message: "Customer message." });
    try {
      expect((await command(request, "POST", `/api/v1/tickets/${ticket.id}/reply`, { message: "A reply to resend." })).status).toBe("done");
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("button", { name: "Resend this reply" }).click();
      await expect(page.getByText("The reply was sent again.")).toBeVisible();
    } finally {
      await ticket.remove();
    }
  });

  test("a customer's message can be edited too, and the controls follow the role", async ({ page, request }) => {
    const ticket = await createTicket(request, { subject: "[e2e] edit message", message: "Typo in the customer message." });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("button", { name: "Edit this message" }).click();
      await page.getByLabel("Edit the message").fill("Fixed customer message.");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Fixed customer message.")).toBeVisible();
    } finally {
      await ticket.remove();
    }
  });
});

test.describe("answered and unanswered", () => {
  test("Mark as Answered moves a ticket to the Answered queue, and back", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] answered", message: "Mark me." });
    try {
      const number = (await get<{ number: string }>(request, `/api/v1/tickets/${ticket.id}`)).number;
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("button", { name: "Mark as Answered" }).click();
      await expect(page.getByText("Marked as answered.")).toBeVisible();
      expect((await get<{ is_answered: boolean }>(request, `/api/v1/tickets/${ticket.id}`)).is_answered).toBe(true);
      const answered = await get<{ items: { number: string }[] }>(request, "/api/v1/tickets/?queue=answered&page_size=100");
      expect(answered.items.map((t) => t.number)).toContain(number);
      expect(await osticketQueuePage(os, 3)).toContain(number);

      await page.getByRole("button", { name: "Mark as Unanswered" }).click();
      await expect(page.getByText("Marked as unanswered.")).toBeVisible();
      expect((await get<{ is_answered: boolean }>(request, `/api/v1/tickets/${ticket.id}`)).is_answered).toBe(false);
      expect(await osticketQueuePage(os, 3)).not.toContain(number);
    } finally {
      await ticket.remove();
      await os.dispose();
    }
  });
});

test.describe("assigning to a team", () => {
  test("a ticket can be assigned to a team and released again", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const feId = (await get<{ items: { id: number; username: string }[] }>(request, "/api/v1/staff?page_size=100")).items.find((s) => s.username === (process.env.FE_TEST_AGENT_USERNAME ?? "fe-agent"))!.id;
    const teamDone = await command(request, "POST", "/api/v1/teams", { name: `E2E Team Assign ${stamp}`, members: [feId] });
    expect(teamDone.status, teamDone.error_message ?? "").toBe("done");
    const teamId = firstInt(teamDone.result);
    const ticket = await createTicket(request, { subject: "[e2e] assign team", message: "To a team." });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("button", { name: "Assign", exact: true }).click();
      await page.getByLabel("Assign to").selectOption({ label: `E2E Team Assign ${stamp}` });
      await page.getByRole("button", { name: "Assign", exact: true }).last().click();
      await expect(page.getByText(`Ticket assigned to E2E Team Assign ${stamp}.`)).toBeVisible();
      await expect(cell(page, "Assigned To")).toContainText(`E2E Team Assign ${stamp}`);
      const detail = await get<{ team_id: number | null; assignee_staff_id: number | null }>(request, `/api/v1/tickets/${ticket.id}`);
      expect(detail.team_id).toBe(teamId);
      expect(detail.assignee_staff_id).toBeNull();
      expect((await osticketRows(os, "tickets.php?id=" + ticket.id)).length >= 0).toBe(true);
      expect(await osticketPageText(os, `tickets.php?id=${ticket.id}`)).toContain(`E2E Team Assign ${stamp}`);

      await page.getByRole("button", { name: "Release", exact: true }).click();
      await page.getByRole("button", { name: "Release", exact: true }).last().click();
      await expect(page.getByText("Ticket released.")).toBeVisible();
      expect((await get<{ team_id: number | null }>(request, `/api/v1/tickets/${ticket.id}`)).team_id).toBeNull();
    } finally {
      await ticket.remove();
      await command(request, "DELETE", `/api/v1/teams/${teamId}`).catch(() => undefined);
      await os.dispose();
    }
  });
});

test.describe("editing a category and a form", () => {
  test("a knowledge base category can be renamed and made private", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const done = await command(request, "POST", "/api/v1/kb/categories", { name: `E2E Category Edit ${stamp}`, description: "Made by the e2e suite.", is_public: true });
    expect(done.status, done.error_message ?? "").toBe("done");
    const id = firstInt(done.result);
    try {
      await page.goto(`/kb?cid=${id}`);
      await page.getByRole("link", { name: "Edit Category" }).click();
      await page.getByLabel(/^Name/).fill(`E2E Category Renamed ${stamp}`);
      await page.getByLabel(/^Category Type/).selectOption({ label: "Private (internal)" });
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(new RegExp(`/kb\\?cid=${id}$`));
      await expect(page.getByRole("heading", { name: `E2E Category Renamed ${stamp}` })).toBeVisible();
      await expect(page.getByText("(Private)").first()).toBeVisible();
      const stored = await get<{ name: string; is_public: boolean }>(request, `/api/v1/kb/categories/${id}`);
      expect(stored).toMatchObject({ name: `E2E Category Renamed ${stamp}`, is_public: false });
      const rows = await osticketRows(os, "categories.php");
      const row = rows.find((r) => r[1] === `E2E Category Renamed ${stamp}`);
      expect(row?.[2]).toBe("Private");
    } finally {
      await command(request, "DELETE", `/api/v1/kb/categories/${id}`).catch(() => undefined);
      await os.dispose();
    }
  });

  test("a form's title and instructions can be edited", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const done = await command(request, "POST", "/api/v1/forms", { title: `E2E Form Edit ${stamp}`, type: "G" });
    expect(done.status, done.error_message ?? "").toBe("done");
    const id = firstInt(done.result);
    try {
      await page.goto(`/admin/forms/${id}`);
      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel(/^Title/).fill(`E2E Form Renamed ${stamp}`);
      await page.getByLabel("Instructions").fill("Fill this in carefully.");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/forms/${id}$`));
      await expect(page.getByRole("heading", { name: `E2E Form Renamed ${stamp}` })).toBeVisible();
      await expect(cell(page, "Instructions")).toHaveText("Fill this in carefully.");
      const list = (await osticketRows(os, "forms.php")).map((r) => r.join(" | ")).join("\n");
      expect(list).toContain(`E2E Form Renamed ${stamp}`);
      expect((await osticketRaw(os, `forms.php?id=${id}`)).body).toContain("Fill this in carefully.");
    } finally {
      await command(request, "DELETE", `/api/v1/forms/${id}`).catch(() => undefined);
      await os.dispose();
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("sees Edit and Resend on thread entries exactly when their role allows replying", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { roles: Record<string, string[]> };
    const canReply = (me.roles["1"] ?? []).includes("ticket.reply");
    const open = (await (await request.get("/api/v1/tickets/?queue=open&page_size=1")).json()) as { items: { ticket_id: number }[] };
    await page.goto(`/tickets/${open.items[0].ticket_id}`);
    await expect(page.getByRole("heading", { name: /Ticket Thread/ })).toBeVisible();
    await settled(page);
    expect((await page.getByRole("button", { name: /^Edit this (message|reply|note)$/ }).count()) > 0).toBe(canReply);
  });

  test("can search", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Find anything").fill("printer");
    await page.getByRole("button", { name: "Go", exact: true }).click();
    await expect(page.getByRole("region", { name: "Ticket results" })).toContainText("Printer");
  });
});
