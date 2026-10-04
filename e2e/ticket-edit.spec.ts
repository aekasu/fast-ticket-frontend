import { expect, test } from "@playwright/test";
import { createTicket } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketTicket } from "./osticket";

const cell = (page: import("@playwright/test").Page, label: string) =>
  page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");

test.describe("transfer and edit as the admin, confirmed on osTicket's own page", () => {
  test.use({ storageState: AUTH.admin });

  test("transfer moves the ticket to another department", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] transfer", message: "Move me." });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await expect(cell(page, "Department")).toHaveText("Support");
      await page.getByRole("button", { name: "Transfer", exact: true }).click();
      // Its own department is not offered as a target.
      await expect(page.getByLabel("Department").locator("option", { hasText: "Support" })).toHaveCount(0);
      await page.getByLabel("Department").selectOption({ label: "Sales" });
      await page.getByLabel("Comments").fill("e2e transfer");
      await page.getByRole("button", { name: "Transfer", exact: true }).last().click();
      await expect(page.getByText("Ticket transferred to Sales.")).toBeVisible();
      await expect(cell(page, "Department")).toHaveText("Sales");
      expect((await osticketTicket(os, ticket.id)).info["Department"]).toContain("Sales");
    } finally {
      await ticket.remove();
      await os.dispose();
    }
  });

  test("edit saves only what changed, and sets and clears the due date", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] edit me", message: "Edit me." });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await expect(page.getByRole("heading", { name: /Update Ticket #/ })).toBeVisible();

      const due = new Date(Date.now() + 3 * 24 * 3600 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const local = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T10:30`;
      await page.getByLabel("Subject").fill("[e2e] edited subject");
      await page.getByLabel("Priority").selectOption({ label: "Emergency" });
      await page.getByLabel("Help Topic").selectOption({ label: "Access Issue" });
      await page.getByLabel("Ticket Source").selectOption("Phone");
      await page.getByLabel("Due Date").fill(local);
      await page.getByLabel("Internal Note").fill("e2e edit");
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page).toHaveURL(new RegExp(`/tickets/${ticket.id}$`));
      await expect(page.getByRole("heading", { name: /Ticket #/ })).toContainText("[e2e] edited subject");
      await expect(cell(page, "Priority")).toHaveText("Emergency");
      await expect(cell(page, "Help Topic")).toHaveText("Access Issue");
      await expect(cell(page, "Source")).toHaveText("Phone");
      await expect(cell(page, "Due Date")).not.toHaveText("");
      const ref = await osticketTicket(os, ticket.id);
      expect(ref.info["Priority"]).toContain("Emergency");
      expect(ref.info["Help Topic"]).toContain("Access Issue");
      expect(ref.info["Source"]).toContain("Phone");
      const explicitDue = ref.info["Due Date"].trim();
      expect(explicitDue).not.toBe("");
      expect(ref.html).toContain("e2e edit"); // the note

      // Clear the due date again.
      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await page.getByLabel("Due Date").fill("");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page).toHaveURL(new RegExp(`/tickets/${ticket.id}$`));
      await expect(cell(page, "Due Date")).toHaveText("");
      // osTicket falls back to the SLA's estimated due date, which the API does not expose (BACKEND_REQUESTS.md),
      // so its page is not blank; the explicit date we set is what must be gone.
      expect((await osticketTicket(os, ticket.id)).info["Due Date"].trim()).not.toBe(explicitDue);
    } finally {
      await ticket.remove();
      await os.dispose();
    }
  });

  test("a due date in the past is refused, shown, and nothing changes", async ({ page, request }) => {
    const ticket = await createTicket(request, { subject: "[e2e] past due", message: "Refuse me." });
    try {
      await page.goto(`/tickets/${ticket.id}/edit`);
      await expect(page.getByLabel("Subject")).toHaveValue("[e2e] past due");
      await page.getByLabel("Due Date").fill("2020-01-01T10:00");
      await page.getByRole("button", { name: "Save" }).click();
      const alert = page.getByRole("alert").filter({ hasText: /\S/ }).first();
      await expect(alert).toBeVisible();
      await expect(page).toHaveURL(/\/edit$/);
      console.log(`past due date refusal: ${await alert.innerText()}`);
      await page.goto(`/tickets/${ticket.id}`);
      await expect(cell(page, "Due Date")).toHaveText("");
    } finally {
      await ticket.remove();
    }
  });

  test("saving without a change says so", async ({ page, request }) => {
    const ticket = await createTicket(request, { subject: "[e2e] no change", message: "Nothing." });
    try {
      await page.goto(`/tickets/${ticket.id}/edit`);
      await expect(page.getByLabel("Subject")).toHaveValue("[e2e] no change");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("No changes to save.")).toBeVisible();
    } finally {
      await ticket.remove();
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("sees Edit and Transfer exactly when their role allows", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { roles: Record<string, string[]> };
    const perms = me.roles["1"] ?? [];
    const open = (await (await request.get("/api/v1/tickets/?queue=open&page_size=1")).json()) as { items: { ticket_id: number }[] };
    await page.goto(`/tickets/${open.items[0].ticket_id}`);
    await expect(page.getByRole("heading", { name: /Ticket Thread/ })).toBeVisible();
    expect((await page.getByRole("link", { name: "Edit", exact: true }).count()) > 0).toBe(perms.includes("ticket.edit"));
    expect((await page.getByRole("button", { name: "Transfer", exact: true }).count()) > 0).toBe(perms.includes("ticket.transfer"));
    if (!perms.includes("ticket.edit")) {
      await page.goto(`/tickets/${open.items[0].ticket_id}/edit`);
      await expect(page.getByText(/Access denied/)).toBeVisible();
    }
  });
});
