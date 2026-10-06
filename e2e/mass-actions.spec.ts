import { expect, test } from "@playwright/test";
import { createTicket, deleteTicketAndUser } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketTicket } from "./osticket";

test.describe("mass actions on the ticket list, as the admin", () => {
  test.use({ storageState: AUTH.admin });

  test("close, reopen, assign, transfer and delete act on every ticked row, as osTicket's pages show", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const tag = `[e2e] mass ${stamp}`;
    const tickets: Awaited<ReturnType<typeof createTicket>>[] = [];
    for (const n of [1, 2, 3]) tickets.push(await createTicket(request, { subject: `${tag} #${n}`, message: "Mass me." }));
    const state = async (id: number) => ((await (await request.get(`/api/v1/tickets/${id}`)).json()) as { status: { state: string }; assignee_name: string | null; dept_name: string }) ;
    const tick = async (queue: string) => {
      await page.goto(`/tickets?queue=${queue}&q=${encodeURIComponent(tag)}`);
      await expect(page.locator("tbody tr", { hasText: tag })).toHaveCount(3);
      await page.getByLabel("Select all tickets on this page").check();
      await expect(page.getByRole("region", { name: "Mass actions" })).toContainText("3 selected");
    };
    const mass = page.getByRole("region", { name: "Mass actions" });
    try {
      // Nothing ticked: no toolbar.
      await page.goto(`/tickets?queue=open&q=${encodeURIComponent(tag)}`);
      await expect(page.locator("tbody tr", { hasText: tag })).toHaveCount(3);
      await expect(mass).toHaveCount(0);

      await tick("open");
      await mass.getByRole("button", { name: "Assign", exact: true }).click();
      await mass.getByLabel("Assign to").selectOption({ label: "Frontend Agent" });
      await mass.getByRole("button", { name: "Assign 3 tickets" }).click();
      await expect(mass).toContainText("Assigned 3 tickets.");
      for (const t of tickets) expect((await state(t.id)).assignee_name).toBe("Frontend Agent");
      expect((await osticketTicket(os, tickets[0].id)).info["Assigned To"]).toContain("Frontend Agent");

      await tick("open");
      await mass.getByRole("button", { name: "Transfer", exact: true }).click();
      await mass.getByLabel("Department").selectOption({ label: "Sales" });
      await mass.getByRole("button", { name: "Transfer 3 tickets" }).click();
      await expect(mass).toContainText("Transferred 3 tickets.");
      for (const t of tickets) expect((await state(t.id)).dept_name).toBe("Sales");

      await tick("open");
      await mass.getByRole("button", { name: "Close", exact: true }).click();
      await mass.getByRole("button", { name: "Close 3 tickets" }).click();
      // The rows leave the open queue, so the toolbar goes with the selection; the proof is the state.
      await expect.poll(async () => (await state(tickets[2].id)).status.state).toBe("closed");
      for (const t of tickets) expect((await state(t.id)).status.state).toBe("closed");
      expect((await osticketTicket(os, tickets[1].id)).info["Status"]).toContain("Closed");

      await tick("closed");
      await mass.getByRole("button", { name: "Reopen", exact: true }).click();
      await mass.getByRole("button", { name: "Reopen 3 tickets" }).click();
      await expect.poll(async () => (await state(tickets[0].id)).status.state).toBe("open");

      // One ticked row only.
      await page.goto(`/tickets?queue=open&q=${encodeURIComponent(tag)}`);
      await expect(page.locator("tbody tr", { hasText: tag })).toHaveCount(3);
      await page.getByLabel(`Select ticket ${(await request.get(`/api/v1/tickets/${tickets[0].id}`).then((r) => r.json())).number}`).check();
      await expect(mass).toContainText("1 selected");
      await mass.getByRole("button", { name: "Delete", exact: true }).click();
      await mass.getByRole("button", { name: "Delete 1 ticket" }).click();
      await expect.poll(async () => (await request.get(`/api/v1/tickets/${tickets[0].id}`)).status()).toBe(404);
      expect((await request.get(`/api/v1/tickets/${tickets[1].id}`)).status()).toBe(200);
    } finally {
      for (const t of tickets) await deleteTicketAndUser(request, t.id).catch(() => undefined);
      await os.dispose();
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("is offered only the mass actions their role allows", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { roles: Record<string, string[]> };
    const perms = new Set(Object.values(me.roles).flat());
    await page.goto("/tickets?queue=open");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page.locator("tbody tr").first().getByRole("checkbox").check();
    const mass = page.getByRole("region", { name: "Mass actions" });
    await expect(mass).toBeVisible();
    for (const [label, perm] of [["Assign", "ticket.assign"], ["Transfer", "ticket.transfer"], ["Delete", "ticket.delete"], ["Close", "ticket.close"]] as const) {
      expect((await mass.getByRole("button", { name: label, exact: true }).count()) > 0, label).toBe(perms.has(perm));
    }
  });
});
