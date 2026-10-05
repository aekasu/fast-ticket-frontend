import { expect, test } from "@playwright/test";
import { command, createTicket, settled } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketTicket } from "./osticket";

test.describe("ticket actions as the admin, confirmed on osTicket's own page", () => {
  test.use({ storageState: AUTH.admin });

  test("reply, note, assign, release, close and reopen", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] actions", message: "Please help." });
    try {
      const before = await osticketTicket(os, ticket.id);
      await page.goto(`/tickets/${ticket.id}`);
      await expect(page.getByRole("heading", { name: /Ticket Thread/ })).toBeVisible();

      // Reply
      await page.getByLabel("Response", { exact: true }).fill("Here is the e2e reply.");
      await page.getByRole("button", { name: "Post Reply" }).last().click();
      await expect(page.getByText("Reply posted.")).toBeVisible();
      await expect(page.locator("ol")).toContainText("Here is the e2e reply.");
      let os1 = await osticketTicket(os, ticket.id);
      expect(os1.html).toContain("Here is the e2e reply.");
      expect(os1.threadCount).toBe(before.threadCount + 1);

      // Internal note
      await page.getByRole("tab", { name: "Post Internal Note" }).click();
      await page.getByLabel("Note title").fill("E2E note");
      await page.getByLabel("Internal note", { exact: true }).fill("Only agents see this.");
      await page.getByRole("button", { name: "Post Note" }).click();
      await expect(page.getByText("Internal note posted.")).toBeVisible();
      os1 = await osticketTicket(os, ticket.id);
      expect(os1.html).toContain("Only agents see this.");
      expect(os1.threadCount).toBe(before.threadCount + 2);

      // Assign to the test agent
      await page.getByRole("button", { name: "Assign", exact: true }).click();
      await page.getByLabel("Assign to").selectOption({ label: "Frontend Agent" });
      await page.getByLabel("Comments").fill("e2e assignment");
      await page.getByRole("button", { name: "Assign", exact: true }).last().click();
      await expect(page.getByText("Ticket assigned to Frontend Agent.")).toBeVisible();
      await expect(page.locator("th", { hasText: "Assigned To:" }).locator("xpath=following-sibling::td[1]")).toContainText("Frontend Agent");
      expect((await osticketTicket(os, ticket.id)).info["Assigned To"]).toContain("Frontend Agent");

      // Release
      await page.getByRole("button", { name: "Release", exact: true }).click();
      await page.getByRole("button", { name: "Release", exact: true }).last().click();
      await expect(page.getByText("Ticket released.")).toBeVisible();
      await expect(page.getByText("— Unassigned —")).toBeVisible();
      expect((await osticketTicket(os, ticket.id)).info["Assigned To"]).toMatch(/Unassigned/i);

      // Claim
      await page.getByRole("button", { name: "Claim" }).click();
      await expect(page.getByText("Ticket assigned to you.")).toBeVisible();
      expect((await osticketTicket(os, ticket.id)).info["Assigned To"]).toContain("Admin User");

      // Close, then it is in the Closed queue and the status says so on osTicket's page
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.getByLabel("Comments").fill("done");
      await page.getByRole("button", { name: "Close", exact: true }).last().click();
      await expect(page.getByText("Ticket closed.")).toBeVisible();
      await expect(page.locator("th", { hasText: "Status:" }).locator("xpath=following-sibling::td[1]")).toHaveText("Closed");
      expect((await osticketTicket(os, ticket.id)).info["Status"]).toContain("Closed");
      await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();

      // Reopen
      await page.getByRole("button", { name: "Reopen", exact: true }).click();
      await page.getByRole("button", { name: "Reopen", exact: true }).last().click();
      await expect(page.getByText("Ticket reopened.")).toBeVisible();
      expect((await osticketTicket(os, ticket.id)).info["Status"]).toContain("Open");
    } finally {
      await ticket.remove();
      await os.dispose();
    }
  });

  test("osTicket's refusal is shown as it words it", async ({ page, request }) => {
    const ticket = await createTicket(request, { subject: "[e2e] refusal", message: "Stale page." });
    try {
      // With live updates the page would refresh itself when the ticket is closed elsewhere. Cut the stream so it
      // really is stale, as a page would be if its connection had dropped.
      await page.route("**/api/events", (route) => route.abort());
      await page.goto(`/tickets/${ticket.id}`);
      await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
      // Someone else closes it; this page still offers "Close".
      expect((await command(request, "POST", `/api/v1/tickets/${ticket.id}/close`, {})).status).toBe("done");
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.getByRole("button", { name: "Close", exact: true }).last().click();
      const alert = page.getByRole("alert").filter({ hasNotText: /^$/ }).first();
      await expect(alert).toBeVisible();
      await expect(alert).not.toHaveText("Request failed");
    } finally {
      await ticket.remove();
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("sees the buttons their role allows, no more", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { roles: Record<string, string[]> };
    const perms = me.roles["1"] ?? [];

    const open = (await (await request.get("/api/v1/tickets/?queue=open&page_size=1")).json()) as { items: { ticket_id: number }[] };
    await page.goto(`/tickets/${open.items[0].ticket_id}`);
    await expect(page.getByRole("heading", { name: /Ticket Thread/ })).toBeVisible();

    await settled(page);
    const visible = async (name: string) => (await page.getByRole("button", { name, exact: true }).count()) > 0;
    expect(await visible("Close")).toBe(perms.includes("ticket.close"));
    expect(await visible("Assign")).toBe(perms.includes("ticket.assign"));
    expect(await page.getByRole("tab", { name: "Post Reply" }).count() > 0).toBe(perms.includes("ticket.reply"));
  });
});
