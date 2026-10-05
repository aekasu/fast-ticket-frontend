import { expect, test, type APIRequestContext } from "@playwright/test";
import { command, createTicket } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketPageText } from "./osticket";

test.use({ storageState: AUTH.admin });

const firstInt = (r: Record<string, unknown>) => Object.values(r).find((v): v is number => typeof v === "number" && Number.isInteger(v))!;
async function create(request: APIRequestContext, path: string, body: Record<string, unknown>) {
  const done = await command(request, "POST", path, body);
  expect(done.status, done.error_message ?? "").toBe("done");
  return firstInt(done.result);
}
const get = async <T>(request: APIRequestContext, path: string) => (await (await request.get(path)).json()) as T;

test("an organization's account manager, primary contacts and automated collaboration, and what they do", async ({ page, request }) => {
  const os = await osticketAdmin();
  const s = Date.now();
  const orgId = await create(request, "/api/v1/orgs", { name: `E2E Org Account ${s}` });
  const ana = await create(request, "/api/v1/users", { name: `E2E Ana ${s}`, email: `e2e.ana.${s}@example.com`, org_id: orgId });
  const ben = await create(request, "/api/v1/users", { name: `E2E Ben ${s}`, email: `e2e.ben.${s}@example.com`, org_id: orgId });
  const feId = ((await get<{ items: { id: number; username: string }[] }>(request, "/api/v1/staff?page_size=100")).items.find((x) => x.username === (process.env.FE_TEST_AGENT_USERNAME ?? "fe-agent")))!.id;
  const tickets: { remove: () => Promise<unknown> }[] = [];
  try {
    // Before: nothing set
    await page.goto(`/orgs/${orgId}`);
    const cell = (label: string) => page.locator("th", { hasText: new RegExp(`^${label}:$`) }).locator("xpath=following-sibling::td[1]");
    await expect(cell("Ticket Sharing")).toHaveText("Primary contacts see all tickets");

    // Set everything through the form
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await page.getByLabel("Account Manager", { exact: true }).selectOption({ label: "Frontend Agent" });
    await page.getByLabel("Assign tickets to the Account Manager").check();
    await page.getByRole("group", { name: "Primary Contacts" }).getByLabel(`E2E Ana ${s}`).check();
    await page.getByLabel("Add primary contacts to all tickets").check();
    await page.getByLabel("Add organization members to all tickets").check();
    await page.getByLabel("Ticket Sharing").selectOption({ label: "All members see all tickets" });
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page).toHaveURL(new RegExp(`/orgs/${orgId}$`));

    await expect(cell("Account Manager")).toHaveText("Frontend Agent");
    await expect(cell("Auto-Assignment")).toContainText("Account Manager");
    await expect(cell("Primary Contacts")).toHaveText(`E2E Ana ${s}`);
    await expect(cell("Ticket Sharing")).toHaveText("All members see all tickets");
    await expect(cell("Automated Collaboration")).toContainText("Primary contacts, All members");

    const stored = await get<{ manager_staff_id: number; manager_team_id: number; assign_account_manager: boolean; primary_contact_ids: number[]; collab_primary_contacts: boolean; collab_all_members: boolean; sharing: string }>(request, `/api/v1/orgs/${orgId}`);
    expect(stored).toMatchObject({ manager_staff_id: feId, manager_team_id: 0, assign_account_manager: true, primary_contact_ids: [ana], collab_primary_contacts: true, collab_all_members: true, sharing: "all_members" });
    expect(await osticketPageText(os, `orgs.php?id=${orgId}`)).toContain("Frontend Agent");

    // What osTicket does with it: a ticket from a member goes to the account manager, and the contacts are added
    const t = await createTicket(request, { subject: `[e2e] org auto ${s}`, message: "From a member.", name: `E2E Ben ${s}`, email: `e2e.ben.${s}@example.com` });
    tickets.push(t);
    const detail = await get<{ assignee_staff_id: number | null; user_id: number; collaborators: { user_id: number }[] }>(request, `/api/v1/tickets/${t.id}`);
    console.log(`ticket from a member: owner ${detail.user_id} (Ben is ${ben}), assignee ${detail.assignee_staff_id} (manager is ${feId}), collaborators ${JSON.stringify(detail.collaborators.map((c) => c.user_id))} (Ana is ${ana})`);
    expect(detail.user_id).toBe(ben);
    expect(detail.assignee_staff_id).toBe(feId);
    expect(detail.collaborators.map((c) => c.user_id)).toContain(ana);

    // Change the manager to a team, drop the contacts and the flags
    await page.goto(`/orgs/${orgId}/edit`);
    await page.getByLabel("Account Manager", { exact: true }).selectOption({ label: "Level I Support" });
    await page.getByRole("group", { name: "Primary Contacts" }).getByLabel(`E2E Ana ${s}`).uncheck();
    await page.getByLabel("Add primary contacts to all tickets").uncheck();
    await page.getByLabel("Add organization members to all tickets").uncheck();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page).toHaveURL(new RegExp(`/orgs/${orgId}$`));
    await expect(cell("Account Manager")).toHaveText("Level I Support (team)");
    await expect(cell("Primary Contacts")).toHaveText("");
    const teamStored = await get<{ manager_staff_id: number; manager_team_id: number; primary_contact_ids: number[]; collab_primary_contacts: boolean; collab_all_members: boolean }>(request, `/api/v1/orgs/${orgId}`);
    expect(teamStored.manager_staff_id).toBe(0);
    expect(teamStored.manager_team_id).toBeGreaterThan(0);
    expect(teamStored.primary_contact_ids).toEqual([]);
    expect(teamStored.collab_primary_contacts).toBe(false);
    expect(teamStored.collab_all_members).toBe(false);
    expect(await osticketPageText(os, `orgs.php?id=${orgId}`)).toContain("Level I Support");

    // And no manager at all
    await page.goto(`/orgs/${orgId}/edit`);
    await page.getByLabel("Account Manager", { exact: true }).selectOption({ label: "— None —" });
    await page.getByLabel("Assign tickets to the Account Manager").uncheck();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(cell("Account Manager")).toHaveText("");
    const cleared = await get<{ manager_staff_id: number; manager_team_id: number; assign_account_manager: boolean }>(request, `/api/v1/orgs/${orgId}`);
    expect(cleared).toMatchObject({ manager_staff_id: 0, manager_team_id: 0, assign_account_manager: false });
  } finally {
    for (const t of tickets) await t.remove().catch(() => undefined);
    for (const id of [ana, ben]) await command(request, "DELETE", `/api/v1/users/${id}`).catch(() => undefined);
    await command(request, "DELETE", `/api/v1/orgs/${orgId}`).catch(() => undefined);
    await os.dispose();
  }
});
