import { expect, test, type Page } from "@playwright/test";
import { command, settled } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketKb, osticketPageText, osticketRows } from "./osticket";

const idFromUrl = (page: Page) => Number(page.url().split(/[/?=]/).filter((p) => /^\d+$/.test(p)).pop());

test.describe("knowledge base as the admin, compared with osTicket", () => {
  test.use({ storageState: AUTH.admin });

  test("categories list the same names, types and FAQ counts", async ({ page }) => {
    const os = await osticketAdmin();
    const ref = (await osticketRows(os, "categories.php")).filter((r) => r.length >= 4).map((r) => [r[1], r[2], r[3]]);
    expect(ref.length).toBeGreaterThan(0);
    await page.goto("/kb/categories");
    await expect(page.getByText("Loading…")).toHaveCount(0);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(page.locator("tbody tr td:nth-child(3):has-text('…')")).toHaveCount(0);
    const shown = await page.locator("tbody tr").evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll("td")].slice(0, 3).map((c) => c.textContent?.trim() ?? "")));
    expect([...shown].sort()).toEqual([...ref].sort());
    await os.dispose();
  });

  test("the FAQ home lists categories with osTicket's counts, and a category lists its FAQs", async ({ page, request }) => {
    const os = await osticketAdmin();
    const home = await osticketKb(os);
    await page.goto("/kb");
    const sidebar = page.getByRole("navigation", { name: "Categories" });
    await expect(sidebar).toContainText("All Categories (");
    for (const entry of home.categories) await expect(sidebar, entry).toContainText(entry);

    const cats = (await (await request.get("/api/v1/kb/categories")).json()) as { items: { id: number; name: string }[] };
    for (const c of cats.items) {
      const ref = await osticketKb(os, c.id);
      await page.goto(`/kb?cid=${c.id}`);
      await expect(page.getByRole("heading", { name: c.name })).toBeVisible();
      const shown = await page.locator("main li a[href^='/kb/faqs/']").allTextContents();
      expect([...shown].sort(), `FAQs of ${c.name}`).toEqual([...ref.faqs].sort());
    }
    await os.dispose();
  });

  test("searching the FAQs finds what osTicket's search finds", async ({ page }) => {
    const os = await osticketAdmin();
    const html = await (await os.get("kb.php?a=search&q=password")).text();
    const theirs = [...html.matchAll(/<a[^>]*href="faq\.php\?id=\d+[^"]*"[^>]*>([\s\S]*?)<\/a>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/\s+-\s+(Published|Internal)$/, "").trim())
      .filter(Boolean);
    expect(theirs.length).toBeGreaterThan(0);
    await page.goto("/kb");
    await page.getByLabel("Search FAQs").fill("password");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=password/);
    await expect(page.getByRole("heading", { name: /Search results/ })).toBeVisible();
    await expect(page.locator("main li a[href^='/kb/faqs/']").first()).toBeVisible();
    const shown = await page.locator("main li a[href^='/kb/faqs/']").allTextContents();
    expect([...new Set(shown)].sort()).toEqual([...new Set(theirs)].sort());
    await page.goto("/kb?q=zzzznomatchzzzz");
    await expect(page.getByText("No FAQs match your search.")).toBeVisible();
    await os.dispose();
  });

  test("a FAQ page shows the sanitised answer, like osTicket", async ({ page, request }) => {
    const os = await osticketAdmin();
    const list = (await (await request.get("/api/v1/kb/faqs?page_size=50")).json()) as { items: { id: number; question: string; is_published: boolean }[] };
    const faq = list.items.find((f) => f.question.includes("reset my password"));
    test.skip(!faq, "seed the KB first: npm run seed:dev");
    await page.goto(`/kb/faqs/${faq!.id}`);
    await expect(page.getByRole("heading", { name: faq!.question })).toBeVisible();
    await expect(page.getByText("Published", { exact: false }).first()).toBeVisible();
    await expect(page.locator("b", { hasText: "Forgot my password" })).toBeVisible();
    expect(await osticketPageText(os, `faq.php?id=${faq!.id}`)).toContain("Forgot my password");
    await page.goto("/kb/faqs/99999999");
    await expect(page.getByText("Unknown or invalid FAQ ID.")).toBeVisible();
    await os.dispose();
  });

  test("category, FAQ: add, update and delete, confirmed on osTicket's pages", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    let categoryId: number | undefined;
    let faqId: number | undefined;
    try {
      // Category
      await page.goto("/kb/categories");
      await page.getByRole("link", { name: "Add New Category" }).click();
      await page.getByLabel(/^Name/).fill(`E2E Category ${stamp}`);
      await page.getByLabel("Category Description").fill("made by the e2e suite");
      await page.getByRole("button", { name: "Add Category" }).click();
      await expect(page).toHaveURL(/\/kb\?cid=\d+$/);
      categoryId = idFromUrl(page);
      await expect(page.getByRole("heading", { name: `E2E Category ${stamp}` })).toBeVisible();
      expect((await osticketKb(os)).categories.join("|")).toContain(`E2E Category ${stamp}`);

      // FAQ in it
      await page.getByRole("link", { name: "Add New FAQ" }).click();
      await expect(page.getByLabel(/^Category/)).toHaveValue(String(categoryId));
      await page.getByLabel(/^Question/).fill(`E2E question ${stamp}?`);
      await page.getByLabel(/^Answer/).fill("<p>E2E <b>answer</b> text</p>");
      await page.getByRole("button", { name: "Add FAQ" }).click();
      await expect(page).toHaveURL(/\/kb\/faqs\/\d+$/);
      faqId = idFromUrl(page);
      await expect(page.getByRole("heading", { name: `E2E question ${stamp}?` })).toBeVisible();
      expect(await osticketPageText(os, `faq.php?id=${faqId}`)).toContain("E2E answer text");
      expect((await osticketKb(os, categoryId)).faqs).toContain(`E2E question ${stamp}?`);

      // Update the FAQ: unpublish it
      await page.getByRole("link", { name: "Edit FAQ" }).click();
      await page.getByLabel("Listing Type").selectOption("0");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(new RegExp(`/kb/faqs/${faqId}$`));
      // osTicket calls an unpublished FAQ "Internal".
      await expect(page.getByText("Internal", { exact: false }).first()).toBeVisible();
      expect((await osticketKb(os, categoryId)).body).toContain("Internal");

      // No change says so
      await page.getByRole("link", { name: "Edit FAQ" }).click();
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByText("No changes to save.")).toBeVisible();
      await page.getByRole("link", { name: "Cancel" }).click();

      // Delete the FAQ, then the category
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete FAQ" }).click();
      await expect(page).toHaveURL(new RegExp(`/kb\\?cid=${categoryId}$`));
      expect((await osticketKb(os, categoryId)).faqs).not.toContain(`E2E question ${stamp}?`);
      faqId = undefined;

      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete category" }).click();
      await expect(page).toHaveURL(/\/kb$/);
      expect((await osticketKb(os)).categories.join("|")).not.toContain(`E2E Category ${stamp}`);
      categoryId = undefined;
    } finally {
      if (faqId) await command(request, "DELETE", `/api/v1/kb/faqs/${faqId}`).catch(() => undefined);
      if (categoryId) await command(request, "DELETE", `/api/v1/kb/categories/${categoryId}`).catch(() => undefined);
      await os.dispose();
    }
  });

  test("canned responses list the same titles, statuses and departments", async ({ page }) => {
    const os = await osticketAdmin();
    const ref = (await osticketRows(os, "canned.php")).filter((r) => r.length >= 4).map((r) => [r[1], r[2], r[3]]);
    expect(ref.length).toBeGreaterThan(0);
    await page.goto("/kb/canned");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(page.getByText("Loading…")).toHaveCount(0);
    await expect(page.locator("tbody td:has-text('…')")).toHaveCount(0);
    const shown = await page.locator("tbody tr").evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll("td")].slice(0, 3).map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim())));
    expect([...shown].sort()).toEqual(ref.map((r) => r.map((c) => c.replace(/\s+/g, " ").trim())).sort());
    await os.dispose();
  });

  test("canned response: add, update and delete, confirmed on osTicket's page", async ({ page, request }) => {
    const os = await osticketAdmin();
    const title = `E2E canned ${Date.now()}`;
    let id: number | undefined;
    try {
      await page.goto("/kb/canned");
      await page.getByRole("link", { name: "Add New Response" }).click();
      await page.getByLabel(/^Title/).fill(title);
      await page.getByLabel(/^Department/).selectOption({ label: "Sales" });
      await page.getByLabel(/^Canned Response/).fill("Hello %{ticket.name}, this is the e2e response.");
      await page.getByRole("button", { name: "Add Response" }).click();
      await expect(page).toHaveURL(/\/kb\/canned$/);
      await expect(page.locator("tbody tr", { hasText: title })).toContainText("Sales");
      let rows = await osticketRows(os, "canned.php");
      const row = rows.find((r) => r[1] === title);
      expect(row?.[2]).toBe("Active");
      expect(row?.[3]).toContain("Sales");
      const list = (await (await request.get("/api/v1/canned?page_size=100")).json()) as { items: { id: number; title: string }[] };
      id = list.items.find((c) => c.title === title)!.id;

      // Disable it
      await page.getByRole("link", { name: title }).click();
      await expect(page).toHaveURL(new RegExp(`/kb/canned/${id}$`));
      await page.getByLabel(/^Status/).selectOption("0");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await expect(page).toHaveURL(/\/kb\/canned$/);
      rows = await osticketRows(os, "canned.php");
      expect(rows.find((r) => r[1] === title)?.[2]).toBe("Disabled");

      // Delete it
      await page.getByRole("link", { name: title }).click();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("button", { name: "Delete canned response" }).click();
      await expect(page).toHaveURL(/\/kb\/canned$/);
      expect((await osticketRows(os, "canned.php")).find((r) => r[1] === title)).toBeUndefined();
      id = undefined;
    } finally {
      if (id) await command(request, "DELETE", `/api/v1/canned/${id}`).catch(() => undefined);
      await os.dispose();
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("sees only what their permissions allow in the knowledge base", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { is_admin: boolean; global_permissions: string[]; roles: Record<string, string[]> };
    const faqManage = me.global_permissions.includes("faq.manage");
    const cannedManage = Object.values(me.roles).some((p) => p.includes("canned.manage"));
    await page.goto("/kb");
    await expect(page.getByRole("heading", { name: "Frequently Asked Questions" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Categories" })).toBeVisible();
    await settled(page);
    expect((await page.getByRole("link", { name: "Add New FAQ" }).count()) > 0).toBe(faqManage);
    expect((await page.getByRole("link", { name: "Canned Responses" }).count()) > 0).toBe(cannedManage);
    await page.goto("/kb/faqs/new");
    if (faqManage) await expect(page.getByRole("heading", { name: "Add New FAQ" })).toBeVisible();
    else await expect(page.getByText("This page could not be found.")).toBeVisible();
    await page.goto("/kb/canned");
    if (cannedManage) await expect(page.getByRole("heading", { name: "Canned Responses" })).toBeVisible();
    else await expect(page.getByText("This page could not be found.")).toBeVisible();
  });
});
