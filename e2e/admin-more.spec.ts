import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { command } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketPageText, osticketRaw, osticketRows } from "./osticket";

const stamp = () => Date.now();
const idFromUrl = (page: Page) => Number(page.url().split("/").filter((p) => /^\d+$/.test(p)).pop());
const cellOf = (page: Page, label: string) => page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");
const remove = (request: APIRequestContext, path: string, id?: number) => (id ? command(request, "DELETE", `${path}/${id}`).catch(() => undefined) : undefined);
const rowsOf = async (os: APIRequestContext, p: string) => (await osticketRows(os, p)).map((c) => c.join(" | ")).join("\n");

test.describe("more Admin Panel pages as the admin, confirmed on osTicket's pages", () => {
  test.use({ storageState: AUTH.admin });

  test("an API key: add, update, delete", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ip = `10.${stamp() % 250}.${stamp() % 200}.7`;
    let id: number | undefined;
    try {
      await page.goto("/admin/apikeys/new");
      await page.getByLabel("IP Address").fill(ip);
      await page.getByLabel("Admin Notes").fill("made by e2e");
      await page.getByRole("button", { name: "Add API key" }).click();
      await expect(page).toHaveURL(/\/admin\/apikeys\/\d+$/);
      id = idFromUrl(page);
      await expect(cellOf(page, "IP Address")).toHaveText(ip);
      const key = (await cellOf(page, "API Key").innerText()).trim();
      expect(key.length).toBeGreaterThan(8);
      expect(await rowsOf(os, "apikeys.php")).toContain(ip);

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel("Key is active").uncheck();
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(cellOf(page, "Status")).toHaveText("Disabled");

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete API key" }).click();
      await expect(page).toHaveURL(/\/admin\/apikeys$/);
      expect(await rowsOf(os, "apikeys.php")).not.toContain(ip);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/api-keys", id);
      await os.dispose();
    }
  });

  test("a site page: add, update, delete; the default pages cannot be deleted", async ({ page, request }) => {
    const os = await osticketAdmin();
    const name = `E2E Page ${stamp()}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/pages/new");
      await page.getByLabel("Name", { exact: true }).fill(name);
      await page.getByLabel("Type", { exact: true }).selectOption("other");
      await page.getByLabel("Body").fill("<p>e2e body</p>");
      await page.getByRole("button", { name: "Add Page" }).click();
      await expect(page).toHaveURL(/\/admin\/pages\/\d+$/);
      id = idFromUrl(page);
      expect(await rowsOf(os, "pages.php")).toContain(name);

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel("Admin Notes").fill("noted");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(cellOf(page, "Notes")).toHaveText("noted");

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete page" }).click();
      await expect(page).toHaveURL(/\/admin\/pages$/);
      expect(await rowsOf(os, "pages.php")).not.toContain(name);
      id = undefined;

      // A page in use has no Delete button.
      await page.goto("/admin/pages");
      const inUse = (await (await request.get("/api/v1/pages?page_size=100")).json()) as { items: { id: number; in_use: boolean }[] };
      const used = inUse.items.find((p) => p.in_use);
      if (used) {
        await page.goto(`/admin/pages/${used.id}`);
        await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
      }
    } finally {
      await remove(request, "/api/v1/pages", id);
      await os.dispose();
    }
  });

  test("an email address: add, update, delete", async ({ page, request }) => {
    const os = await osticketAdmin();
    const email = `e2e-${stamp()}@example.com`;
    let id: number | undefined;
    try {
      await page.goto("/admin/emails/new");
      await page.getByLabel("Email Address").fill(email);
      await page.getByLabel("Email Name").fill("E2E Mailbox");
      await page.getByRole("button", { name: "Add Email address" }).click();
      await expect(page).toHaveURL(/\/admin\/emails\/\d+$/);
      id = idFromUrl(page);
      expect(await rowsOf(os, "emails.php")).toContain(email);

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel("Email Name").fill("E2E Mailbox Renamed");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(cellOf(page, "Name")).toHaveText("E2E Mailbox Renamed");

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete email address" }).click();
      await expect(page).toHaveURL(/\/admin\/emails$/);
      expect(await rowsOf(os, "emails.php")).not.toContain(email);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/emails", id);
      await os.dispose();
    }
  });

  test("a custom list with items: add the list, add and disable an item, delete both", async ({ page, request }) => {
    const os = await osticketAdmin();
    const name = `E2E List ${stamp()}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/lists/new");
      await page.getByLabel("Name", { exact: true }).fill(name);
      await page.getByLabel("Plural Name").fill(`${name}s`);
      await page.getByRole("button", { name: "Add List" }).click();
      await expect(page).toHaveURL(/\/admin\/lists\/\d+$/);
      id = idFromUrl(page);
      expect(await rowsOf(os, "lists.php")).toContain(name);
      await expect(page.getByText("This list has no items.")).toBeVisible();

      await page.getByLabel("Item value").fill("Alpha");
      await page.getByLabel("Abbreviation").fill("A");
      await page.getByRole("button", { name: "Add Item" }).click();
      await expect(page.getByText("Alpha added.")).toBeVisible();
      await expect(page.getByRole("cell", { name: "Alpha", exact: true })).toBeVisible();
      await page.getByLabel("Alpha is enabled").click();
      await expect(page.getByText("Alpha disabled.")).toBeVisible();
      const items = (await (await request.get(`/api/v1/lists/${id}/items`)).json()) as { items: { value: string; is_enabled: boolean }[] };
      expect(items.items.find((i) => i.value === "Alpha")?.is_enabled).toBe(false);

      await page.getByRole("button", { name: "Remove Alpha" }).click();
      await expect(page.getByText("Alpha removed.")).toBeVisible();
      await expect(page.getByText("This list has no items.")).toBeVisible();

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete list" }).click();
      await expect(page).toHaveURL(/\/admin\/lists$/);
      expect(await rowsOf(os, "lists.php")).not.toContain(name);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/lists", id);
      await os.dispose();
    }
  });

  test("system logs, system information and plugins show what osTicket shows", async ({ page }) => {
    const os = await osticketAdmin();
    await page.goto("/admin/logs");
    await expect(page.getByRole("heading", { name: "System Logs" })).toBeVisible();
    await expect(page.getByLabel("Log type")).toBeVisible();
    await expect(page.getByText("entries", { exact: false }).first()).toBeVisible();
    const first = page.locator("tbody tr td:nth-child(2) button").first();
    if (await first.count()) {
      const title = (await first.innerText()).trim();
      expect(await rowsOf(os, "logs.php")).toContain(title.slice(0, 20));
      await first.click();
      await expect(page.locator("tbody pre")).toBeVisible();
    }

    await page.goto("/admin/system");
    await expect(page.getByRole("heading", { name: "System Information" })).toBeVisible();
    const version = (await cellOf(page, "osTicket Version").innerText()).trim();
    expect(await osticketPageText(os, "system.php")).toContain(version);

    await page.goto("/admin/plugins");
    await expect(page.getByRole("heading", { name: "Plugins" })).toBeVisible();
    for (const name of await page.locator("tbody tr td:first-child").allTextContents()) {
      if (name.trim() && !/No plugins/.test(name)) expect(await osticketPageText(os, "plugins.php")).toContain(name.trim());
    }
    await os.dispose();
  });

  test("settings: a change is saved and shows on osTicket's page, and osTicket's refusal is shown as worded", async ({ page, request }) => {
    const os = await osticketAdmin();
    const before = (await (await request.get("/api/v1/settings/system")).json()) as { helpdesk_title: string };
    const title = `E2E Desk ${stamp()}`;
    try {
      await page.goto("/admin/settings-system");
      const form = page.getByRole("form", { name: "System settings" });
      await form.getByLabel("Helpdesk title").fill(title);
      await form.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByText("Successfully updated settings.")).toBeVisible();
      expect((await osticketRaw(os, "settings.php?t=system")).body).toContain(`value="${title}"`);

      await page.goto("/admin/settings-tickets");
      const tickets = page.getByRole("form", { name: "Tickets settings" });
      const original = await tickets.getByLabel("Ticket number format").inputValue();
      await tickets.getByLabel("Ticket number format").fill("no-hash-here");
      await tickets.getByRole("button", { name: "Save Changes" }).click();
      await expect(tickets.getByRole("alert")).toContainText("hash");
      // A refused save changes nothing.
      expect(((await (await request.get("/api/v1/settings/tickets")).json()) as { ticket_number_format: string }).ticket_number_format).toBe(original);
    } finally {
      await command(request, "PATCH", "/api/v1/settings/system", { helpdesk_title: before.helpdesk_title }).catch(() => undefined);
      await os.dispose();
    }
  });

  test("settings: select-like keys are drop-downs with osTicket's own choices, and a choice is saved", async ({ page, request }) => {
    const os = await osticketAdmin();
    const before = (await (await request.get("/api/v1/settings/users")).json()) as { client_registration: string };
    try {
      await page.goto("/admin/settings-users");
      const form = page.getByRole("form", { name: "Users settings" });
      const select = form.getByLabel("Client registration");
      await expect(select).toHaveJSProperty("tagName", "SELECT");
      const osPage = await osticketPageText(os, "settings.php?t=users");
      const labels = await select.locator("option").allTextContents();
      expect(labels.length).toBeGreaterThan(1);
      for (const label of labels) expect(osPage).toContain(label.trim());

      const other = before.client_registration === "disabled" ? "public" : "disabled";
      await select.selectOption(other);
      await form.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByText("Successfully updated settings.")).toBeVisible();
      expect(((await (await request.get("/api/v1/settings/users")).json()) as { client_registration: string }).client_registration).toBe(other);
    } finally {
      await command(request, "PATCH", "/api/v1/settings/users", { client_registration: before.client_registration }).catch(() => undefined);
      await os.dispose();
    }
  });

  test("a schedule with an entry, and an email template set with an edited message", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp1 = stamp();
    const sched = `E2E Schedule ${stamp1}`;
    const set = `E2E Templates ${stamp1}`;
    let schedId: number | undefined;
    let setId: number | undefined;
    try {
      await page.goto("/admin/schedules/new");
      await page.getByLabel("Name", { exact: true }).fill(sched);
      await page.getByLabel("Type", { exact: true }).selectOption("holidays");
      await page.getByRole("button", { name: "Add Schedule" }).click();
      await expect(page).toHaveURL(/\/admin\/schedules\/\d+$/);
      schedId = idFromUrl(page);
      expect(await rowsOf(os, "schedules.php")).toContain(sched);

      const entry = page.getByRole("form", { name: "Add entry" });
      await entry.getByLabel("Entry name").fill("E2E Holiday");
      await entry.getByLabel("Starts on").fill("2027-12-24");
      await entry.getByRole("button", { name: "Add Entry" }).click();
      await expect(page.getByText("E2E Holiday added.")).toBeVisible();
      await expect(page.getByRole("list", { name: "Schedule entries" })).toContainText("E2E Holiday");
      await page.getByRole("button", { name: "Remove E2E Holiday" }).click();
      await expect(page.getByText("This schedule has no entries.")).toBeVisible();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete schedule" }).click();
      await expect(page).toHaveURL(/\/admin\/schedules$/);
      expect(await rowsOf(os, "schedules.php")).not.toContain(sched);
      schedId = undefined;

      await page.goto("/admin/templates/new");
      await page.getByLabel("Name", { exact: true }).fill(set);
      await page.getByRole("button", { name: "Add Template set" }).click();
      await expect(page).toHaveURL(/\/admin\/templates\/\d+$/);
      setId = idFromUrl(page);
      expect(await rowsOf(os, "templates.php")).toContain(set);
      const list = page.getByRole("list", { name: "Template messages" });
      await expect(list.locator("li")).toHaveCount(19);
      await list.locator("li").first().getByRole("button", { name: /^Edit / }).click();
      const form = list.locator("form");
      await form.getByLabel("Subject").fill("E2E subject");
      await form.getByLabel("Body").fill("E2E body %{ticket.number}");
      await form.getByRole("button", { name: "Save Message" }).click();
      await expect(page.getByText("Message saved.")).toBeVisible();
      await expect(list.locator("li").first()).toContainText("E2E subject");

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete template set" }).click();
      await expect(page).toHaveURL(/\/admin\/templates$/);
      expect(await rowsOf(os, "templates.php")).not.toContain(set);
      setId = undefined;
    } finally {
      await remove(request, "/api/v1/schedules", schedId);
      await remove(request, "/api/v1/email-templates", setId);
      await os.dispose();
    }
  });

  test("a ticket filter: add with a rule and an action, change its rules, delete", async ({ page, request }) => {
    const os = await osticketAdmin();
    const name = `E2E Filter ${String(stamp()).slice(-8)}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/filters/new");
      await page.getByLabel("Filter Name").fill(name);
      const rule = page.getByRole("group", { name: "Rule 1" });
      await rule.getByLabel("Rule value").fill("e2e-filter-test");
      await page.getByRole("button", { name: "Add Action" }).click();
      const action = page.getByRole("group", { name: "Action 1" });
      await action.getByLabel("Action type").selectOption("dept");
      await action.getByLabel("Department", { exact: true }).selectOption({ index: 1 });
      await page.getByRole("button", { name: "Add Filter" }).click();
      await expect(page).toHaveURL(/\/admin\/filters\/\d+$/);
      id = idFromUrl(page);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      expect(await rowsOf(os, "filters.php")).toContain(name);

      const editor = page.getByRole("region", { name: "Rules and actions" });
      await expect(editor.getByLabel("Rule value")).toHaveValue("e2e-filter-test");
      await editor.getByLabel("Rule value").fill("changed-value");
      await editor.getByRole("button", { name: "Save Rules and Actions" }).click();
      await expect(page.getByText("Rules and actions saved.")).toBeVisible();
      const detail = (await (await request.get(`/api/v1/filters/${id}`)).json()) as { rules: { val: string }[]; actions: { type: string }[] };
      expect(detail.rules.map((r) => r.val)).toEqual(["changed-value"]);
      expect(detail.actions.map((a) => a.type)).toEqual(["dept"]);

      // osTicket needs at least one rule: its refusal is shown.
      await editor.getByRole("button", { name: "Remove rule 1" }).click();
      await editor.getByRole("button", { name: "Save Rules and Actions" }).click();
      await expect(editor.getByRole("alert")).toBeVisible();

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete filter" }).click();
      await expect(page).toHaveURL(/\/admin\/filters$/);
      expect(await rowsOf(os, "filters.php")).not.toContain(name);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/filters", id);
      await os.dispose();
    }
  });
});
