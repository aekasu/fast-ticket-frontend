import { expect, test } from "@playwright/test";
import { addFormField, command, createTask, removeFormField, settled } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketPageText, osticketRaw } from "./osticket";

const TICKET_FORM = 2;

test.describe("custom fields on tickets", () => {
  test.use({ storageState: AUTH.admin });

  test("fields added in osTicket's ticket form can be answered, shown and edited", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const fieldIds: number[] = [];
    let ticketId: number | undefined;
    try {
      fieldIds.push(await addFormField(request, TICKET_FORM, { label: "E2E CF Text", type: "text", name: "e2e_cf_text" }));
      fieldIds.push(await addFormField(request, TICKET_FORM, { label: "E2E CF Choice", type: "choices", name: "e2e_cf_choice", choices: "a:Alpha\nb:Beta" }));
      fieldIds.push(await addFormField(request, TICKET_FORM, { label: "E2E CF Flag", type: "bool", name: "e2e_cf_flag" }));
      fieldIds.push(await addFormField(request, TICKET_FORM, { label: "E2E CF Memo", type: "memo", name: "e2e_cf_memo" }));
      fieldIds.push(await addFormField(request, TICKET_FORM, { label: "E2E CF Many", type: "choices", name: "e2e_cf_many", choices: "x:Ex\ny:Why\nz:Zed", multiselect: true }));

      // Create with answers
      await page.goto("/tickets/new");
      await page.getByLabel("Email Address").fill(`e2e.cf.${stamp}@example.com`);
      await page.getByLabel("Full Name").fill("E2E CF User");
      await page.getByLabel("Issue Summary").fill(`[e2e] custom fields ${stamp}`);
      await page.getByLabel("Help Topic").selectOption({ label: "General Inquiry" });
      await page.getByLabel("Issue Details").fill("Has custom answers.");
      await expect(page.getByLabel("E2E CF Text")).toBeVisible();
      await page.getByLabel("E2E CF Text").fill("typed answer");
      await page.getByLabel("E2E CF Choice").selectOption({ label: "Alpha" });
      await page.getByLabel("E2E CF Flag").check();
      await page.getByLabel("E2E CF Memo").fill("memo line");
      await page.getByRole("group", { name: "E2E CF Many" }).getByLabel("Ex").check();
      await page.getByRole("group", { name: "E2E CF Many" }).getByLabel("Zed").check();
      await page.getByRole("button", { name: "Create Ticket" }).click();
      await expect(page).toHaveURL(/\/tickets\/\d+$/);
      ticketId = Number(page.url().split("/").pop());

      // Shown on the ticket page
      const fields = page.getByRole("region", { name: "Custom fields" });
      await expect(fields).toBeVisible();
      const row = (label: string) => fields.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");
      await expect(row("E2E CF Text")).toHaveText("typed answer");
      await expect(row("E2E CF Choice")).toHaveText("Alpha");
      await expect(row("E2E CF Flag")).toHaveText("Yes");
      await expect(row("E2E CF Memo")).toContainText("memo line");
      await expect(row("E2E CF Many")).toHaveText("Ex, Zed");

      // And on osTicket's own page
      const theirs = await osticketPageText(os, `tickets.php?id=${ticketId}`);
      for (const label of ["E2E CF Text", "E2E CF Choice", "E2E CF Flag", "E2E CF Memo", "E2E CF Many"]) expect(theirs, label).toContain(label);
      expect(theirs).toContain("typed answer");
      expect(theirs).toContain("Alpha");
      expect(theirs).toContain("memo line");

      // Edit: the form is pre-filled, only what changes is sent
      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await expect(page.getByLabel("E2E CF Text")).toHaveValue("typed answer");
      await expect(page.getByLabel("E2E CF Choice")).toHaveValue("a");
      await expect(page.getByLabel("E2E CF Flag")).toBeChecked();
      await expect(page.getByRole("group", { name: "E2E CF Many" }).getByLabel("Ex")).toBeChecked();
      await expect(page.getByRole("group", { name: "E2E CF Many" }).getByLabel("Why")).not.toBeChecked();
      await page.getByLabel("E2E CF Text").fill("edited answer");
      await page.getByLabel("E2E CF Choice").selectOption({ label: "Beta" });
      await page.getByLabel("E2E CF Flag").uncheck();
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`));
      await expect(row("E2E CF Text")).toHaveText("edited answer");
      await expect(row("E2E CF Choice")).toHaveText("Beta");
      await expect(row("E2E CF Flag")).toHaveText("No");
      await expect(row("E2E CF Many")).toHaveText("Ex, Zed"); // untouched
      const after = await osticketPageText(os, `tickets.php?id=${ticketId}`);
      expect(after).toContain("edited answer");
      expect(after).toContain("Beta");
    } finally {
      if (ticketId) {
        const t = (await (await request.get(`/api/v1/tickets/${ticketId}`)).json().catch(() => ({}))) as { user_id?: number };
        await request.fetch(`/api/v1/tickets/${ticketId}`, { method: "DELETE", headers: { "Idempotency-Key": `cf-del-${stamp}` } });
        await new Promise((r) => setTimeout(r, 1500));
        if (t.user_id) await request.fetch(`/api/v1/users/${t.user_id}`, { method: "DELETE", headers: { "Idempotency-Key": `cf-deluser-${stamp}` } });
      }
      for (const id of fieldIds) await removeFormField(request, TICKET_FORM, id);
      await os.dispose();
    }
  });
});

test.describe("a custom-list field", () => {
  test.use({ storageState: AUTH.admin });

  test("is picked from the list's items on a new ticket, shown, and changed on edit", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    let listId: number | undefined;
    let fieldId: number | undefined;
    let ticketId: number | undefined;
    try {
      const made = await command(request, "POST", "/api/v1/lists", { name: `E2E Colours ${stamp}`, name_plural: `E2E Colours ${stamp}s` });
      expect(made.status, made.error_message ?? "").toBe("done");
      listId = Object.values(made.result).find((v): v is number => typeof v === "number")!;
      for (const value of ["Red", "Blue"]) expect((await command(request, "POST", `/api/v1/lists/${listId}/items`, { value })).status).toBe("done");
      fieldId = await addFormField(request, TICKET_FORM, { label: "E2E CF List", type: `list-${listId}`, name: "e2e_cf_list" });

      await page.goto("/tickets/new");
      await page.getByLabel("Email Address").fill(`e2e.list.${stamp}@example.com`);
      await page.getByLabel("Full Name").fill("E2E List User");
      await page.getByLabel("Issue Summary").fill(`[e2e] list field ${stamp}`);
      await page.getByLabel("Help Topic").selectOption({ label: "General Inquiry" });
      await page.getByLabel("Issue Details").fill("Picks from a list.");
      await page.getByLabel("E2E CF List").selectOption({ label: "Red" });
      await page.getByRole("button", { name: "Create Ticket" }).click();
      await expect(page).toHaveURL(/\/tickets\/\d+$/);
      ticketId = Number(page.url().split("/").pop());
      const fields = page.getByRole("region", { name: "Custom fields" });
      await expect(fields.locator("th", { hasText: /^E2E CF List:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("Red");
      expect(await osticketPageText(os, `tickets.php?id=${ticketId}`)).toContain("Red");

      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await page.getByLabel("E2E CF List").selectOption({ label: "Blue" });
      await page.getByRole("button", { name: "Save" }).click();
      await expect(fields.locator("th", { hasText: /^E2E CF List:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("Blue");
    } finally {
      if (ticketId) await command(request, "DELETE", `/api/v1/tickets/${ticketId}`).catch(() => undefined);
      if (fieldId) await removeFormField(request, TICKET_FORM, fieldId);
      if (listId) await command(request, "DELETE", `/api/v1/lists/${listId}`).catch(() => undefined);
      await os.dispose();
    }
  });
});

test.describe("custom fields on users, organizations and tasks", () => {
  test.use({ storageState: AUTH.admin });

  test("a user's custom field", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    let fieldId: number | undefined;
    let userId: number | undefined;
    try {
      fieldId = await addFormField(request, 1, { label: "E2E CF Badge", type: "text", name: "e2e_cf_badge" });
      await page.goto("/users/new");
      await page.getByLabel("Email Address").fill(`e2e.cfuser.${stamp}@example.com`);
      await page.getByLabel("Full Name").fill(`E2E CF Person ${stamp}`);
      await page.getByLabel("E2E CF Badge").fill("B-1001");
      await page.getByRole("button", { name: "Add User" }).click();
      await expect(page).toHaveURL(/\/users\/\d+$/);
      userId = Number(page.url().split("/").pop());
      const fields = page.getByRole("region", { name: "Custom fields" });
      await expect(fields.locator("th", { hasText: /^E2E CF Badge:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("B-1001");
      // osTicket's own view page does not print a user's custom answers; its edit dialog holds them in the form.
      expect((await osticketRaw(os, `ajax.php/users/${userId}/edit`)).body).toContain('value="B-1001"');

      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await expect(page.getByLabel("E2E CF Badge")).toHaveValue("B-1001");
      await page.getByLabel("E2E CF Badge").fill("B-2002");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(fields.locator("th", { hasText: /^E2E CF Badge:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("B-2002");
      expect((await osticketRaw(os, `ajax.php/users/${userId}/edit`)).body).toContain('value="B-2002"');
    } finally {
      if (userId) await command(request, "DELETE", `/api/v1/users/${userId}`).catch(() => undefined);
      if (fieldId) await removeFormField(request, 1, fieldId);
      await os.dispose();
    }
  });

  test("an organization's custom field", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    let fieldId: number | undefined;
    let orgId: number | undefined;
    try {
      fieldId = await addFormField(request, 4, { label: "E2E CF Region", type: "choices", name: "e2e_cf_region", choices: "n:North\ns:South" });
      await page.goto("/orgs/new");
      await page.getByLabel(/^Name/).fill(`E2E CF Org ${stamp}`);
      await page.getByLabel("E2E CF Region").selectOption({ label: "South" });
      await page.getByRole("button", { name: "Add Organization" }).click();
      await expect(page).toHaveURL(/\/orgs\/\d+$/);
      orgId = Number(page.url().split("/").pop());
      const fields = page.getByRole("region", { name: "Custom fields" });
      await expect(fields.locator("th", { hasText: /^E2E CF Region:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("South");
      // Like a user, an organization's custom answers are in osTicket's edit dialog, not on its view page.
      const dialog = await osticketRaw(os, `ajax.php/orgs/${orgId}/edit`);
      if (dialog.status === 200) expect(dialog.body).toContain("South");
      expect(await osticketPageText(os, `orgs.php?id=${orgId}`)).toContain(`E2E CF Org ${stamp}`);

      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await expect(page.getByLabel("E2E CF Region")).toHaveValue("s");
      await page.getByLabel("E2E CF Region").selectOption({ label: "North" });
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(fields.locator("th", { hasText: /^E2E CF Region:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("North");
    } finally {
      if (orgId) await command(request, "DELETE", `/api/v1/orgs/${orgId}`).catch(() => undefined);
      if (fieldId) await removeFormField(request, 4, fieldId);
      await os.dispose();
    }
  });

  test("a task's custom field, its description, and deleting it", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    let fieldId: number | undefined;
    let taskId: number | undefined;
    try {
      fieldId = await addFormField(request, 5, { label: "E2E CF Effort", type: "text", name: "e2e_cf_effort" });
      await page.goto("/tasks/new");
      await page.getByLabel(/^Title/).fill(`[e2e] cf task ${stamp}`);
      await page.getByLabel(/^Description/).fill("Original description.");
      await page.getByLabel("E2E CF Effort").fill("3 days");
      await page.getByRole("button", { name: "Create Task" }).click();
      await expect(page).toHaveURL(/\/tasks\/\d+$/);
      taskId = Number(page.url().split("/").pop());
      const fields = page.getByRole("region", { name: "Custom fields" });
      await expect(fields.locator("th", { hasText: /^E2E CF Effort:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("3 days");
      expect(await osticketPageText(os, `tasks.php?id=${taskId}`)).toContain("3 days");

      // Edit the description and the custom field together
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(page.getByLabel("Description")).toHaveValue("Original description.");
      await expect(page.getByLabel("E2E CF Effort")).toHaveValue("3 days");
      await page.getByLabel("Description").fill("Edited description.");
      await page.getByLabel("E2E CF Effort").fill("5 days");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Task updated.")).toBeVisible();
      await expect(fields.locator("th", { hasText: /^E2E CF Effort:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("5 days");
      const ref = await osticketPageText(os, `tasks.php?id=${taskId}`);
      expect(ref).toContain("5 days");
      expect(ref).toContain("Edited description.");

      // Delete it
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete task" }).click();
      await expect(page).toHaveURL(/\/tasks$/);
      expect((await request.get(`/api/v1/tasks/${taskId}`)).status()).toBe(404);
      taskId = undefined;
    } finally {
      if (taskId) await command(request, "DELETE", `/api/v1/tasks/${taskId}`).catch(() => undefined);
      if (fieldId) await removeFormField(request, 5, fieldId);
      await os.dispose();
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("sees custom answers, and gets inputs from the form definitions every agent can read", async ({ page, request }) => {
    // Set up as the administrator: a field and a task that has an answer to it.
    const admin = await (await import("@playwright/test")).request.newContext({ baseURL: "http://localhost:3100", storageState: AUTH.admin });
    let fieldId: number | undefined;
    let ticketFieldId: number | undefined;
    let task: Awaited<ReturnType<typeof createTask>> | undefined;
    try {
      fieldId = await addFormField(admin, 5, { label: "E2E CF Visible", type: "text", name: "e2e_cf_visible" });
      task = await createTask(admin, { title: `[e2e] cf visible ${Date.now()}`, description: "Look but do not touch." });
      expect((await command(admin, "PATCH", `/api/v1/tasks/${task.id}`, { custom_fields: { e2e_cf_visible: "seen by all" } })).status).toBe("done");

      await page.goto(`/tasks/${task.id}`);
      await expect(page.getByRole("heading", { name: /Task Thread/ })).toBeVisible();
      await settled(page);
      const fields = page.getByRole("region", { name: "Custom fields" });
      await expect(fields.locator("th", { hasText: /^E2E CF Visible:$/ }).locator("xpath=following-sibling::td[1]")).toHaveText("seen by all");
      // Form definitions are open to every agent: the ticket form's custom fields have inputs for them, and a field
      // osTicket requires of agents is marked.
      const me = (await (await request.get("/api/v1/auth/me")).json()) as { roles: Record<string, string[]> };
      if ((me.roles["1"] ?? []).includes("ticket.create")) {
        ticketFieldId = await addFormField(admin, TICKET_FORM, { label: "E2E CF Agent Typed", type: "text", name: "e2e_cf_agent_typed", mode: "required" });
        await page.goto("/tickets/new");
        await expect(page.getByLabel("E2E CF Agent Typed")).toBeVisible();
        await expect(page.getByText("E2E CF Agent Typed").first().locator("xpath=..")).toContainText("*");
      }
    } finally {
      await task?.remove();
      if (fieldId) await removeFormField(admin, 5, fieldId);
      if (ticketFieldId) await removeFormField(admin, TICKET_FORM, ticketFieldId);
      await admin.dispose();
    }
  });
});
