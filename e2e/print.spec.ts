import { expect, test } from "@playwright/test";
import { command, createTask, createTicket } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketRaw } from "./osticket";
import { readFileSync } from "node:fs";

test.describe("Print and Export to ZIP", () => {
  test.use({ storageState: AUTH.admin });

  test("a ticket prints as a PDF and exports as a ZIP holding its files", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const file = `zip-${stamp}.txt`;
    const ticket = await createTicket(request, { subject: `[e2e] print ${stamp}`, message: "Print me.", name: "Ada Lovelace", email: "ada.print@example.com" });
    try {
      const done = await command(request, "POST", `/api/v1/tickets/${ticket.id}/reply`, {
        message: "With a file.",
        attachments: [{ name: file, content_type: "text/plain", data: Buffer.from(`zip me ${stamp}`).toString("base64") }],
      });
      expect(done.status).toBe("done");

      await page.goto(`/tickets/${ticket.id}`);
      const number = (await page.getByRole("heading", { level: 1 }).innerText()).match(/#(\d+)/)![1];

      const pdf = page.waitForEvent("download");
      await page.getByLabel("Paper size").selectOption("A4");
      await page.getByRole("button", { name: "Print", exact: true }).click();
      const printed = await pdf;
      expect(printed.suggestedFilename()).toBe(`Ticket-${number}.pdf`);
      expect(readFileSync((await printed.path())!).subarray(0, 5).toString()).toBe("%PDF-");
      // osTicket's own Print is a PDF as well.
      const theirs = await osticketRaw(os, `tickets.php?id=${ticket.id}&a=print&notes=0&events=0`);
      expect(theirs.status).toBe(200);
      expect(theirs.body.slice(0, 5)).toBe("%PDF-");

      const zip = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export to ZIP" }).click();
      const zipped = await zip;
      expect(zipped.suggestedFilename()).toBe(`ticket-${number}.zip`);
      const bytes = readFileSync((await zipped.path())!);
      expect(bytes.subarray(0, 2).toString()).toBe("PK");
      expect(bytes.includes(Buffer.from(file))).toBe(true);
    } finally {
      await ticket.remove();
      await os.dispose();
    }
  });

  test("a task prints as a PDF and has no ZIP", async ({ page, request }) => {
    const stamp = Date.now();
    const task = await createTask(request, { title: `[e2e] print task ${stamp}`, description: "Print me." });
    try {
      await page.goto(`/tasks/${task.id}`);
      await expect(page.getByRole("button", { name: "Export to ZIP" })).toHaveCount(0);
      const pdf = page.waitForEvent("download");
      await page.getByRole("button", { name: "Print", exact: true }).click();
      const printed = await pdf;
      expect(printed.suggestedFilename()).toMatch(/^Task-.+\.pdf$/);
      expect(readFileSync((await printed.path())!).subarray(0, 5).toString()).toBe("%PDF-");
    } finally {
      await task.remove();
    }
  });
});
