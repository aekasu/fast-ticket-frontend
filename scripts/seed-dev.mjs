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
