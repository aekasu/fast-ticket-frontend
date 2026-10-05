import { expect, test, type Page } from "@playwright/test";
import { command } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketPageText } from "./osticket";

test.use({ storageState: AUTH.admin });

const cell = (page: Page, label: string) => page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");
const osStatus = async (os: Parameters<typeof osticketPageText>[0], id: number) => {
  const text = await osticketPageText(os, `users.php?id=${id}`);
  return /Status:\s*(.+?)\s+Created:/.exec(text)?.[1];
};

async function newUser(request: Parameters<typeof command>[0], stamp: number) {
  const done = await command(request, "POST", "/api/v1/users", { name: `E2E Account ${stamp}`, email: `e2e.account.${stamp}@example.com` });
  expect(done.status, done.error_message ?? "").toBe("done");
  return Object.values(done.result).find((v): v is number => typeof v === "number")!;
}

test("register, lock, unlock and manage a user's account, as osTicket shows it", async ({ page, request }) => {
  const os = await osticketAdmin();
  const stamp = Date.now();
  const id = await newUser(request, stamp);
  try {
    await page.goto(`/users/${id}`);
    const account = page.getByRole("region", { name: "Account" });
    await expect(account).toBeVisible();
    await expect(cell(page, "Status")).toHaveText("Guest");
    await expect(account).toContainText("no login account");
    expect(await osStatus(os, id)).toBe("Guest");
    await expect(page.getByRole("button", { name: "Lock" })).toHaveCount(0);

    // Register
    await page.getByRole("button", { name: "Register", exact: true }).click();
    await page.getByLabel("Username").fill(`e2e-account-${stamp}`);
    await page.getByLabel("Timezone").fill("UTC");
    await page.getByLabel("Temporary password").fill(`Temp-${stamp}-Aa1!`);
    await page.getByRole("button", { name: "Register", exact: true }).last().click();
    await expect(page.getByText(`E2E Account ${stamp} is registered.`)).toBeVisible();
    await expect(cell(page, "Status")).toHaveText("Active (Registered)");
    await expect(cell(page, "Username")).toHaveText(`e2e-account-${stamp}`);
    expect(await osStatus(os, id)).toBe("Active (Registered)");
    // A registered user cannot be registered again, so the button is gone; the activation mail is not offered either
    // because the account is confirmed.
    await expect(page.getByRole("button", { name: "Register", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send Activation Email" })).toHaveCount(0);

    // Lock, then unlock
    await page.getByRole("button", { name: "Lock", exact: true }).click();
    await expect(page.getByText("Account locked.")).toBeVisible();
    await expect(cell(page, "Status")).toHaveText("Locked (Administrative)");
    expect(await osStatus(os, id)).toBe("Locked (Administrative)");
    await page.getByRole("button", { name: "Unlock", exact: true }).click();
    await expect(page.getByText("Account unlocked.")).toBeVisible();
    await expect(cell(page, "Status")).toHaveText("Active (Registered)");
    expect(await osStatus(os, id)).toBe("Active (Registered)");

    // Manage: a new timezone and a forced password change
    await page.getByRole("button", { name: "Manage Account" }).click();
    await page.getByLabel("Timezone").fill("America/New_York");
    await page.getByLabel("Require a password change at the next login").check();
    await page.getByRole("button", { name: "Save Account" }).click();
    await expect(page.getByText("Account updated.")).toBeVisible();
    await expect(cell(page, "Timezone")).toHaveText("America/New_York");
    await expect(cell(page, "Password reset")).toContainText("Required at next login");
    const api = (await (await request.get(`/api/v1/users/${id}`)).json()) as { account: { timezone: string; require_password_reset: boolean } };
    expect(api.account.timezone).toBe("America/New_York");
    expect(api.account.require_password_reset).toBe(true);

    // The reset link is sent through osTicket
    await page.getByRole("button", { name: "Send Password Reset Link" }).click();
    await expect(page.getByText("Password reset email sent.")).toBeVisible();
  } finally {
    await command(request, "DELETE", `/api/v1/users/${id}`).catch(() => undefined);
    await os.dispose();
  }
});

test("osTicket's refusal of a second registration is shown", async ({ page, request }) => {
  const stamp = Date.now();
  const id = await newUser(request, stamp);
  try {
    // Cut the live stream, or the page would refresh itself when the user is registered elsewhere.
    await page.route("**/api/events", (route) => route.abort());
    await page.goto(`/users/${id}`);
    await expect(page.getByRole("button", { name: "Register", exact: true })).toBeVisible();
    // Someone else registers the user; this page is now stale and still offers Register.
    expect((await command(request, "POST", `/api/v1/users/${id}/account`, { password: `Temp-${stamp}-Aa1!` })).status).toBe("done");
    await page.getByRole("button", { name: "Register", exact: true }).click();
    await page.getByLabel("Temporary password").fill(`Other-${stamp}-Aa1!`);
    await page.getByRole("button", { name: "Register", exact: true }).last().click();
    await expect(page.getByRole("alert").filter({ hasText: /already registered/i })).toBeVisible();
  } finally {
    await command(request, "DELETE", `/api/v1/users/${id}`).catch(() => undefined);
  }
});

test("the activation email is offered for an account that is not confirmed", async ({ page, request }) => {
  const stamp = Date.now();
  const id = await newUser(request, stamp);
  try {
    // Registered with an activation email requested and no password: the account waits for confirmation.
    const done = await command(request, "POST", `/api/v1/users/${id}/account`, { send_email: true });
    await page.goto(`/users/${id}`);
    if (done.status !== "done") {
      // The dev stack may not be able to send mail; then osTicket's own refusal is what must be shown by a retry.
      test.skip(true, `registering with an email was refused here: ${done.error_message}`);
    }
    const api = (await (await request.get(`/api/v1/users/${id}`)).json()) as { account: { is_confirmed: boolean; status: string } | null };
    if (api.account?.is_confirmed) test.skip(true, "osTicket confirmed the account at once on this stack");
    await expect(cell(page, "Status")).toHaveText("Pending (Registered)");
    await page.getByRole("button", { name: "Send Activation Email" }).click();
    await expect(page.getByText("Account activation email sent.")).toBeVisible();
    // Now that the email is out, the account is still pending until the user follows the link.
    await expect(cell(page, "Status")).toHaveText("Pending (Registered)");
  } finally {
    await command(request, "DELETE", `/api/v1/users/${id}`).catch(() => undefined);
  }
});
