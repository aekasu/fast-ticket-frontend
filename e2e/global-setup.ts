import { request } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { sweepTestData } from "./sweep";

export const AUTH = { admin: "playwright/.auth/admin.json", agent: "playwright/.auth/agent.json" };

async function login(baseURL: string, username: string | undefined, password: string | undefined, file: string) {
  if (!username || !password) throw new Error(`missing credentials for ${file}: see playwright.config.ts`);
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/session", { data: { username, password } });
  if (!res.ok()) throw new Error(`login as ${username} failed: ${res.status()} ${await res.text()}`);
  await ctx.storageState({ path: file });
  await ctx.dispose();
}

export default async function globalSetup(config: { projects: { use: { baseURL?: string } }[] }) {
  const baseURL = config.projects[0].use.baseURL!;
  mkdirSync("playwright/.auth", { recursive: true });
  await login(baseURL, process.env.OSTICKET_ADMIN_USERNAME, process.env.OSTICKET_ADMIN_PASSWORD, AUTH.admin);
  await login(baseURL, process.env.FE_TEST_AGENT_USERNAME, process.env.FE_TEST_AGENT_PASSWORD, AUTH.agent);
  // Start clean: remove what an earlier run that died left behind.
  await sweepTestData(baseURL, AUTH.admin);
}
