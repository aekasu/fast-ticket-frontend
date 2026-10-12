import { expect, test } from "@playwright/test";
import { command, createTask, createTicket } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketTask, osticketTicket } from "./osticket";

test.describe("attachments on replies and notes, as the admin", () => {
  test.use({ storageState: AUTH.admin });

  test("a reply and a note carry files; osTicket lists them and the download returns the bytes", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] attachments", message: "Attach to me." });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await expect(page.getByRole("heading", { name: /Ticket Thread/ })).toBeVisible();

      await page.getByLabel("Response", { exact: true }).fill("A reply with a file.");
      await page.getByLabel("Attach files").setInputFiles({ name: "e2e-reply.txt", mimeType: "text/plain", buffer: Buffer.from("reply attachment bytes") });
      await expect(page.getByRole("list", { name: "Files to attach" })).toContainText("e2e-reply.txt");
      await page.getByRole("button", { name: "Post Reply" }).last().click();
      await expect(page.getByText("Reply posted.")).toBeVisible();
      // The picker is emptied after a post.
      await expect(page.getByRole("list", { name: "Files to attach" })).toHaveCount(0);
      const link = page.getByRole("link", { name: "e2e-reply.txt" });
      await expect(link).toBeVisible();
      expect((await osticketTicket(os, ticket.id)).html).toContain("e2e-reply.txt");
      const href = await link.getAttribute("href");
      expect(await (await request.get(href!)).text()).toBe("reply attachment bytes");

      await page.getByRole("tab", { name: "Post Internal Note" }).click();
      await page.getByLabel("Internal note", { exact: true }).fill("A note with a file.");
      await page.getByLabel("Attach files").setInputFiles({ name: "e2e-note.txt", mimeType: "text/plain", buffer: Buffer.from("note attachment bytes") });
      await page.getByRole("button", { name: "Post Note" }).click();
      await expect(page.getByText("Internal note posted.")).toBeVisible();
      await expect(page.getByRole("link", { name: "e2e-note.txt" })).toBeVisible();
      expect((await osticketTicket(os, ticket.id)).html).toContain("e2e-note.txt");
    } finally {
      await ticket.remove();
      await os.dispose();
    }
  });

  test("a file over the limit is refused before anything is sent", async ({ page, request }) => {
    const limits = (await (await request.get("/api/v1/settings/attachments")).json()) as { max_file_bytes: number };
    const ticket = await createTicket(request, { subject: "[e2e] attachment limit", message: "Too big." });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByLabel("Response", { exact: true }).fill("This should not be posted.");
      await page.getByLabel("Attach files").setInputFiles({ name: "too-big.bin", mimeType: "application/octet-stream", buffer: Buffer.alloc(limits.max_file_bytes + 1) });
      await expect(page.getByText(/too-big\.bin is larger than/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Post Reply" }).last()).toBeDisabled();
      await page.getByRole("button", { name: "Remove too-big.bin" }).click();
      await expect(page.getByRole("button", { name: "Post Reply" }).last()).toBeEnabled();
    } finally {
      await ticket.remove();
    }
  });

  test("the signature choice on a reply is accepted", async ({ page, request }) => {
    const ticket = await createTicket(request, { subject: "[e2e] signature", message: "Sign me." });
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await expect(page.getByLabel("Signature")).toHaveValue("none");
      await page.getByLabel("Response", { exact: true }).fill("A reply with my signature.");
      await page.getByLabel("Signature").selectOption("mine");
      await page.getByRole("button", { name: "Post Reply" }).last().click();
      await expect(page.getByText("Reply posted.")).toBeVisible();
    } finally {
      await ticket.remove();
    }
  });

  test("a task update and note carry files too", async ({ page, request }) => {
    const os = await osticketAdmin();
    const task = await createTask(request, { title: "[e2e] task attachments", description: "Attach to me." });
    try {
      await page.goto(`/tasks/${task.id}`);
      await expect(page.getByRole("heading", { name: /Task Thread/ })).toBeVisible();
      await page.getByLabel("Update", { exact: true }).fill("An update with a file.");
      await page.getByLabel("Attach files").setInputFiles({ name: "e2e-task.txt", mimeType: "text/plain", buffer: Buffer.from("task attachment bytes") });
      await page.getByRole("button", { name: "Post Update" }).last().click();
      await expect(page.getByText("Update posted.")).toBeVisible();
      const link = page.getByRole("link", { name: "e2e-task.txt" });
      await expect(link).toBeVisible();
      expect((await osticketTask(os, task.id)).html).toContain("e2e-task.txt");
      expect(await (await request.get((await link.getAttribute("href"))!)).text()).toBe("task attachment bytes");
    } finally {
      await task.remove();
      await os.dispose();
    }
  });

  test("a new task carries files on its description, and osTicket lists them", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const name = `new-task-${stamp}.txt`;
    let id: number | undefined;
    try {
      await page.goto("/tasks/new");
      await page.getByLabel("Title").fill(`[e2e] task with a file ${stamp}`);
      await page.getByLabel("Description").fill("A task with a file.");
      await page.getByLabel("Attach files").setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(`new task bytes ${stamp}`) });
      await page.getByRole("button", { name: "Create Task" }).click();
      await expect(page).toHaveURL(/\/tasks\/\d+$/);
      id = Number(page.url().split("/").pop());
      const link = page.getByRole("link", { name });
      await expect(link).toBeVisible();
      expect((await osticketTask(os, id)).html).toContain(name);
      expect(await (await request.get((await link.getAttribute("href"))!)).text()).toBe(`new task bytes ${stamp}`);
    } finally {
      if (id) await command(request, "DELETE", `/api/v1/tasks/${id}`).catch(() => undefined);
      await os.dispose();
    }
  });
});
