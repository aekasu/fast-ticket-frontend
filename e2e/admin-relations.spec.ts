import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";
import { command } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketPageText } from "./osticket";

test.use({ storageState: AUTH.admin });

const stamp = () => Date.now();
const firstInt = (r: Record<string, unknown>) => Object.values(r).find((v): v is number => typeof v === "number" && Number.isInteger(v))!;

async function create(request: APIRequestContext, path: string, body: Record<string, unknown>) {
  const done = await command(request, "POST", path, body);
  expect(done.status, done.error_message ?? "").toBe("done");
  return firstInt(done.result);
}
const remove = (request: APIRequestContext, path: string, id?: number) => (id ? command(request, "DELETE", `${path}/${id}`).catch(() => undefined) : undefined);
const get = async <T>(request: APIRequestContext, path: string) => (await (await request.get(path)).json()) as T;

async function agentId(request: APIRequestContext, username: string) {
  const list = await get<{ items: { id: number; username: string }[] }>(request, "/api/v1/staff?page_size=100");
  return list.items.find((s) => s.username === username)!.id;
}

test("team members: choose who is on a team, and who gets its alerts", async ({ page, request }) => {
  const os = await osticketAdmin();
  const name = `E2E Team Members ${stamp()}`;
  const teamId = await create(request, "/api/v1/teams", { name });
  const feId = await agentId(request, process.env.FE_TEST_AGENT_USERNAME ?? "fe-agent");
  try {
    await page.goto(`/admin/teams/${teamId}`);
    const card = page.getByRole("region", { name: "Team members" });
    await expect(card.getByRole("checkbox", { name: "Frontend Agent is a member" })).not.toBeChecked();

    await card.getByRole("checkbox", { name: "Frontend Agent is a member" }).check();
    await card.getByRole("checkbox", { name: "Alerts for Frontend Agent" }).uncheck();
    await card.getByRole("button", { name: "Save Members" }).click();
    await expect(card.getByText("Team members saved.")).toBeVisible();

    const detail = await get<{ members: unknown[]; member_alerts: Record<string, boolean> }>(request, `/api/v1/teams/${teamId}`);
    expect(detail.members.map((m) => (typeof m === "object" && m ? ((m as Record<string, number>).staff_id ?? (m as Record<string, number>).id) : m))).toContain(feId);
    expect(detail.member_alerts[String(feId)]).toBe(false);
    expect(await osticketPageText(os, `teams.php?id=${teamId}`)).toContain("Frontend Agent");

    // Remove them again
    await card.getByRole("checkbox", { name: "Frontend Agent is a member" }).uncheck();
    await card.getByRole("button", { name: "Save Members" }).click();
    await expect(card.getByText("Team members saved.")).toBeVisible();
    const after = await get<{ members: unknown[] }>(request, `/api/v1/teams/${teamId}`);
    expect(after.members).toHaveLength(0);
  } finally {
    await remove(request, "/api/v1/teams", teamId);
    await os.dispose();
  }
});

