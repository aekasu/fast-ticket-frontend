import { expect, test } from "@playwright/test";
import { createTicket } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketPageText } from "./osticket";

test.describe("link, unlink and a status on a reply, confirmed on osTicket's page", () => {
  test.use({ storageState: AUTH.admin });

  test("link a ticket, see it related, then unlink", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const parent = await createTicket(request, { subject: `[e2e] link parent ${stamp}`, message: "Parent." });
    const child = await createTicket(request, { subject: `[e2e] link child ${stamp}`, message: "Child." });
    const number = async (id: number) => ((await (await request.get(`/api/v1/tickets/${id}`)).json()) as { number: string }).number;
    try {
      const childNumber = await number(child.id);
      await page.goto(`/tickets/${parent.id}`);
      await page.getByRole("button", { name: "Link Tickets" }).click();
      const form = page.getByRole("form", { name: "Link tickets" });
      await page.getByLabel("Find tickets").fill(`link child ${stamp}`);
      await expect(form.locator("li", { hasText: `#${childNumber}` })).toBeVisible();
      await form.getByRole("checkbox").check();
      await page.getByRole("button", { name: /^Link 1 ticket$/ }).click();
      await expect(page.getByText("1 ticket linked to this ticket.")).toBeVisible();

      const related = page.getByRole("region", { name: "Related tickets" });
      await expect(related).toContainText(`#${childNumber}`);
      // The child stays open (a link closes nothing) and osTicket shows the relation.
      expect(await osticketPageText(os, `tickets.php?id=${child.id}`)).not.toMatch(/Closed by Admin User/);

      await page.getByRole("button", { name: "Unlink Tickets" }).click();
      await expect(page.getByText("All linked tickets released.")).toBeVisible();
      await expect(related).toHaveCount(0);
    } finally {
      await child.remove();
      await parent.remove();
      await os.dispose();
    }
  });

  test("a reply can set the ticket's status", async ({ page, request }) => {
    const ticket = await createTicket(request, { subject: "[e2e] reply status", message: "Resolve me." });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByLabel("Response", { exact: true }).fill("Fixed, closing.");
      await page.getByLabel("Ticket status").selectOption({ label: "Resolved" });
      await page.getByRole("button", { name: "Post Reply" }).last().click();
      await expect(page.getByText("Reply posted.")).toBeVisible();
      await expect(page.locator("th", { hasText: /^Status:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("Resolved");
    } finally {
      await ticket.remove();
    }
  });
});
