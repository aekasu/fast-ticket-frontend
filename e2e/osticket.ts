import { request, type APIRequestContext } from "@playwright/test";

// Trailing slash and relative paths below: a leading "/" would drop the /scp prefix and hit the customer portal.
export const OSTICKET = process.env.OSTICKET_URL ?? "http://localhost:8080/scp/";

/** osTicket's own staff panel, logged in as the admin: the reference the frontend is compared with. */
export async function osticketAdmin(): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: OSTICKET });
  const page = await (await ctx.get("login.php")).text();
  const csrf = /name="__CSRFToken__" value="([^"]*)"/.exec(page)?.[1] ?? "";
  const form = {
    __CSRFToken__: csrf,
    do: "scplogin",
    userid: process.env.OSTICKET_ADMIN_USERNAME ?? "",
    passwd: process.env.OSTICKET_ADMIN_PASSWORD ?? "",
  };
  const res = await ctx.post("login.php", { form, maxRedirects: 0 });
  if (res.status() !== 302) throw new Error(`osTicket login failed: ${res.status()}`);
  return ctx;
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** The ticket numbers on osTicket's list for a queue id, in the order osTicket shows them. */
export async function osticketQueueNumbers(ctx: APIRequestContext, queueId: number): Promise<string[]> {
  const html = await (await ctx.get(`tickets.php?queue=${queueId}`)).text();
  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(html)?.[1] ?? "";
  const numbers: string[] = [];
  for (const row of body.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
    const cells = row.match(/<td[\s\S]*?<\/td>/g) ?? [];
    // First cell is the mass-action checkbox, the second is the ticket number.
    const number = cells[1] ? text(cells[1]) : "";
    if (/^\d+$/.test(number)) numbers.push(number);
  }
  return numbers;
}

/** osTicket's queue ids for the default queues, as the API names them. */
export const OSTICKET_QUEUE_ID = {
  open: 1,
  unanswered: 2,
  answered: 3,
  overdue: 4,
  mine: 5,
  assigned_me: 6,
  assigned_teams: 7,
  closed: 8,
} as const;
