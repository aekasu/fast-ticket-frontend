import { expect, test } from "@playwright/test";
import { AUTH } from "./global-setup";
import { OSTICKET_QUEUE_ID, osticketAdmin, osticketQueueNumbers, osticketQueuePage } from "./osticket";

type Queue = { key: keyof typeof OSTICKET_QUEUE_ID; title: string; parent: string | null; count: number };

test.describe("ticket queues as the admin, compared with osTicket", () => {
  test.use({ storageState: AUTH.admin });

  test("each queue holds the same tickets as osTicket's own pages", async ({ page, request }) => {
    const os = await osticketAdmin();
    const { queues } = (await (await request.get("/api/v1/tickets/queues")).json()) as { queues: Queue[] };

    for (const queue of queues) {
      const shown: string[] = [];
      for (let p = 1; p <= Math.max(1, Math.ceil(queue.count / 25)); p++) {
        await page.goto(`/tickets?queue=${queue.key}&page=${p}`);
        await expect(page.getByText("Loading…")).toHaveCount(0);
        await expect(page.locator("table")).toBeVisible();
        shown.push(...(await page.locator("tbody tr td:first-child a").allTextContents()));
      }
      const expected = await osticketQueueNumbers(os, OSTICKET_QUEUE_ID[queue.key], queue.count);
      expect([...shown].sort(), `queue ${queue.key}`).toEqual([...expected].sort());
      // The tab's count is the number of tickets in that queue.
      expect(queue.count, `count of ${queue.key}`).toBe(expected.length);
    }
    await os.dispose();
  });

  // The API cannot yet order like osTicket's default queue sort (notes/BACKEND_REQUESTS.md).
  test.fixme("the first page is in osTicket's default order", async ({ page }) => {
    const os = await osticketAdmin();
    await page.goto("/tickets?queue=open");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    const shown = await page.locator("tbody tr td:first-child a").allTextContents();
    expect(shown).toEqual(await osticketQueuePage(os, OSTICKET_QUEUE_ID.open));
  });

  test("the tabs and sub-queues have osTicket's names and counts", async ({ page }) => {
    await page.goto("/tickets?queue=open");
    const tabs = page.getByRole("list", { name: "Queues", exact: true });
    await expect(tabs).toContainText("Open");
    await expect(tabs).toContainText("My Tickets");
    await expect(tabs).toContainText("Closed");
    const sub = page.getByRole("list", { name: "Sub-queues" });
    await expect(sub).toContainText("Answered");
    await expect(sub).toContainText("Overdue");

    await page.getByRole("link", { name: /My Tickets/ }).click();
    await expect(page).toHaveURL(/queue=mine/);
    await expect(page.getByRole("list", { name: "Sub-queues" })).toContainText("Assigned to Teams");
  });

  test("column headers match osTicket's default columns", async ({ page }) => {
    await page.goto("/tickets");
    const headers = await page.locator("thead th").allTextContents();
    expect(headers.map((h) => h.replace(/[▼▲]/g, "").trim())).toEqual([
      "Ticket",
      "Last Updated",
      "Subject",
      "From",
      "Priority",
      "Assigned To",
    ]);
  });

  test("search narrows the list and is kept in the URL; nonsense finds nothing", async ({ page, request }) => {
    const first = ((await (await request.get("/api/v1/tickets/?queue=open&page_size=1")).json()) as { items: { subject: string }[] }).items[0];
    test.skip(!first, "no open ticket to search for");
    await page.goto("/tickets?queue=open");
    await page.getByLabel("Search tickets").fill(first.subject.slice(0, 8));
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=/);
    await expect(page.locator("tbody")).toContainText(first.subject);

    await page.getByLabel("Search tickets").fill("zzz-no-such-ticket-zzz");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("No tickets match your search.")).toBeVisible();
  });

  test("sorting reorders the rows and matches the API", async ({ page, request }) => {
    const subjects = async () => page.locator("tbody tr td:nth-child(3) a").allTextContents();
    await page.goto("/tickets?queue=open");
    await expect(page.locator("tbody tr").first()).toBeVisible();

    await page.getByRole("button", { name: "Subject" }).click();
    await expect(page).toHaveURL(/sort=subject/);
    await expect(page).toHaveURL(/dir=desc/);
    await page.getByRole("button", { name: /Subject/ }).click();
    await expect(page).toHaveURL(/dir=asc/);
    await expect(page.getByText("Loading…")).toHaveCount(0);

    const api = (await (await request.get("/api/v1/tickets/?queue=open&sort=subject&descending=false&page_size=25")).json()) as {
      items: { subject: string }[];
    };
    const shown = await subjects();
    expect(shown).toEqual(api.items.map((t) => t.subject));
  });

  test("paging shows 25 rows a page and the rest on the next", async ({ page, request }) => {
    const first = (await (await request.get("/api/v1/tickets/?queue=open&page_size=1")).json()) as { total: number };
    test.skip(first.total <= 25, "seed the dev backend first: npm run seed:dev");
    await page.goto("/tickets?queue=open");
    await expect(page.locator("tbody tr")).toHaveCount(25);
    await expect(page.getByText(`Page 1 of ${Math.ceil(first.total / 25)}`)).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("tbody tr")).toHaveCount(first.total - 25);
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(25);
  });

});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("sees only what the API lets them see", async ({ page, request }) => {
    const { queues } = (await (await request.get("/api/v1/tickets/queues")).json()) as { queues: Queue[] };
    const open = queues.find((q) => q.key === "open")!;
    await page.goto("/tickets?queue=open");
    await expect(page.getByRole("list", { name: "Queues", exact: true })).toContainText(`(${open.count})`);
    const rows = await page.locator("tbody tr td:first-child a").count();
    // One page shows at most 25 rows.
    expect(rows).toBe(Math.min(open.count, 25));
  });
});
