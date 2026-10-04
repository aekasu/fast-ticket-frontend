import { expect, test, type Page } from "@playwright/test";
import { command, createTask, createTicket, settled } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketTask, osticketTaskQueue } from "./osticket";

const cell = (page: Page, label: string) => page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");

test.describe("tasks as the admin, compared with osTicket's Tasks page", () => {
  test.use({ storageState: AUTH.admin });

  test("tabs, counts and each queue's tasks match osTicket", async ({ page }) => {
    const os = await osticketAdmin();
    for (const [queue, label] of [["open", "Open"], ["assigned", "My Tasks"], ["closed", "Completed"]] as const) {
      const ref = await osticketTaskQueue(os, queue);
      await page.goto(`/tasks?queue=${queue}`);
      await expect(page.getByText("Loading…")).toHaveCount(0);
      await expect(page.locator("table")).toBeVisible();
      const shown: string[] = [];
      for (let p = 1; p <= Math.max(1, Math.ceil(ref.numbers.length / 25)); p++) {
        if (p > 1) await page.goto(`/tasks?queue=${queue}&page=${p}`);
        await expect(page.getByText("Loading…")).toHaveCount(0);
        shown.push(...(await page.locator("tbody tr td:first-child a").allTextContents()));
      }
      expect([...shown].sort(), `queue ${queue}`).toEqual([...ref.numbers].sort());
      // The tab shows osTicket's own count.
      if (ref.tabs[label] !== undefined) {
        await expect(page.getByRole("list", { name: "Task queues" })).toContainText(`${label} (${ref.tabs[label]})`);
      }
    }
    await os.dispose();
  });

  test("column headers match osTicket's", async ({ page }) => {
    await page.goto("/tasks");
    const headers = (await page.locator("thead th").allTextContents()).map((h) => h.replace(/[▼▲]/g, "").trim());
    expect(headers).toEqual(["Number", "Ticket", "Date Created", "Title", "Department", "Agent"]);
  });

  test("a linked task shows its ticket's number", async ({ page, request }) => {
    const linked = (await (await request.get("/api/v1/tasks/?status_id=1&page_size=50")).json()) as { items: { number: string; ticket_id: number | null }[] };
    const task = linked.items.find((t) => t.ticket_id != null);
    test.skip(!task, "no linked task: npm run seed:dev");
    const ticket = (await (await request.get(`/api/v1/tickets/${task!.ticket_id}`)).json()) as { number: string };
    await page.goto("/tasks?queue=open");
    await expect(page.locator("tr", { hasText: task!.number }).first()).toContainText(ticket.number);
  });

  test("search narrows the list", async ({ page }) => {
    await page.goto("/tasks?queue=open");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page.getByLabel("Search tasks").fill("monitor");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=monitor/);
    await expect(page.locator("tbody")).toContainText("second monitor");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByLabel("Search tasks").fill("zzz-nothing-zzz");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("No tasks match your search.")).toBeVisible();
  });

  test("the task page shows what osTicket's shows", async ({ page, request }) => {
    const os = await osticketAdmin();
    const list = (await (await request.get("/api/v1/tasks/?status_id=1&page_size=3")).json()) as { items: { task_id: number; title: string }[] };
    for (const { task_id, title } of list.items) {
      const ref = await osticketTask(os, task_id);
      await page.goto(`/tasks/${task_id}`);
      await expect(page.getByRole("heading", { name: /Task #/ })).toContainText(title);
      for (const label of ["Status", "Department"]) {
        expect(ref.info[label], `${label} of task ${task_id}`).toContain((await cell(page, label).innerText()).trim());
      }
      expect(ref.info["Created"], `Created of task ${task_id}`).not.toBe("");
      const assigned = (await cell(page, "Assigned To").innerText()).trim();
      if (/Unassigned/i.test(assigned)) expect(ref.info["Assigned To"]).toMatch(/Unassigned/i);
      else expect(ref.info["Assigned To"]).toContain(assigned);
    }
    await page.goto("/tasks/99999999");
    await expect(page.getByText("task: Unknown or invalid ID.")).toBeVisible();
    await os.dispose();
  });

  test("update, note, claim, assign, transfer, edit, close and reopen", async ({ page, request }) => {
    const os = await osticketAdmin();
    const task = await createTask(request, { title: "[e2e] task actions", description: "Do the thing." });
    try {
      await page.goto(`/tasks/${task.id}`);
      await expect(page.getByRole("heading", { name: /Task Thread/ })).toBeVisible();

      await page.getByLabel("Update", { exact: true }).fill("An e2e task update.");
      await page.getByRole("button", { name: "Post Update" }).last().click();
      await expect(page.getByText("Update posted.")).toBeVisible();
      expect((await osticketTask(os, task.id)).html).toContain("An e2e task update.");

      await page.getByRole("tab", { name: "Post Internal Note" }).click();
      await page.getByLabel("Note title").fill("E2E task note");
      await page.getByLabel("Internal note", { exact: true }).fill("Agents only, task.");
      await page.getByRole("button", { name: "Post Note" }).click();
      await expect(page.getByText("Internal note posted.")).toBeVisible();
      expect((await osticketTask(os, task.id)).html).toContain("Agents only, task.");

      await page.getByRole("button", { name: "Claim" }).click();
      await expect(page.getByText("Task assigned to you.")).toBeVisible();
      expect((await osticketTask(os, task.id)).info["Assigned To"]).toContain("Admin User");

      await page.getByRole("button", { name: "Assign", exact: true }).click();
      await page.getByLabel("Assign to").selectOption({ label: "Frontend Agent" });
      await page.getByRole("button", { name: "Assign", exact: true }).last().click();
      await expect(page.getByText("Task assigned to Frontend Agent.")).toBeVisible();
      expect((await osticketTask(os, task.id)).info["Assigned To"]).toContain("Frontend Agent");

      await page.getByRole("button", { name: "Transfer", exact: true }).click();
      await page.getByLabel("Department").selectOption({ label: "Sales" });
      await page.getByRole("button", { name: "Transfer", exact: true }).last().click();
      await expect(page.getByText("Task transferred to Sales.")).toBeVisible();
      await expect(cell(page, "Department")).toHaveText("Sales");
      expect((await osticketTask(os, task.id)).info["Department"]).toContain("Sales");

      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill("[e2e] task renamed");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Task updated.")).toBeVisible();
      await expect(page.getByRole("heading", { name: /Task #/ })).toContainText("[e2e] task renamed");
      expect((await osticketTask(os, task.id)).html).toContain("[e2e] task renamed");

      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.getByRole("button", { name: "Close", exact: true }).last().click();
      await expect(page.getByText("Task closed.")).toBeVisible();
      // osTicket calls a closed task "Completed".
      await expect(cell(page, "Status")).toHaveText("Completed");
      expect((await osticketTask(os, task.id)).info["Status"]).toContain("Completed");

      await page.getByRole("button", { name: "Reopen", exact: true }).click();
      await page.getByRole("button", { name: "Reopen", exact: true }).last().click();
      await expect(page.getByText("Task reopened.")).toBeVisible();
      expect((await osticketTask(os, task.id)).info["Status"]).toContain("Open");
    } finally {
      await task.remove();
      await os.dispose();
    }
  });

  test("Add Task from a ticket creates a task linked to it", async ({ page, request }) => {
    const os = await osticketAdmin();
    const ticket = await createTicket(request, { subject: "[e2e] ticket with a task", message: "Needs a task." });
    let taskId: number | undefined;
    try {
      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("link", { name: "Add Task" }).click();
      await expect(page.getByRole("heading", { name: "Open a New Task" })).toBeVisible();
      await expect(page.getByText(/Linked to/)).toBeVisible();
      await page.getByLabel("Title").fill("[e2e] linked task");
      await page.getByLabel("Description").fill("Linked by the e2e suite.");
      await page.getByRole("button", { name: "Create Task" }).click();
      await expect(page).toHaveURL(/\/tasks\/\d+$/);
      taskId = Number(page.url().split("/").pop());
      await expect(page.getByRole("heading", { name: /Task #/ })).toContainText("[e2e] linked task");
      await expect(cell(page, "Ticket")).toContainText("Ticket #");
      expect((await osticketTask(os, taskId)).html).toContain("Linked by the e2e suite.");
    } finally {
      if (taskId) await command(request, "DELETE", `/api/v1/tasks/${taskId}`);
      await ticket.remove();
      await os.dispose();
    }
  });
});

test.describe("a non-admin agent", () => {
  test.use({ storageState: AUTH.agent });

  test("sees the task buttons their role allows", async ({ page, request }) => {
    const me = (await (await request.get("/api/v1/auth/me")).json()) as { roles: Record<string, string[]> };
    const perms = me.roles["1"] ?? [];
    const open = (await (await request.get("/api/v1/tasks/?status_id=1&page_size=1")).json()) as { items: { task_id: number }[] };
    test.skip(open.items.length === 0, "no open task: npm run seed:dev");
    await page.goto("/tasks");
    await expect(page.getByRole("list", { name: "Task queues" })).toBeVisible();
    await settled(page);
    expect((await page.getByRole("link", { name: "New Task" }).count()) > 0).toBe(perms.includes("task.create"));
    await page.goto(`/tasks/${open.items[0].task_id}`);
    await expect(page.getByRole("heading", { name: /Task Thread/ })).toBeVisible();
    await settled(page);
    const has = async (name: string) => (await page.getByRole("button", { name, exact: true }).count()) > 0;
    expect(await has("Edit")).toBe(perms.includes("task.edit"));
    expect(await has("Transfer")).toBe(perms.includes("task.transfer"));
    expect(await has("Close")).toBe(perms.includes("task.close"));
  });
});
