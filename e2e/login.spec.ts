import { expect, test } from "@playwright/test";

// A fresh browser with no session. The login route allows 10 attempts a minute per address and locks one account/address
// pair for 300 s after 5 failures, so these use a made-up username (no real account is ever locked) and few attempts.
test.use({ storageState: { cookies: [], origins: [] } });

test("a wrong password says so in osTicket's words", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email or Username").fill(`nobody-${Date.now()}`);
  await page.getByPlaceholder("Password").fill("wrong");
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Invalid login");
  await expect(page).toHaveURL(/\/login$/);
});

test("after five failures the lockout says how long to wait, in seconds", async ({ page }) => {
  const username = `nobody-lockout-${Date.now()}`;
  await page.goto("/login");
  for (let i = 0; i < 6; i++) {
    await page.getByPlaceholder("Email or Username").fill(username);
    await page.getByPlaceholder("Password").fill(`wrong-${i}`);
    await page.getByRole("button", { name: /Log In|Verifying/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
  }
  // The backend's lockout answers 429 with Retry-After: 300, and the screen says so.
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText(/Too many attempts\. Try again in (\d+) seconds\./);
  const seconds = Number(/in (\d+) seconds/.exec(await page.getByRole("alert").filter({ hasText: /\S/ }).innerText())?.[1]);
  expect(seconds).toBeGreaterThan(0);
  expect(seconds).toBeLessThanOrEqual(300);
});

test("the login route passes Retry-After through on any 429", async ({ request }) => {
  // Same fresh username: after the lockout above it answers 429 straight away, and the header must be there.
  const username = `nobody-header-${Date.now()}`;
  let last = 0;
  let retryAfter: string | undefined;
  for (let i = 0; i < 7 && last !== 429; i++) {
    const res = await request.post("/api/session", { data: { username, password: `wrong-${i}` } });
    last = res.status();
    retryAfter = res.headers()["retry-after"];
  }
  expect(last).toBe(429);
  expect(Number(retryAfter)).toBeGreaterThan(0);
});