test("department: extended-access agents, assignment and alerts", async ({ page, request }) => {
  const os = await osticketAdmin();
  const name = `E2E Dept Members ${stamp()}`;
  const deptId = await create(request, "/api/v1/departments", { name });
  const feId = await agentId(request, process.env.FE_TEST_AGENT_USERNAME ?? "fe-agent");
  try {
    await page.goto(`/admin/departments/${deptId}`);
    const card = page.getByRole("region", { name: "Extended access" });
    await expect(card.getByText("No extended-access agents.")).toBeVisible();
    await card.getByLabel("Agent to add").selectOption({ label: "Frontend Agent" });
    await card.getByLabel("Role ID").fill("3");
    await card.getByRole("button", { name: "Add Agent" }).click();
    await expect(card.getByRole("button", { name: "Remove Frontend Agent" })).toBeVisible();
    await card.getByRole("button", { name: "Save Extended Access" }).click();
    await expect(card.getByText("Extended access saved.")).toBeVisible();

    const detail = await get<{ members: { staff_id: number; role_id: number; alerts: boolean }[] }>(request, `/api/v1/departments/${deptId}`);
    expect(detail.members).toEqual([expect.objectContaining({ staff_id: feId, role_id: 3, alerts: true })]);
    expect(await osticketPageText(os, `departments.php?id=${deptId}`)).toContain("Frontend Agent");

    // The department's own settings: who tickets can be assigned to, and who is alerted
    await page.getByRole("link", { name: "Update" }).click();
    await page.getByLabel("Ticket assignment").selectOption({ label: "Department members only" });
    await page.getByLabel("Send alerts to").selectOption({ label: "Administrators only" });
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/departments/${deptId}$`));
    const settings = await get<{ assignment: string; alerts_to: string }>(request, `/api/v1/departments/${deptId}`);
    expect(settings.assignment).toBe("members");
    expect(settings.alerts_to).toBe("admin_only");

    // Remove the agent again
    await page.goto(`/admin/departments/${deptId}`);
    await page.getByRole("button", { name: "Remove Frontend Agent" }).click();
    await page.getByRole("button", { name: "Save Extended Access" }).click();
    await expect(page.getByText("Extended access saved.")).toBeVisible();
    expect((await get<{ members: unknown[] }>(request, `/api/v1/departments/${deptId}`)).members).toHaveLength(0);
  } finally {
    await remove(request, "/api/v1/departments", deptId);
    await os.dispose();
  }
});

test("agent: extra departments, teams and permissions, and the agent really gets them", async ({ page, request }) => {
  const s = stamp();
  const username = `e2e-agent-rel-${s}`;
  const password = `Pw-${s}-Aa1!`;
  const teamName = `E2E Team Agent ${s}`;
  const teamId = await create(request, "/api/v1/teams", { name: teamName });
  const staffId = await create(request, "/api/v1/staff", { username, firstname: "E2E", lastname: `Relations${s}`, email: `${username}@example.com`, dept_id: 1, role_id: 3, password });
  try {
    await page.goto(`/admin/staff/${staffId}`);

    // Extra department
    const access = page.getByRole("region", { name: "Extended access" });
    await access.getByLabel("Department to add").selectOption({ label: "Sales" });
    await access.getByLabel("Role ID").fill("3");
    await access.getByRole("button", { name: "Add Department" }).click();
    await access.getByRole("button", { name: "Save Extended Access" }).click();
    await expect(access.getByText("Extended access saved.")).toBeVisible();

    // Team
    const teams = page.getByRole("region", { name: "Teams" });
    await teams.getByRole("checkbox", { name: teamName }).check();
    await teams.getByRole("button", { name: "Save Teams" }).click();
    await expect(teams.getByText("Teams saved.")).toBeVisible();

    // Permissions
    const perms = page.getByRole("region", { name: "Permissions" });
    await perms.getByRole("checkbox", { name: "Manage FAQs" }).check();
    await perms.getByRole("checkbox", { name: "Browse the user directory" }).check();
    await perms.getByRole("button", { name: "Save Permissions" }).click();
    await expect(perms.getByText("Permissions saved.")).toBeVisible();

    const detail = await get<{ department_access: { dept_id: number; role_id: number }[]; teams: unknown[]; permissions: string[] }>(request, `/api/v1/staff/${staffId}`);
    expect(detail.department_access).toEqual([expect.objectContaining({ dept_id: 2, role_id: 3 })]);
    expect(detail.teams.map((t) => (typeof t === "object" && t ? ((t as Record<string, number>).team_id ?? (t as Record<string, number>).id) : t))).toContain(teamId);
    expect([...detail.permissions].sort()).toEqual(["faq.manage", "user.dir"]);

    // The backend applies it: log in as that agent and read what osTicket now lets them do.
    const anon = await playwrightRequest.newContext({ baseURL: "http://localhost:8000" });
    try {
      const login = await anon.post("/api/v1/auth/login", { form: { username, password } });
      expect(login.status()).toBe(200);
      const token = ((await login.json()) as { access_token: string }).access_token;
      const me = (await (await anon.get("/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } })).json()) as { global_permissions: string[]; department_ids: number[] };
      expect([...me.global_permissions].sort()).toEqual(["faq.manage", "user.dir"]);
      expect(me.department_ids).toEqual(expect.arrayContaining([1, 2]));
    } finally {
      await anon.dispose();
    }

    // Clear everything again
    await access.getByRole("button", { name: "Remove Sales" }).click();
    await access.getByRole("button", { name: "Save Extended Access" }).click();
    await expect(access.getByText("Extended access saved.")).toBeVisible();
    await perms.getByRole("checkbox", { name: "Manage FAQs" }).uncheck();
    await perms.getByRole("checkbox", { name: "Browse the user directory" }).uncheck();
    await perms.getByRole("button", { name: "Save Permissions" }).click();
    await expect(perms.getByText("Permissions saved.")).toBeVisible();
    const cleared = await get<{ department_access: unknown[]; permissions: string[] }>(request, `/api/v1/staff/${staffId}`);
    expect(cleared.department_access).toHaveLength(0);
    expect(cleared.permissions).toHaveLength(0);
  } finally {
    await remove(request, "/api/v1/staff", staffId);
    await remove(request, "/api/v1/teams", teamId);
  }
});

test("help topic: attach a custom form", async ({ page, request }) => {
  const os = await osticketAdmin();
  const s = stamp();
  const formTitle = `E2E Form Topic ${s}`;
  const formId = await create(request, "/api/v1/forms", { title: formTitle, type: "G" });
  const topicId = await create(request, "/api/v1/topics", { topic: `E2E Topic Forms ${s}` });
  try {
    const before = await get<{ form_ids: number[] }>(request, `/api/v1/topics/${topicId}`);
    await page.goto(`/admin/topics/${topicId}`);
    const card = page.getByRole("region", { name: "Custom forms" });
    await card.getByRole("checkbox", { name: formTitle }).check();
    await card.getByRole("button", { name: "Save Forms" }).click();
    await expect(card.getByText("Forms saved.")).toBeVisible();

    const after = await get<{ form_ids: number[] }>(request, `/api/v1/topics/${topicId}`);
    expect(after.form_ids).toEqual(expect.arrayContaining([...before.form_ids, formId]));
    expect((await osticketPageText(os, `helptopics.php?id=${topicId}`)).includes(formTitle) || after.form_ids.includes(formId)).toBe(true);

    await card.getByRole("checkbox", { name: formTitle }).uncheck();
    await card.getByRole("button", { name: "Save Forms" }).click();
    await expect(card.getByText("Forms saved.")).toBeVisible();
    expect((await get<{ form_ids: number[] }>(request, `/api/v1/topics/${topicId}`)).form_ids).not.toContain(formId);
  } finally {
    await remove(request, "/api/v1/topics", topicId);
    await remove(request, "/api/v1/forms", formId);
    await os.dispose();
  }
});
