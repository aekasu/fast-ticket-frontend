import { expect, test } from "@playwright/test";
import { command, createTicket } from "./api";
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

    // The Due Date is osTicket's: the manual one, else the SLA's estimate (an Overdue marker follows it).
    expect(ref.info["Due Date"], `Due Date of ticket ${ticket_id}`).toContain((await cell("Due Date").innerText()).replace(/\s*\(Overdue\)\s*$/, "").trim());

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


test("a reply is rendered by its declared format: entities decoded, markup kept, scripts removed", async ({ page, request }) => {
  const ticket = await createTicket(request, { subject: "[e2e] thread format", message: "Plain customer message." });
  try {
    expect((await command(request, "POST", `/api/v1/tickets/${ticket.id}/reply`, { message: "Tom & Jerry say <b>hello</b><script>window.__x = 1</script>" })).status).toBe("done");
    await page.goto(`/tickets/${ticket.id}`);
    const reply = page.locator("ol li", { hasText: "Jerry say" });
    await expect(reply).toBeVisible();
    // "&" was stored as "&amp;": it must read as an ampersand, not as the entity.
    await expect(reply).toContainText("Tom & Jerry say hello");
    await expect(reply).not.toContainText("&amp;");
    await expect(reply.locator("b", { hasText: "hello" })).toBeVisible();
    await expect(reply.locator("script")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
    const entry = ((await (await request.get(`/api/v1/tickets/${ticket.id}`)).json()) as { thread: { type: string; format: string }[] }).thread.find((e) => e.type === "R");
    expect(entry?.format).toBe("html");
  } finally {
    await ticket.remove();
  }
});
