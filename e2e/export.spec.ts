import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { AUTH } from "./global-setup";
import { OSTICKET_QUEUE_ID, osticketAdmin, osticketDirectoryNames, osticketQueueNumbers } from "./osticket";

/** A comma-separated file with quoted cells, as the API writes it (UTF-8 with a byte-order mark). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some(Boolean));
}

async function exported(page: Page): Promise<{ name: string; rows: string[][] }> {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  return { name: file.suggestedFilename(), rows: parseCsv(readFileSync((await file.path())!, "utf8")) };
}

test.describe("CSV export of the lists", () => {
  test.use({ storageState: AUTH.admin });

  test("the open tickets export holds the tickets osTicket's Open queue lists", async ({ page, request }) => {
    const os = await osticketAdmin();
    try {
      const total = ((await (await request.get("/api/v1/tickets/?queue=open&page_size=1")).json()) as { total: number }).total;
      await page.goto("/tickets?queue=open");
      const { name, rows } = await exported(page);
      expect(name).toMatch(/\.csv$/);
      const header = rows[0].map((h) => h.toLowerCase());
      const numberCol = header.indexOf("ticket #");
      expect(numberCol).toBeGreaterThanOrEqual(0);
      expect(rows.length - 1).toBe(total);
      const numbers = rows.slice(1).map((r) => r[numberCol]);
      const theirs = await osticketQueueNumbers(os, OSTICKET_QUEUE_ID.open, total);
      expect([...numbers].sort()).toEqual([...theirs].sort());
    } finally {
      await os.dispose();
    }
  });

  test("the user and organization exports hold the names osTicket's directory lists", async ({ page }) => {
    const os = await osticketAdmin();
    try {
      for (const [path, osPage] of [["/users", "users.php"], ["/orgs", "orgs.php"]] as const) {
        await page.goto(path);
        const { rows } = await exported(page);
        const header = rows[0].map((h) => h.toLowerCase());
        const col = header.indexOf("name");
        expect(col, `${path} has a name column`).toBeGreaterThanOrEqual(0);
        const ours = rows.slice(1).map((r) => r[col].trim());
        const theirs = await osticketDirectoryNames(os, osPage);
        expect([...ours].sort(), path).toEqual([...theirs].sort());
      }
    } finally {
      await os.dispose();
    }
  });

  test("the task export has a row for each task in the list", async ({ page, request }) => {
    const total = ((await (await request.get("/api/v1/tasks/?queue=open&page_size=1")).json()) as { total: number }).total;
    await page.goto("/tasks?queue=open");
    const { rows } = await exported(page);
    expect(rows.length - 1).toBe(total);
  });
});
