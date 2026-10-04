import { expect, test } from "@playwright/test";
import { createTicket, settled } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketCannedText, osticketTicket } from "./osticket";

// osTicket's text output keeps `<br>` as written; the reply box is plain text, so a line break is a space here.
const squash = (s: string) => s.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();

test.describe("canned responses in the reply box", () => {
  test.use({ storageState: AUTH.admin });

  test("each response is filled in as osTicket fills it in", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] canned", message: "Hello.", name: "Grace Hopper", email: "grace.canned@example.com" });
    try {
      const list = (await (await request.get("/api/v1/canned?page_size=100")).json()) as { items: { id: number; title: string; is_enabled: boolean; dept_id: number }[] };
      const pickable = list.items.filter((c) => c.is_enabled && (!c.dept_id || c.dept_id === 1));
      expect(pickable.length).toBeGreaterThan(0);

      await page.goto(`/tickets/${ticket.id}`);
      const picker = page.getByLabel("Canned response");
      const box = page.getByLabel("Response", { exact: true });
      await expect(picker).toBeVisible();

      for (const c of pickable) {
        await box.fill("");
        await picker.selectOption({ label: c.title });
        await expect(box).not.toHaveValue("");
        const theirs = squash(await osticketCannedText(os, ticket.id, c.id));
        const ours = squash(await box.inputValue());
        // The frontend fills in the variables it can; for those it can, the text is osTicket's. A variable it cannot
        // resolve stays as written, and then the note says so.
        const unresolved = /%\{[^}]+\}/.test(ours);
        if (unresolved) await expect(page.getByRole("status").filter({ hasText: "Not filled in" })).toBeVisible();
        else expect(ours, c.title).toBe(theirs);
      }
    } finally {
      await ticket.remove();
      await os.dispose();
    }
  });

  test("a picked response can be posted, and Append keeps what was typed", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] canned post", message: "Hello.", name: "Ada Lovelace", email: "ada.canned@example.com" });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      const box = page.getByLabel("Response", { exact: true });
      await box.fill("My own opening line.");
      await page.getByLabel("Append").check();
      await page.getByLabel("Canned response").selectOption({ label: "Sample (with variables)" });
      await expect(box).toHaveValue(/Hi Ada,/);
      const value = await box.inputValue();
      expect(value.startsWith("My own opening line.")).toBe(true);
      expect(value).toContain("#");

      await page.getByRole("button", { name: "Post Reply" }).last().click();
      await expect(page.getByText("Reply posted.")).toBeVisible();
      const ref = await osticketTicket(os, ticket.id);
      expect(ref.html).toContain("My own opening line.");
      expect(ref.html).toContain("Hi Ada,");

      // Without Append, the response replaces the text.
      await box.fill("typed text");
      await page.getByLabel("Append").uncheck();
      await page.getByLabel("Canned response").selectOption({ label: "Sample (with variables)" });
      await expect(box).toHaveValue(/Hi Ada,/);
      expect(await box.inputValue()).not.toContain("typed text");
    } finally {
      await ticket.remove();
      await os.dispose();
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("is offered only enabled responses for their departments", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { roles: Record<string, string[]> };
    const canReply = (me.roles["1"] ?? []).includes("ticket.reply");
    const list = (await (await request.get("/api/v1/canned?page_size=100")).json()) as { items: { title: string; is_enabled: boolean }[] };
    const open = (await (await request.get("/api/v1/tickets/?queue=open&page_size=1")).json()) as { items: { ticket_id: number }[] };
    await page.goto(`/tickets/${open.items[0].ticket_id}`);
    await expect(page.getByRole("heading", { name: /Ticket Thread/ })).toBeVisible();
    await settled(page);
    const picker = page.getByLabel("Canned response");
    if (!canReply) return expect(await picker.count()).toBe(0);
    await expect(picker).toBeVisible();
    const options = (await picker.locator("option").allTextContents()).filter((t) => !t.startsWith("—"));
    expect(options.sort()).toEqual(list.items.filter((c) => c.is_enabled).map((c) => c.title).sort());
  });
});
