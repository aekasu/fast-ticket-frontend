import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { command, createTicket, settled } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketPageText, osticketTicket } from "./osticket";

const cell = (page: Page, label: string) => page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");

async function createUser(request: APIRequestContext, name: string, email: string) {
  const done = await command(request, "POST", "/api/v1/users", { name, email });
  expect(done.status, done.error_message ?? "").toBe("done");
  return Object.values(done.result).find((v): v is number => typeof v === "number")!;
}

test.describe("owner, collaborators and delete as the admin, confirmed on osTicket's page", () => {
  test.use({ storageState: AUTH.admin });

  test("add, alert, disable and remove a collaborator", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const ticket = await createTicket(request, { subject: "[e2e] collaborators", message: "Add people." });
    const collabEmail = `e2e.collab.${stamp}@example.com`;
    const collabId = await createUser(request, `E2E Collab ${stamp}`, collabEmail);
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("button", { name: /Manage Collaborators \(0\)/ }).click();
      await expect(page.getByText("No collaborators.")).toBeVisible();

      await page.getByLabel("User").selectOption({ label: `E2E Collab ${stamp} (${collabEmail})` });
      await page.getByRole("button", { name: "Add Collaborator" }).click();
      await expect(page.getByText(`E2E Collab ${stamp} added as a collaborator.`)).toBeVisible();
      await expect(page.getByRole("button", { name: /Manage Collaborators \(1\)/ })).toBeVisible();
      await expect(page.getByText(`Collaborators:`)).toBeVisible();
      // osTicket records the change as an event in the thread.
      expect(await osticketPageText(os, `tickets.php?id=${ticket.id}`)).toContain(`added E2E Collab ${stamp} as collaborators`);
      // Already a collaborator, so no longer offered.
      await expect(page.getByLabel("User").locator("option", { hasText: `E2E Collab ${stamp}` })).toHaveCount(0);

      // Alerts off, then the API agrees
      // The boxes show what the server holds, so they flip once osTicket has confirmed the change.
      await page.getByLabel(`Send alerts to E2E Collab ${stamp}`).click();
      await expect(page.getByText(`E2E Collab ${stamp} will not receive alerts.`)).toBeVisible();
      await expect(page.getByLabel(`Send alerts to E2E Collab ${stamp}`)).not.toBeChecked();
      let detail = (await (await request.get(`/api/v1/tickets/${ticket.id}`)).json()) as { collaborators: { user_id: number; is_cc: boolean; is_active: boolean }[] };
      expect(detail.collaborators.find((c) => c.user_id === collabId)?.is_cc).toBe(false);

      // Disable
      await page.getByLabel(`E2E Collab ${stamp} is active`).click();
      await expect(page.getByText(`E2E Collab ${stamp} is now disabled.`)).toBeVisible();
      await expect(page.getByLabel(`E2E Collab ${stamp} is active`)).not.toBeChecked();
      detail = (await (await request.get(`/api/v1/tickets/${ticket.id}`)).json()) as typeof detail;
      expect(detail.collaborators.find((c) => c.user_id === collabId)?.is_active).toBe(false);

      // Remove
      await page.getByRole("button", { name: `Remove E2E Collab ${stamp}` }).click();
      await expect(page.getByText(`E2E Collab ${stamp} removed.`)).toBeVisible();
      await expect(page.getByText("No collaborators.")).toBeVisible();
      expect(await osticketPageText(os, `tickets.php?id=${ticket.id}`)).toContain(`removed E2E Collab ${stamp} from the collaborators`);
    } finally {
      await ticket.remove();
      await command(request, "DELETE", `/api/v1/users/${collabId}`).catch(() => undefined);
      await os.dispose();
    }
  });

  test("change the owner", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const ticket = await createTicket(request, { subject: "[e2e] owner", message: "Change my owner.", name: "E2E Original", email: `e2e.original.${stamp}@example.com` });
    const originalId = ((await (await request.get(`/api/v1/tickets/${ticket.id}`)).json()) as { user_id: number }).user_id;
    const newEmail = `e2e.newowner.${stamp}@example.com`;
    const newId = await createUser(request, `E2E New Owner ${stamp}`, newEmail);
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await expect(cell(page, "User")).toHaveText("E2E Original");
      await page.getByRole("button", { name: "Change Owner" }).click();
      await expect(page.getByText(/Current owner:/)).toContainText("E2E Original");
      // The current owner is not offered.
      await expect(page.getByLabel("User").locator("option", { hasText: "E2E Original" })).toHaveCount(0);
      await page.getByLabel("User").selectOption({ label: `E2E New Owner ${stamp} (${newEmail})` });
      await page.getByRole("button", { name: "Change Owner" }).last().click();
      await expect(page.getByText(`Ticket owner changed to E2E New Owner ${stamp}.`)).toBeVisible();
      await expect(cell(page, "User")).toHaveText(`E2E New Owner ${stamp}`);
      await expect(cell(page, "Email")).toHaveText(newEmail);
      const ref = await osticketTicket(os, ticket.id);
      expect(ref.info["User"]).toContain(`E2E New Owner ${stamp}`);
      expect(ref.info["Email"]).toContain(newEmail);
    } finally {
      // Delete the ticket by hand: removing it through the helper would delete only its current owner.
      await command(request, "DELETE", `/api/v1/tickets/${ticket.id}`).catch(() => undefined);
      for (const id of [originalId, newId]) await command(request, "DELETE", `/api/v1/users/${id}`).catch(() => undefined);
      await os.dispose();
    }
  });

  test("merge tickets into this one", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const parent = await createTicket(request, { subject: `[e2e] merge parent ${stamp}`, message: "Parent." });
    const child = await createTicket(request, { subject: `[e2e] merge child ${stamp}`, message: "Child." });
    const number = async (id: number) => ((await (await request.get(`/api/v1/tickets/${id}`)).json()) as { number: string }).number;
    try {
      const [parentNumber, childNumber] = [await number(parent.id), await number(child.id)];
      await page.goto(`/tickets/${parent.id}`);
      await page.getByRole("button", { name: "Merge Tickets" }).click();
      await page.getByLabel("Find tickets").fill(`merge child ${stamp}`);
      await expect(page.getByRole("form", { name: "Merge tickets" }).locator("li", { hasText: `#${childNumber}` })).toBeVisible();
      await page.getByRole("form", { name: "Merge tickets" }).getByRole("checkbox").check();
      await page.getByRole("button", { name: /^Merge 1 ticket$/ }).click();
      await expect(page.getByText("1 ticket merged into this ticket.")).toBeVisible();

      // osTicket records the merge on both tickets, closes the child, and hides it from the queues.
      expect(await osticketPageText(os, `tickets.php?id=${parent.id}`)).toContain(`merged this ticket with Ticket #${childNumber}`);
      const childPage = await osticketPageText(os, `tickets.php?id=${child.id}`);
      expect(childPage).toContain(`merged this ticket with Ticket #${parentNumber}`);
      expect(childPage).toMatch(/Closed by Admin User/);
      const open = (await (await request.get("/api/v1/tickets/?queue=open&page_size=200")).json()) as { items: { number: string }[] };
      expect(open.items.map((t) => t.number)).toContain(parentNumber);
      expect(open.items.map((t) => t.number)).not.toContain(childNumber);
    } finally {
      await child.remove();
      await parent.remove();
      await os.dispose();
    }
  });

  test("refer a ticket to a department and to an agent", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] refer", message: "Refer me." });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("button", { name: "Refer", exact: true }).click();
      await expect(page.getByText(/cannot be (listed|created)|not.*listed or removed/)).toBeVisible();
      await page.getByRole("radio", { name: "Department" }).check();
      await page.getByLabel("Refer to").selectOption({ label: "Sales" });
      await page.getByLabel("Comments").fill("e2e referral to a department");
      await page.getByRole("button", { name: "Refer", exact: true }).last().click();
      await expect(page.getByText("Ticket referred.")).toBeVisible();

      await page.getByRole("button", { name: "Refer", exact: true }).click();
      await page.getByRole("radio", { name: "Agent" }).check();
      await page.getByLabel("Refer to").selectOption({ label: "Frontend Agent" });
      await page.getByRole("button", { name: "Refer", exact: true }).last().click();
      await expect(page.getByText("Ticket referred.")).toBeVisible();

      const theirs = await osticketPageText(os, `tickets.php?id=${ticket.id}`);
      expect(theirs).toContain("referred this to Sales");
      expect(theirs).toContain("referred this to Frontend Agent");
      expect(theirs).toContain("e2e referral to a department");
      // Our thread shows osTicket's "Referral" notes too.
      await expect(page.getByText("e2e referral to a department")).toBeVisible();
    } finally {
      await ticket.remove();
      await os.dispose();
    }
  });

  test("delete a ticket", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] delete me", message: "Delete this ticket." });
    const userId = ((await (await request.get(`/api/v1/tickets/${ticket.id}`)).json()) as { user_id: number }).user_id;
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.getByText(/This cannot be undone/)).toBeVisible();
      await page.getByRole("button", { name: "Delete ticket" }).click();
      await expect(page).toHaveURL(/\/tickets$/);
      expect((await request.get(`/api/v1/tickets/${ticket.id}`)).status()).toBe(404);
      expect(await osticketPageText(os, `tickets.php?id=${ticket.id}`)).toMatch(/Unknown or invalid|Access denied|not found/i);
    } finally {
      await command(request, "DELETE", `/api/v1/users/${userId}`).catch(() => undefined);
      await os.dispose();
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("sees these tools only when their role allows", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { roles: Record<string, string[]> };
    const perms = me.roles["1"] ?? [];
    const open = (await (await request.get("/api/v1/tickets/?queue=open&page_size=1")).json()) as { items: { ticket_id: number }[] };
    await page.goto(`/tickets/${open.items[0].ticket_id}`);
    await expect(page.getByRole("heading", { name: /Ticket Thread/ })).toBeVisible();
    await settled(page);
    expect((await page.getByRole("button", { name: "Change Owner" }).count()) > 0).toBe(perms.includes("ticket.edit"));
    expect((await page.getByRole("button", { name: /Manage Collaborators/ }).count()) > 0).toBe(perms.includes("ticket.edit"));
    expect((await page.getByRole("button", { name: "Delete", exact: true }).count()) > 0).toBe(perms.includes("ticket.delete"));
    expect((await page.getByRole("button", { name: "Merge Tickets" }).count()) > 0).toBe(perms.includes("ticket.merge"));
    expect((await page.getByRole("button", { name: "Refer", exact: true }).count()) > 0).toBe(perms.includes("ticket.refer"));
  });
});
