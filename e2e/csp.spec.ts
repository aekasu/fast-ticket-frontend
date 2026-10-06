import { expect, test } from "@playwright/test";
import { AUTH } from "./global-setup";

test.describe("Content-Security-Policy", () => {
  test("every page carries a policy with a fresh nonce", async ({ request }) => {
    const nonce = async () => /'nonce-([^']+)'/.exec((await request.get("/login")).headers()["content-security-policy"] ?? "")?.[1];
    const first = await nonce();
    expect(first).toBeTruthy();
    expect(await nonce()).not.toBe(first);
    const csp = (await request.get("/login")).headers()["content-security-policy"];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  test("the login page still works under it, with no violation", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => /Content.Security.Policy/i.test(m.text()) && violations.push(m.text()));
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /log ?in|sign in/i })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(violations).toEqual([]);
  });
});

test.describe("the panel under the policy", () => {
  test.use({ storageState: AUTH.admin });

  test("scripts run (live updates connect, lists load) and nothing is blocked", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => /Content.Security.Policy/i.test(m.text()) && violations.push(m.text()));
    for (const path of ["/", "/tickets", "/tickets/new", "/tasks", "/users", "/kb", "/admin", "/admin/staff"]) {
      await page.goto(path);
      await expect(page.locator("[data-live='live']"), path).toBeVisible();
    }
    await page.goto("/tickets");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(violations).toEqual([]);
  });
});
