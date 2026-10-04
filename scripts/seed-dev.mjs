// Seed the DEV backend with tickets so lists, sorting and paging have something to show.
// Idempotent: each ticket has a fixed Idempotency-Key, so a rerun returns the original commands.
// Usage: set -a; . ../fast-ticket/.env; set +a; node scripts/seed-dev.mjs
const base = process.env.FASTAPI_URL ?? "http://localhost:8000";
const { OSTICKET_ADMIN_USERNAME: user, OSTICKET_ADMIN_PASSWORD: password } = process.env;
if (!user || !password) throw new Error("source the backend .env first");

const login = await fetch(`${base}/api/v1/auth/login`, {
  method: "POST",
  body: new URLSearchParams({ username: user, password }),
});
if (!login.ok) throw new Error(`login failed: ${login.status}`);
const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };

const people = [
  ["Ada Lovelace", "ada@example.com"],
  ["Grace Hopper", "grace@example.com"],
  ["Alan Turing", "alan@example.com"],
  ["Edsger Dijkstra", "edsger@example.com"],
];
const subjects = [
  "Printer on floor 2 is offline",
  "Cannot reset my password",
  "VPN drops every hour",
  "Request: second monitor",
  "Invoice 4821 shows the wrong total",
  "Email bounces from a customer domain",
  "Laptop battery swelling",
  "Shared drive is read-only",
  "New starter needs an account",
  "Website contact form returns an error",
  "Slow login on the dashboard",
  "Calendar invites arrive an hour late",
];

// 30 in all: more than one list page (25 rows).
const all = Array.from({ length: 30 }, (_, i) => subjects[i] ?? `Seed ticket ${i + 1}: routine request`);

for (const [i, subject] of all.entries()) {
  const [name, email] = people[i % people.length];
  const res = await fetch(`${base}/api/v1/tickets/`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", "Idempotency-Key": `fe-seed-ticket-${i + 1}` },
    body: JSON.stringify({
      subject: `[seed] ${subject}`,
      message: `Seeded for frontend development.\n\n${subject}. Reported by ${name}.`,
      name,
      email,
      priority_id: (i % 4) + 1,
    }),
  });
  if (res.status !== 202) throw new Error(`create ${i + 1}: ${res.status} ${await res.text()}`);
  const { command_id } = await res.json();
  const done = await (await fetch(`${base}/api/v1/commands/${command_id}?wait=30`, { headers })).json();
  console.log(`${String(i + 1).padStart(2)} ${done.status}${done.error_message ? `: ${done.error_message}` : ""}`);
}

// Tasks: 8 in all. Two are linked to the first seeded ticket, three are claimed by the admin, two are closed.
async function send(method, path, key, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...headers, "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
  if (res.status !== 202) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  const { command_id } = await res.json();
  const done = await (await fetch(`${base}/api/v1/commands/${command_id}?wait=30`, { headers })).json();
  if (done.status !== "done") throw new Error(`${method} ${path}: ${done.status} ${done.error_message}`);
  return done.result_payload ? JSON.parse(done.result_payload) : {};
}

const ticketList = await (await fetch(`${base}/api/v1/tickets/?q=${encodeURIComponent("[seed] Printer")}`, { headers })).json();
const linkTo = ticketList.items?.[0]?.ticket_id;
const taskTitles = [
  "[seed] Replace the floor 2 printer toner",
  "[seed] Audit shared drive permissions",
  "[seed] Order a second monitor",
  "[seed] Rotate the VPN certificates",
  "[seed] Onboard the new starter",
  "[seed] Review the contact form errors",
  "[seed] Archive last quarter's tickets",
  "[seed] Update the password reset guide",
];
for (const [i, title] of taskTitles.entries()) {
  const n = i + 1;
  const created = await send("POST", "/api/v1/tasks/", `fe-seed-task-${n}`, {
    title,
    description: `Seeded for frontend development.\n\n${title}.`,
    ...(linkTo && n <= 2 ? { ticket_id: linkTo } : {}),
  });
  const id = created.task_id;
  if (n >= 3 && n <= 5) await send("POST", `/api/v1/tasks/${id}/claim`, `fe-seed-task-${n}-claim`, {});
  if (n >= 7) await send("POST", `/api/v1/tasks/${id}/close`, `fe-seed-task-${n}-close`, {});
  console.log(`task ${n} ok (${id})`);
}

// Knowledge base: 3 categories (one private) and 6 FAQs, one of them unpublished.
const categories = [
  ["[seed] Accounts and access", "How to get into your accounts.", true],
  ["[seed] Hardware", "Printers, monitors and laptops.", true],
  ["[seed] Internal procedures", "For agents only.", false],
];
const categoryIds = [];
for (const [i, [name, description, is_public]] of categories.entries()) {
  const r = await send("POST", "/api/v1/kb/categories", `fe-seed-category-${i + 1}`, { name, description, is_public });
  categoryIds.push(Object.values(r).find((v) => Number.isInteger(v) && v > 0));
}
const faqs = [
  [0, "How do I reset my password?", "Use the <b>Forgot my password</b> link on the login page.", true],
  [0, "Why is my account locked?", "Five failed logins lock an account for five minutes.", true],
  [1, "The printer on floor 2 is offline", "Check the cable, then restart the print spooler.", true],
  [1, "How do I order a second monitor?", "Open a ticket under the Request help topic.", true],
  [2, "How to close a ticket", "Post a response, then use <i>Close</i> in the ticket toolbar.", true],
  [2, "Draft: escalation policy", "Not final yet.", false],
];
for (const [i, [c, question, answer, is_published]] of faqs.entries()) {
  await send("POST", "/api/v1/kb/faqs", `fe-seed-faq-${i + 1}`, { category_id: categoryIds[c], question: `[seed] ${question}`, answer, is_published });
}
console.log(`kb ok: ${categoryIds.length} categories, ${faqs.length} faqs`);
