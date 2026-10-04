import { expect, test } from "@playwright/test";
import { createTicket } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketTicket } from "./osticket";

test.use({ storageState: AUTH.admin });

type Item = { ticket_id: number; subject: string };

test("the ticket page shows what osTicket's own page shows", async ({ page, request }) => {
  const os = await osticketAdmin();
  const list = (await (await request.get("/api/v1/tickets/?queue=open&page_size=3")).json()) as { items: Item[] };
  expect(list.items.length).toBeGreaterThan(0);

  for (const { ticket_id, subject } of list.items) {
    const ref = await osticketTicket(os, ticket_id);
    await page.goto(`/tickets/${ticket_id}`);
    await expect(page.getByRole("heading", { name: new RegExp(`Ticket #\\d+`) })).toContainText(subject);

    const cell = (label: string) => page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");
    for (const label of ["Status", "Priority", "Department", "User", "Email", "Source", "SLA Plan", "Help Topic"]) {
      const shown = (await cell(label).innerText()).trim();
      // osTicket adds widgets (counts, "Manage User") to some cells, so its text must contain ours.
      expect(ref.info[label] ?? "", `${label} of ticket ${ticket_id}`).toContain(shown);
      // Not every ticket has a help topic or an SLA; the core fields are always set.
      if (["Status", "Priority", "Department", "User"].includes(label)) expect(shown).not.toBe("");
    }
    const unassigned = /Unassigned/i.test(ref.info["Assigned To"]);
    const assigned = (await cell("Assigned To").innerText()).trim();
    if (unassigned) expect(assigned).toMatch(/Unassigned/i);
    else expect(ref.info["Assigned To"]).toContain(assigned);

    // osTicket counts messages, responses and notes in the tab; events are shown but not counted.
    await expect(page.getByRole("heading", { name: /Ticket Thread \(\d+\)/ })).toContainText(`(${ref.threadCount})`);
  }
  await os.dispose();
});

test("an unknown ticket says so, like osTicket", async ({ page }) => {
  await page.goto("/tickets/99999999");
  await expect(page.getByText("Unknown or invalid ticket ID.")).toBeVisible();
  await page.goto("/tickets/not-a-number");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("hostile HTML in a message is neutralised", async ({ page, request }) => {
  const ticket = await createTicket(request, {
    subject: "[e2e] hostile html",
    message:
      '<p>hello</p><script>window.__pwned = 1</script><img src=x onerror="window.__pwned = 2">' +
      '<a href="javascript:window.__pwned=3">click</a><iframe src="about:blank"></iframe><style>body{display:none}</style>',
  });
  try {
    await page.goto(`/tickets/${ticket.id}`);
    const body = page.locator("ol li").first();
    await expect(body).toContainText("hello");
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await expect(body.locator("script, iframe, style")).toHaveCount(0);
    await expect(body.locator("[onerror]")).toHaveCount(0);
    // The anchor may stay, but not its javascript: target (an <a> without href has no link role).
    expect((await body.locator("a", { hasText: "click" }).getAttribute("href")) ?? "").not.toContain("javascript:");
  } finally {
    await ticket.remove();
  }
});
