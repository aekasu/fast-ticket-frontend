import { expect, test } from "@playwright/test";
import { command } from "./api";
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
      await page.getByLabel("Department").selectOption({ label: "Sales" });
      await page.getByLabel("Priority").selectOption({ label: "High" });
      await page.getByLabel("Issue Summary").fill(subject);
      await page.getByLabel("Issue Details").fill("Created by the e2e suite.");
      await page.getByRole("button", { name: "Create Ticket" }).click();

      await expect(page).toHaveURL(/\/tickets\/\d+$/);
      id = Number(page.url().split("/").pop());
      await expect(page.getByRole("heading", { name: /Ticket #/ })).toContainText(subject);

      const ref = await osticketTicket(os, id);
      expect(ref.info["Priority"]).toContain("High");
      expect(ref.info["Department"]).toContain("Sales");
      expect(ref.info["Help Topic"]).toContain("Report a Problem");
      expect(ref.info["User"]).toContain("New E2E User");
      expect(ref.info["Email"]).toContain("new.user@example.com");
      expect(ref.html).toContain("Created by the e2e suite.");
      await expect(page.locator("th", { hasText: "Priority:" }).locator("xpath=following-sibling::td[1]")).toHaveText("High");
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
    expect((await page.getByRole("link", { name: "New Ticket" }).count()) > 0).toBe(allowed);
    await page.goto("/tickets/new");
    if (allowed) await expect(page.getByRole("heading", { name: "Open a New Ticket" })).toBeVisible();
    else await expect(page.getByText("This page could not be found.")).toBeVisible();
  });
});
