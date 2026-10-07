import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { command } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketRaw, osticketRows } from "./osticket";

const stamp = () => Date.now();
const idFromUrl = (page: Page) => Number(page.url().split("/").filter((p) => /^\d+$/.test(p)).pop());
const cellOf = (page: Page, label: string) => page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");
const remove = (request: APIRequestContext, path: string, id?: number) => (id ? command(request, "DELETE", `${path}/${id}`).catch(() => undefined) : undefined);

/** osTicket's list rows as one searchable string each. */
async function osticketList(os: APIRequestContext, page: string) {
  return (await osticketRows(os, page)).map((cells) => cells.join(" | "));
}

test.describe("Admin Panel as the admin", () => {
  test.use({ storageState: AUTH.admin });

  test("the landing page shows osTicket's five groups, with unavailable pages dimmed", async ({ page }) => {
    await page.goto("/admin");
    for (const group of ["Dashboard", "Settings", "Manage", "Emails", "Agents"]) {
      await expect(page.getByRole("heading", { name: group, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Help Topics" }).first()).toBeVisible();
    // A page with no endpoint behind it says so.
    await page.goto("/admin/emailtest");
    await expect(page.getByRole("heading", { name: "Diagnostic" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("no endpoint in the API");
    await page.goto("/admin/no-such-page");
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  });

  test("each list shows the same entries as osTicket's admin page", async ({ page, request }) => {
    const os = await osticketAdmin();
    const lists: { slug: string; osPage: string; nameKey: (i: Record<string, string>) => string }[] = [
      { slug: "staff", osPage: "staff.php", nameKey: (i) => `${i.firstname} ${i.lastname}` },
      { slug: "departments", osPage: "departments.php", nameKey: (i) => i.name },
      { slug: "teams", osPage: "teams.php", nameKey: (i) => i.name },
      { slug: "topics", osPage: "helptopics.php", nameKey: (i) => i.path || i.topic },
      { slug: "slas", osPage: "slas.php", nameKey: (i) => i.name },
      { slug: "banlist", osPage: "banlist.php", nameKey: (i) => i.val },
    ];
    for (const l of lists) {
      const api = ((await (await request.get(`/api/v1/${l.slug}?page_size=100`)).json()) as { items: Record<string, string>[] }).items;
      const theirs = await osticketList(os, l.osPage);
      expect(theirs.length, `${l.slug}: number of rows`).toBe(api.length);
      for (const item of api) expect(theirs.join("\n"), `${l.slug}: ${l.nameKey(item)}`).toContain(l.nameKey(item));

      await page.goto(`/admin/${l.slug}`);
      await expect(page.locator("tbody tr").first()).toBeVisible();
      await expect(page.getByText("Loading…")).toHaveCount(0);
      const shown = await page.locator("tbody tr td:first-child").allTextContents();
      expect(shown.map((t) => t.trim()).sort(), l.slug).toEqual(api.map((i) => l.nameKey(i)).sort());
    }
    await os.dispose();
  });

  test("the roles list matches osTicket's", async ({ page, request }) => {
    const os = await osticketAdmin();
    const api = ((await (await request.get("/api/v1/roles?page_size=100")).json()) as { items: { name: string; enabled: boolean }[] }).items;
    const theirs = (await osticketRows(os, "roles.php")).map((cells) => cells.join(" | "));
    expect(theirs.length).toBe(api.length);
    for (const r of api) expect(theirs.join("\n"), r.name).toContain(r.name);
    await page.goto("/admin/roles");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    const shown = await page.locator("tbody tr td:first-child").allTextContents();
    expect(shown.map((t) => t.trim()).sort()).toEqual(api.map((r) => r.name).sort());
    await os.dispose();
  });

  test("the team list shows osTicket's Members count and Team Lead", async ({ page }) => {
    const os = await osticketAdmin();
    const theirs = await osticketRows(os, "teams.php");
    await page.goto("/admin/teams");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    const headers = (await page.locator("thead th").allTextContents()).map((h) => h.trim());
    const members = headers.indexOf("Members");
    expect(members).toBeGreaterThan(-1);
    const shown = await page.locator("tbody tr").evaluateAll((rows, idx) => rows.map((r) => [(r.querySelectorAll("td")[0].textContent ?? "").trim(), (r.querySelectorAll("td")[idx].textContent ?? "").trim()]), members);
    for (const [name, count] of shown) {
      const row = theirs.find((cells) => cells.includes(name));
      expect(row, name).toBeTruthy();
      expect(row!.join("|"), `${name} members`).toContain(count);
    }
    await os.dispose();
  });

  test("a role is added, updated and deleted, and osTicket lists it; an empty permission set is refused", async ({ page, request }) => {
    const os = await osticketAdmin();
    const name = `E2E Role ${stamp()}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/roles/new");
      await page.getByLabel("Name", { exact: true }).fill(name);
      await page.getByRole("button", { name: "Add Role" }).click();
      // osTicket needs at least one permission: its refusal is shown as worded.
      await expect(page.getByRole("alert")).toBeVisible();
      await page.getByRole("group", { name: "Permissions" }).getByLabel("create", { exact: true }).first().check();
      await page.getByRole("button", { name: "Add Role" }).click();
      await expect(page).toHaveURL(/\/admin\/roles\/\d+$/);
      id = idFromUrl(page);
      await expect(page.getByRole("heading", { name })).toBeVisible();
      expect((await osticketList(os, "roles.php")).join("\n")).toContain(name);

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel("Admin Notes").fill("changed by e2e");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/roles/${id}$`));
      await expect(cellOf(page, "Notes")).toHaveText("changed by e2e");

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete role" }).click();
      await expect(page).toHaveURL(/\/admin\/roles$/);
      expect((await osticketList(os, "roles.php")).join("\n")).not.toContain(name);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/roles", id);
      await os.dispose();
    }
  });

  test("an unknown id says so", async ({ page }) => {
    await page.goto("/admin/staff/99999999");
    await expect(page.getByText("Unknown or invalid agent ID.")).toBeVisible();
  });

  test("banlist: add, update and delete, confirmed on osTicket's page", async ({ page, request }) => {
    const os = await osticketAdmin();
    const val = `e2e-ban-${stamp()}@example.com`;
    let id: number | undefined;
    try {
      await page.goto("/admin/banlist");
      await page.getByRole("link", { name: "Add New Ban rule" }).click();
      await page.getByLabel("Email Address").fill(val);
      await page.getByLabel("Admin Notes").fill("e2e");
      await page.getByRole("button", { name: "Add Ban rule" }).click();
      await expect(page).toHaveURL(/\/admin\/banlist\/\d+$/);
      id = idFromUrl(page);
      expect((await osticketList(os, "banlist.php")).join("\n")).toContain(val);

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel("Rule is active").uncheck();
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/banlist/${id}$`));
      await expect(cellOf(page, "Status")).toHaveText("Disabled");
      const row = (await osticketList(os, "banlist.php")).find((r) => r.includes(val));
      expect(row).toMatch(/Disabled/i);

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete ban rule" }).click();
      await expect(page).toHaveURL(/\/admin\/banlist$/);
      expect((await osticketList(os, "banlist.php")).join("\n")).not.toContain(val);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/banlist", id);
      await os.dispose();
    }
  });

  test("SLA plan: add, update and delete, confirmed on osTicket's page", async ({ page, request }) => {
    const os = await osticketAdmin();
    const name = `E2E SLA ${stamp()}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/slas");
      await page.getByRole("link", { name: "Add New SLA plan" }).click();
      await page.getByLabel(/^Name/).fill(name);
      await page.getByLabel(/^Grace Period/).fill("7");
      await page.getByRole("button", { name: "Add SLA plan" }).click();
      await expect(page).toHaveURL(/\/admin\/slas\/\d+$/);
      id = idFromUrl(page);
      let row = (await osticketList(os, "slas.php")).find((r) => r.includes(name));
      expect(row).toContain("7");

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel(/^Grace Period/).fill("9");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(cellOf(page, "Grace Period \\(hrs\\)")).toHaveText("9");
      row = (await osticketList(os, "slas.php")).find((r) => r.includes(name));
      expect(row).toContain("9");

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete SLA plan" }).click();
      await expect(page).toHaveURL(/\/admin\/slas$/);
      expect((await osticketList(os, "slas.php")).join("\n")).not.toContain(name);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/slas", id);
      await os.dispose();
    }
  });

  test("department: add, update and delete, confirmed on osTicket's page", async ({ page, request }) => {
    const os = await osticketAdmin();
    const name = `E2E Dept ${stamp()}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/departments");
      await page.getByRole("link", { name: "Add New Department" }).click();
      await page.getByLabel(/^Name/).fill(name);
      await page.getByLabel("Department Signature").fill("E2E signature");
      await page.getByRole("button", { name: "Add Department" }).click();
      await expect(page).toHaveURL(/\/admin\/departments\/\d+$/);
      id = idFromUrl(page);
      let row = (await osticketList(os, "departments.php")).find((r) => r.includes(name));
      expect(row).toMatch(/Public/);

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel("Public department").uncheck();
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(cellOf(page, "Type")).toHaveText("Private");
      row = (await osticketList(os, "departments.php")).find((r) => r.includes(name));
      expect(row).toMatch(/Private/);

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete department" }).click();
      await expect(page).toHaveURL(/\/admin\/departments$/);
      expect((await osticketList(os, "departments.php")).join("\n")).not.toContain(name);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/departments", id);
      await os.dispose();
    }
  });

  test("team: add, update and delete, confirmed on osTicket's page", async ({ page, request }) => {
    const os = await osticketAdmin();
    const name = `E2E Team ${stamp()}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/teams");
      await page.getByRole("link", { name: "Add New Team" }).click();
      await page.getByLabel(/^Team Name/).fill(name);
      await page.getByRole("button", { name: "Add Team" }).click();
      await expect(page).toHaveURL(/\/admin\/teams\/\d+$/);
      id = idFromUrl(page);
      let row = (await osticketList(os, "teams.php")).find((r) => r.includes(name));
      expect(row).toMatch(/Active/);

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel("Team is enabled").uncheck();
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(cellOf(page, "Status")).toHaveText("Disabled");
      row = (await osticketList(os, "teams.php")).find((r) => r.includes(name));
      expect(row).toMatch(/Disabled/i);

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete team" }).click();
      await expect(page).toHaveURL(/\/admin\/teams$/);
      expect((await osticketList(os, "teams.php")).join("\n")).not.toContain(name);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/teams", id);
      await os.dispose();
    }
  });

  test("help topic: add, update and delete, confirmed on osTicket's page", async ({ page, request }) => {
    const os = await osticketAdmin();
    const name = `E2E Topic ${stamp()}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/topics");
      await page.getByRole("link", { name: "Add New Help topic" }).click();
      await page.getByLabel(/^Help Topic/).fill(name);
      await page.getByLabel("Priority").selectOption({ label: "High" });
      await page.getByLabel("Department", { exact: true }).selectOption({ label: "Sales" });
      await page.getByRole("button", { name: "Add Help topic" }).click();
      await expect(page).toHaveURL(/\/admin\/topics\/\d+$/);
      id = idFromUrl(page);
      await expect(cellOf(page, "Priority")).toHaveText("High");
      await expect(cellOf(page, "Department")).toHaveText("Sales");
      let row = (await osticketList(os, "helptopics.php")).find((r) => r.includes(name));
      expect(row).toMatch(/High/);
      expect(row).toMatch(/Sales/);
      expect(row).toMatch(/Public/);

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel("Public topic").uncheck();
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(cellOf(page, "Type")).toHaveText("Private");
      row = (await osticketList(os, "helptopics.php")).find((r) => r.includes(name));
      expect(row).toMatch(/Private/);

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete help topic" }).click();
      await expect(page).toHaveURL(/\/admin\/topics$/);
      expect((await osticketList(os, "helptopics.php")).join("\n")).not.toContain(name);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/topics", id);
      await os.dispose();
    }
  });

  test("agent: add, update and delete, confirmed on osTicket's page", async ({ page, request }) => {
    const os = await osticketAdmin();
    const s = stamp();
    const username = `e2e-agent-${s}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/staff");
      await page.getByRole("link", { name: "Add New Agent" }).click();
      await page.getByLabel(/^Username/).fill(username);
      await page.getByLabel(/^First Name/).fill("E2E");
      await page.getByLabel(/^Last Name/).fill(`Agent${s}`);
      await page.getByLabel(/^Email Address/).fill(`${username}@example.com`);
      await page.getByLabel(/^Password/).fill(`Pw-${s}-Aa1!`);
      await page.getByLabel(/^Primary Department/).selectOption({ label: "Support" });
      await page.getByLabel(/^Primary Role/).selectOption("3");
      await page.getByRole("button", { name: "Add Agent" }).click();
      await expect(page).toHaveURL(/\/admin\/staff\/\d+$/);
      id = idFromUrl(page);
      await expect(cellOf(page, "Username")).toHaveText(username);
      let row = (await osticketList(os, "staff.php")).find((r) => r.includes(username));
      expect(row).toMatch(/Active/);
      expect(row).toContain("Support");

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel("Account is active").uncheck();
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(cellOf(page, "Status")).toHaveText("Disabled");
      row = (await osticketList(os, "staff.php")).find((r) => r.includes(username));
      expect(row).not.toMatch(/Active/);

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete agent" }).click();
      await expect(page).toHaveURL(/\/admin\/staff$/);
      expect((await osticketList(os, "staff.php")).join("\n")).not.toContain(username);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/staff", id);
      await os.dispose();
    }
  });

  test("priority: add, update and delete (the API manages them; osTicket has no list page)", async ({ page, request }) => {
    const name = `e2e-prio-${stamp()}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/priorities");
      await page.getByRole("link", { name: "Add New Priority" }).click();
      await page.getByLabel(/^Name/).fill(name);
      await page.getByLabel("Description").fill("E2E Priority");
      await page.getByLabel("Urgency").fill("7");
      await page.getByRole("button", { name: "Add Priority" }).click();
      await expect(page).toHaveURL(/\/admin\/priorities\/\d+$/);
      id = idFromUrl(page);
      await expect(cellOf(page, "Urgency")).toHaveText("7");

      await page.getByRole("link", { name: "Update" }).click();
      await page.getByLabel("Urgency").fill("8");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(cellOf(page, "Urgency")).toHaveText("8");

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete priority" }).click();
      await expect(page).toHaveURL(/\/admin\/priorities$/);
      expect((await request.get(`/api/v1/priorities/${id}`)).status()).toBe(404);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/priorities", id);
    }
  });

  test("forms: the core forms list their fields, with the locked ones protected", async ({ page, request }) => {
    const forms = ((await (await request.get("/api/v1/forms")).json()) as { items: { id: number; title: string }[] }).items;
    await page.goto("/admin/forms");
    await expect(page.locator("tbody tr")).toHaveCount(forms.length);
    const ticketForm = forms.find((f) => f.title === "Ticket Details")!;
    await page.goto(`/admin/forms/${ticketForm.id}`);
    await expect(page.getByRole("heading", { name: /^Fields \(\d+\)$/ })).toBeVisible();
    const fields = page.getByRole("region", { name: "Form fields" });
        // The core form's own fields cannot be removed, and the form itself cannot be deleted here.
    await expect(fields.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toHaveCount(0);
  });

  test("a custom form: create it, add, edit and remove a field, delete it, as osTicket lists it", async ({ page, request }) => {
    const os = await osticketAdmin();
    const title = `E2E Form ${stamp()}`;
    let id: number | undefined;
    try {
      await page.goto("/admin/forms");
      await page.getByRole("link", { name: "Add New Form" }).click();
      await page.getByLabel(/^Title/).fill(title);
      await page.getByLabel("Instructions").fill("Made by the e2e suite.");
      await page.getByRole("button", { name: "Add Form" }).click();
      await expect(page).toHaveURL(/\/admin\/forms\/\d+$/);
      id = idFromUrl(page);
      expect((await osticketList(os, "forms.php")).join("\n")).toContain(title);
      await expect(page.getByText("This form has no fields yet.")).toBeVisible();

      // Add a selection list
      await page.getByRole("button", { name: "Add Field" }).first().click();
      await page.getByLabel("Label").fill("E2E Size");
      await page.getByLabel("Variable").fill("e2e_cf_size");
      await page.getByLabel("Type").selectOption({ label: "Selection List" });
      await page.getByLabel("Choices").fill("s:Small\nl:Large");
      await page.getByRole("button", { name: "Add Field" }).last().click();
      await expect(page.getByText('Field "E2E Size" added.')).toBeVisible();
      const row = page.locator("tbody tr", { hasText: "e2e_cf_size" });
      await expect(row).toContainText("Selection List");
      await expect(row).toContainText("Optional");
      // osTicket's form builder keeps a field's label and variable in inputs.
      const ref = (await osticketRaw(os, `forms.php?id=${id}`)).body;
      expect(ref).toContain('value="E2E Size"');
      expect(ref).toContain("e2e_cf_size");

      // Edit: make it required and rename it
      await page.getByRole("button", { name: "Edit E2E Size" }).click();
      await page.getByLabel("Label").fill("E2E Shirt Size");
      await page.getByLabel("Visibility").selectOption({ label: "Required" });
      await page.getByRole("button", { name: "Save Field" }).click();
      await expect(page.getByText('Field "E2E Shirt Size" updated.')).toBeVisible();
      await expect(page.locator("tbody tr", { hasText: "e2e_cf_size" })).toContainText("Required");
      expect((await osticketRaw(os, `forms.php?id=${id}`)).body).toContain('value="E2E Shirt Size"');

      // Remove the field
      await page.getByRole("button", { name: "Remove E2E Shirt Size" }).click();
      await page.getByRole("button", { name: "Remove field" }).click();
      await expect(page.getByText('Field "E2E Shirt Size" removed.')).toBeVisible();
      await expect(page.getByText("This form has no fields yet.")).toBeVisible();

      // Delete the form
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete form" }).click();
      await expect(page).toHaveURL(/\/admin\/forms$/);
      expect((await osticketList(os, "forms.php")).join("\n")).not.toContain(title);
      id = undefined;
    } finally {
      await remove(request, "/api/v1/forms", id);
      await os.dispose();
    }
  });

  test("a field added in the Admin Panel appears on the New Ticket form, and goes when removed", async ({ page, request }) => {
    const ticketForm = ((await (await request.get("/api/v1/forms")).json()) as { items: { id: number; type: string }[] }).items.find((f) => f.type === "T")!;
    let fieldId: number | undefined;
    try {
      await page.goto(`/admin/forms/${ticketForm.id}`);
      await page.getByRole("button", { name: "Add Field" }).first().click();
      await page.getByLabel("Label").fill("E2E Admin Added");
      await page.getByLabel("Variable").fill("e2e_cf_admin_added");
      await page.getByRole("button", { name: "Add Field" }).last().click();
      await expect(page.getByText('Field "E2E Admin Added" added.')).toBeVisible();

      await page.goto("/tickets/new");
      await expect(page.getByLabel("E2E Admin Added")).toBeVisible();

      const detail = (await (await request.get(`/api/v1/forms/${ticketForm.id}`)).json()) as { fields: { id: number; name: string }[] };
      fieldId = detail.fields.find((f) => f.name === "e2e_cf_admin_added")?.id;
      await page.goto(`/admin/forms/${ticketForm.id}`);
      await page.getByRole("button", { name: "Remove E2E Admin Added" }).click();
      await page.getByRole("button", { name: "Remove field" }).click();
      await expect(page.getByText('Field "E2E Admin Added" removed.')).toBeVisible();
      fieldId = undefined;

      await page.goto("/tickets/new");
      await expect(page.getByLabel("Issue Details")).toBeVisible();
      await expect(page.getByLabel("E2E Admin Added")).toHaveCount(0);
    } finally {
      if (fieldId) await command(request, "DELETE", `/api/v1/forms/${ticketForm.id}/fields/${fieldId}?delete_data=true`).catch(() => undefined);
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("has no Admin Panel", async ({ page }) => {
    await page.goto("/tickets");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin Panel" })).toHaveCount(0);
    for (const path of ["/admin", "/admin/staff", "/admin/staff/1", "/admin/topics/new", "/admin/roles"]) {
      await page.goto(path);
      await expect(page.getByText("This page could not be found."), path).toBeVisible();
    }
  });
});
