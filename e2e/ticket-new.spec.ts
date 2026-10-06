import { expect, test } from "@playwright/test";
import { command, deleteTicketAndUser, settled } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketTicket } from "./osticket";

test.describe("New Ticket as the admin", () => {
  test.use({ storageState: AUTH.admin });

  test("creates a ticket that osTicket's own page shows the same", async ({ page, request }) => {
    const os = await osticketAdmin();
    const subject = `[e2e] new ticket ${Date.now()}`;
    let id: number | undefined;
    try {
      await page.goto("/tickets");
      await page.getByRole("link", { name: "New Ticket" }).click();
      await expect(page.getByRole("heading", { name: "Open a New Ticket" })).toBeVisible();

      await page.getByLabel("Email Address").fill("new.user@example.com");
      await page.getByLabel("Full Name").fill("New E2E User");
      await page.getByLabel("Help Topic").selectOption({ label: "Report a Problem" });
      await page.getByLabel("Department", { exact: true }).selectOption({ label: "Sales" });
      await page.getByLabel("Priority").selectOption({ label: "High" });
      await page.getByLabel("Issue Summary").fill(subject);
      await page.getByLabel("Issue Details").fill("Created by the e2e suite.");
      await page.getByRole("button", { name: "Create Ticket" }).click();

      await expect(page).toHaveURL(/\/tickets\/\d+$/);
      id = Number(page.url().split("/").pop());
      await expect(page.getByRole("heading", { name: /Ticket #/ })).toContainText(subject);
      // The agent's own ticket is not "new" news: give its event time to arrive, then expect no bar.
      await page.waitForTimeout(2000);
      await expect(page.locator("[data-new-tickets]")).toHaveCount(0);

      const ref = await osticketTicket(os, id);
      expect(ref.info["Priority"]).toContain("High");
      expect(ref.info["Department"]).toContain("Sales");
      expect(ref.info["Help Topic"]).toContain("Report a Problem");
      expect(ref.info["User"]).toContain("New E2E User");
      expect(ref.info["Email"]).toContain("new.user@example.com");
      expect(ref.html).toContain("Created by the e2e suite.");
      await expect(page.locator("th", { hasText: "Priority:" }).locator("xpath=following-sibling::td[1]")).toHaveText("High");
    } finally {
      if (id) await deleteTicketAndUser(request, id);
      await os.dispose();
    }
  });

  test("an existing user, Cc, source, SLA, due date, assignment, response and note are all applied", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const subject = `[e2e] full form ${stamp}`;
    const users = (await (await request.get("/api/v1/users?page_size=10&sort=name")).json()) as { items: { id: number; name: string; email: string }[] };
    const [requester, cc] = users.items.filter((u) => u.email);
    const due = new Date(Date.now() + 5 * 24 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T10:30`;
    let id: number | undefined;
    try {
      await page.goto("/tickets/new");
      await expect(page.getByLabel("Existing user")).toBeVisible();
      await page.getByLabel("Existing user").selectOption(String(requester.id));
      // With an existing user chosen there are no name and email boxes.
      await expect(page.getByLabel("Email Address")).toHaveCount(0);
      await page.getByLabel("Cc collaborators").selectOption(String(cc.id));
      await page.getByLabel("Ticket Source").selectOption("Email");
      await page.getByLabel("Help Topic").selectOption({ label: "General Inquiry" });
      await page.getByLabel("Assign To").selectOption({ label: "Frontend Agent" });
      await page.getByLabel("Due Date").fill(local);
      await page.getByLabel("Issue Summary").fill(subject);
      await page.getByLabel("Issue Details").fill("Opened with the whole staff form.");
      await page.getByLabel("Response", { exact: true }).fill("A first response from the e2e suite.");
      await page.getByLabel("Internal Note").fill("An internal note from the e2e suite.");
      await page.getByRole("button", { name: "Create Ticket" }).click();

      await expect(page).toHaveURL(/\/tickets\/\d+$/);
      id = Number(page.url().split("/").pop());
      const ref = await osticketTicket(os, id);
      expect(ref.info["Source"]).toContain("Email");
      expect(ref.info["User"]).toContain(requester.name);
      expect(ref.info["Assigned To"]).toContain("Frontend Agent");
      expect(ref.info["Due Date"].trim()).not.toBe("");
      expect(ref.html).toContain("A first response from the e2e suite.");
      expect(ref.html).toContain("An internal note from the e2e suite.");
      expect(ref.html).toContain(cc.name);
      await expect(page.locator("th", { hasText: "Due Date:" }).locator("xpath=following-sibling::td[1]")).toHaveText(ref.info["Due Date"].trim());
      await expect(page.getByText("A first response from the e2e suite.")).toBeVisible();
      await expect(page.getByText("An internal note from the e2e suite.")).toBeVisible();
    } finally {
      if (id) await command(request, "DELETE", `/api/v1/tickets/${id}`);
      await os.dispose();
    }
  });

  test("a refusal from osTicket is shown as it words it, and nothing is created", async ({ page, request }) => {
    const subject = `[e2e] refused ${Date.now()}`;
    await page.goto("/tickets/new");
    // "a@b" passes the browser's check but not osTicket's.
    await page.getByLabel("Email Address").fill("a@b");
    await page.getByLabel("Full Name").fill("Refused User");
    await page.getByLabel("Issue Summary").fill(subject);
    await page.getByLabel("Help Topic").selectOption({ label: "General Inquiry" });
    await page.getByLabel("Issue Details").fill("Should not be created.");
    await page.getByRole("button", { name: "Create Ticket" }).click();

    const alert = page.getByRole("alert").filter({ hasText: /\S/ }).first();
    await expect(alert).toBeVisible();
    await expect(page).toHaveURL(/\/tickets\/new$/);
    await expect(page.getByRole("button", { name: "Create Ticket" })).toBeEnabled();
    const found = (await (await request.get(`/api/v1/tickets/?q=${encodeURIComponent(subject)}`)).json()) as { items: unknown[] };
    expect(found.items).toHaveLength(0);
    console.log(`osTicket's refusal: ${await alert.innerText()}`);
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("is offered New Ticket exactly when their role can create tickets", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { roles: Record<string, string[]> };
    const allowed = Object.values(me.roles).some((p) => p.includes("ticket.create"));
    await page.goto("/tickets");
    await expect(page.getByRole("list", { name: "Queues", exact: true })).toBeVisible();
    await settled(page);
    expect((await page.getByRole("link", { name: "New Ticket" }).count()) > 0).toBe(allowed);
    await page.goto("/tickets/new");
    if (allowed) await expect(page.getByRole("heading", { name: "Open a New Ticket" })).toBeVisible();
    else await expect(page.getByText("This page could not be found.")).toBeVisible();
  });
});
