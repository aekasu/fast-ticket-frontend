import { expect, test, type Page } from "@playwright/test";
import { command } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketDirectoryNames, osticketPageText, osticketRows } from "./osticket";

const cell = (page: Page, label: string) => page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");

/** Every row's first-cell link text, across the pages the frontend offers. */
async function listedNames(page: Page, path: string): Promise<string[]> {
  const names: string[] = [];
  for (let p = 1; p <= 20; p++) {
    await page.goto(`${path}${path.includes("?") ? "&" : "?"}page=${p}`);
    await expect(page.getByText("Loading…")).toHaveCount(0);
    await expect(page.locator("table")).toBeVisible();
    names.push(...(await page.locator("tbody tr td:first-child a").allTextContents()));
    if ((await page.getByRole("button", { name: "Next", exact: true }).count()) === 0 || (await page.getByRole("button", { name: "Next", exact: true }).isDisabled())) break;
  }
  return names;
}

test.describe("users and organizations as the admin, compared with osTicket", () => {
  test.use({ storageState: AUTH.admin });

  test("the user directory lists the same people as osTicket's", async ({ page }) => {
    const os = await osticketAdmin();
    const expected = await osticketDirectoryNames(os, "users.php");
    expect((await listedNames(page, "/users")).sort()).toEqual([...expected].sort());
    await os.dispose();
  });

  test("filtering by organization matches osTicket", async ({ page }) => {
    const os = await osticketAdmin();
    // osTicket ignores users.php?org_id=; an organization's members are listed on its own page.
    const expected = await osticketDirectoryNames(os, "orgs.php", "id=1");
    expect(expected.length).toBeGreaterThan(0);
    await page.goto("/users");
    await page.getByLabel("Organization").selectOption({ label: "osTicket" });
    await expect(page).toHaveURL(/org_id=1/);
    await expect(page.locator("tbody tr")).toHaveCount(expected.length);
    expect((await page.locator("tbody tr td:first-child a").allTextContents()).sort()).toEqual([...expected].sort());
    await os.dispose();
  });

  test("the organization list matches osTicket's", async ({ page }) => {
    const os = await osticketAdmin();
    const expected = await osticketDirectoryNames(os, "orgs.php");
    expect((await listedNames(page, "/orgs")).sort()).toEqual([...expected].sort());
    await os.dispose();
  });

  test("each user row shows osTicket's name with its ticket count, and its status", async ({ page }) => {
    const os = await osticketAdmin();
    const theirs = (await osticketRows(os, "users.php")).map((r) => ({ name: r[1].replace(/\s+/g, " ").trim(), status: r[2].trim() }));
    expect(theirs.length).toBeGreaterThan(0);
    const ours: { name: string; status: string }[] = [];
    for (let p = 1; p <= 20; p++) {
      await page.goto(`/users?page=${p}`);
      await expect(page.getByText("Loading…")).toHaveCount(0);
      for (const row of await page.locator("tbody tr").all()) {
        const cells = await row.locator("td").allInnerTexts();
        if (cells.length > 2) ours.push({ name: cells[0].replace(/\s+/g, " ").trim(), status: cells[1].trim() });
      }
      const next = page.getByRole("button", { name: "Next", exact: true });
      if ((await next.count()) === 0 || (await next.isDisabled())) break;
    }
    const key = (r: { name: string; status: string }) => `${r.name} | ${r.status}`;
    // osTicket's page shows only its first page of the list, so its rows must all be among ours (same name, count, status).
    const have = ours.map(key);
    for (const row of theirs.map(key)) {
      const at = have.indexOf(row);
      expect(at, `osTicket's row "${row}" is on our list`).toBeGreaterThanOrEqual(0);
      have.splice(at, 1);
    }
    await os.dispose();
  });

  test("searching users and sorting by name are done by the API, in the URL", async ({ page, request }) => {
    const all = (await (await request.get("/api/v1/users?page_size=100")).json()) as { items: { name: string; email: string }[] };
    const target = all.items[0];
    const word = target.email.split("@")[0].slice(0, 4);
    await page.goto("/users");
    await page.getByLabel("Search users").fill(word);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=/);
    await expect(page.locator("tbody tr td:first-child a", { hasText: target.name }).first()).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page).not.toHaveURL(/q=/);
    await page.getByRole("button", { name: /^Name/ }).click();
    await page.getByRole("button", { name: /^Name/ }).click();
    await expect(page).toHaveURL(/sort=name&dir=desc/);
    const byName = (a: string, b: string) => b.localeCompare(a, undefined, { sensitivity: "base" });
    await expect
      .poll(async () => {
        const names = await page.locator("tbody tr td:first-child a").allTextContents();
        return JSON.stringify(names) === JSON.stringify([...names].sort(byName)) && names.length > 1;
      })
      .toBe(true);
  });

  test("an organization row shows the user count osTicket shows", async ({ page }) => {
    const os = await osticketAdmin();
    const theirs = await osticketRows(os, "orgs.php");
    await page.goto("/orgs");
    await expect(page.getByText("Loading…")).toHaveCount(0);
    for (const r of theirs) {
      const row = page.locator("tbody tr", { has: page.getByRole("link", { name: r[1].trim(), exact: true }) });
      await expect(row.locator("td").nth(1)).toHaveText(r[2].trim());
    }
    await os.dispose();
  });

  test("the directory tabs link the two lists", async ({ page }) => {
    await page.goto("/users");
    await page.getByRole("link", { name: "Organizations" }).click();
    await expect(page).toHaveURL(/\/orgs$/);
    await expect(page.getByRole("link", { name: "Users", exact: true }).first()).toBeVisible();
  });

  test("a user's page shows what osTicket's shows", async ({ page, request }) => {
    const os = await osticketAdmin();
    const first = ((await (await request.get("/api/v1/users?page_size=1")).json()) as { items: { id: number; name: string; email: string }[] }).items[0];
    await page.goto(`/users/${first.id}`);
    await expect(page.getByRole("heading", { name: first.name })).toBeVisible();
    await expect(cell(page, "Email")).toHaveText(first.email);
    const theirs = await osticketPageText(os, `users.php?id=${first.id}`);
    expect(theirs).toContain(first.name);
    expect(theirs).toContain(first.email);
    await page.goto("/users/99999999");
    await expect(page.getByText("Unknown or invalid user ID.")).toBeVisible();
    await os.dispose();
  });

  test("a user's page lists their tickets", async ({ page, request }) => {
    const ticket = ((await (await request.get("/api/v1/tickets/?queue=open&page_size=1")).json()) as { items: { number: string; user_id: number }[] }).items[0];
    await page.goto(`/users/${ticket.user_id}`);
    await expect(page.getByRole("heading", { name: /^Tickets \(\d+\)$/ })).toBeVisible();
    await expect(page.locator("section", { hasText: "Tickets (" }).getByRole("link", { name: ticket.number })).toBeVisible();
  });

  test("add, update and delete a user, confirmed on osTicket's page", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const email = `e2e.user.${stamp}@example.com`;
    let id: number | undefined;
    try {
      await page.goto("/users");
      await page.getByRole("link", { name: "Add User" }).click();
      await page.getByLabel("Email Address").fill(email);
      await page.getByLabel("Full Name").fill(`E2E Person ${stamp}`);
      await page.getByLabel("Phone Number").fill("555-0100");
      await page.getByLabel("Organization").selectOption({ label: "osTicket" });
      await page.getByLabel("Internal Notes").fill("made by the e2e suite");
      await page.getByRole("button", { name: "Add User" }).click();
      await expect(page).toHaveURL(/\/users\/\d+$/);
      id = Number(page.url().split("/").pop());
      await expect(page.getByRole("heading", { name: `E2E Person ${stamp}` })).toBeVisible();
      await expect(cell(page, "Organization")).toHaveText("osTicket");
      let theirs = await osticketPageText(os, `users.php?id=${id}`);
      expect(theirs).toContain(email);
      // osTicket's user page does not show phone numbers; ours does.
      // osTicket stores phone numbers as digits.
      await expect(cell(page, "Phone")).toHaveText(/^555-?0100$/);

      // Update only the name; the rest must stay.
      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await page.getByLabel("Full Name").fill(`E2E Renamed ${stamp}`);
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(new RegExp(`/users/${id}$`));
      await expect(page.getByRole("heading", { name: `E2E Renamed ${stamp}` })).toBeVisible();
      await expect(cell(page, "Email")).toHaveText(email);
      theirs = await osticketPageText(os, `users.php?id=${id}`);
      expect(theirs).toContain(`E2E Renamed ${stamp}`);
      expect(theirs).toContain(email);

      // Saving with no change says so.
      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByText("No changes to save.")).toBeVisible();
      await page.getByRole("link", { name: "Cancel" }).click();

      // Delete it.
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete user" }).click();
      await expect(page).toHaveURL(/\/users$/);
      expect((await request.get(`/api/v1/users/${id}`)).status()).toBe(404);
      id = undefined;
    } finally {
      if (id) await command(request, "DELETE", `/api/v1/users/${id}`).catch(() => undefined);
      await os.dispose();
    }
  });

  test("osTicket's refusal of a duplicate email is shown", async ({ page, request }) => {
    const stamp = Date.now();
    const email = `e2e.dup.${stamp}@example.com`;
    const first = await command(request, "POST", "/api/v1/users", { name: "E2E Dup", email });
    expect(first.status).toBe("done");
    const id = Object.values(first.result).find((v) => typeof v === "number") as number;
    try {
      await page.goto("/users/new");
      await page.getByLabel("Email Address").fill(email);
      await page.getByLabel("Full Name").fill("E2E Dup Again");
      await page.getByRole("button", { name: "Add User" }).click();
      const alert = page.getByRole("alert").filter({ hasText: /\S/ }).first();
      await expect(alert).toBeVisible();
      await expect(page).toHaveURL(/\/users\/new$/);
      console.log(`duplicate user refusal: ${await alert.innerText()}`);
    } finally {
      await command(request, "DELETE", `/api/v1/users/${id}`).catch(() => undefined);
    }
  });

  test("an organization's page shows its details and members", async ({ page, request }) => {
    const os = await osticketAdmin();
    await page.goto("/orgs/1");
    await expect(page.getByRole("heading", { name: "osTicket", exact: true })).toBeVisible();
    const members = (await (await request.get("/api/v1/users?org_id=1&page_size=100")).json()) as { items: { name: string }[] };
    await expect(page.getByRole("heading", { name: `Users (${members.items.length})` })).toBeVisible();
    for (const m of members.items) await expect(page.getByRole("link", { name: m.name })).toBeVisible();
    expect(await osticketPageText(os, "orgs.php?id=1")).toContain("osTicket");
    await page.goto("/orgs/99999999");
    await expect(page.getByText("Unknown or invalid organization ID.")).toBeVisible();
    await os.dispose();
  });

  test("add, update and delete an organization, confirmed on osTicket's page", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    let id: number | undefined;
    try {
      await page.goto("/orgs");
      await page.getByRole("link", { name: "Add Organization" }).click();
      await page.getByLabel(/^Name/).fill(`E2E Org ${stamp}`);
      await page.getByLabel("Domain").fill(`e2e${stamp}.example.com`);
      await page.getByLabel("Phone").fill("555-0199");
      await page.getByRole("button", { name: "Add Organization" }).click();
      await expect(page).toHaveURL(/\/orgs\/\d+$/);
      id = Number(page.url().split("/").pop());
      await expect(page.getByRole("heading", { name: `E2E Org ${stamp}` })).toBeVisible();
      expect(await osticketDirectoryNames(os, "orgs.php")).toContain(`E2E Org ${stamp}`);
      expect(await osticketPageText(os, `orgs.php?id=${id}`)).toContain(`E2E Org ${stamp}`);
      await expect(cell(page, "Phone")).toHaveText(/^555-?0199$/);

      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await page.getByLabel(/^Name/).fill(`E2E Org Renamed ${stamp}`);
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(new RegExp(`/orgs/${id}$`));
      await expect(page.getByRole("heading", { name: `E2E Org Renamed ${stamp}` })).toBeVisible();
      await expect(cell(page, "Phone")).toHaveText(/^555-?0199$/);
      expect(await osticketDirectoryNames(os, "orgs.php")).toContain(`E2E Org Renamed ${stamp}`);

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete organization" }).click();
      await expect(page).toHaveURL(/\/orgs$/);
      expect(await osticketDirectoryNames(os, "orgs.php")).not.toContain(`E2E Org Renamed ${stamp}`);
      id = undefined;
    } finally {
      if (id) await command(request, "DELETE", `/api/v1/orgs/${id}`).catch(() => undefined);
      await os.dispose();
    }
  });
});

test.describe("a non-admin agent without the user directory", () => {
  test.use({ storageState: AUTH.agent });

  test("does not see Users, and the pages are not there", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { global_permissions: string[] };
    test.skip(me.global_permissions.includes("user.dir"), "this agent can browse the directory");
    await page.goto("/tickets");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Users" })).toHaveCount(0);
    for (const path of ["/users", "/users/1", "/orgs", "/orgs/1", "/users/new", "/orgs/new"]) {
      await page.goto(path);
      await expect(page.getByText("This page could not be found."), path).toBeVisible();
    }
  });
});
