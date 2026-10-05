# fast-ticket-frontend

A web frontend for **fast-ticket** (a FastAPI REST + WebSocket API over [osTicket](https://osticket.com)). It recreates
osTicket's staff panel (`/scp`) screen by screen, so the two can be compared side by side and show that the backend
implements osTicket's behaviour. Next.js 16 (App Router), TypeScript, Tailwind CSS 4, TanStack Query.

What is covered: login, Dashboard (counts, Agent Directory, My Profile), Tickets (queues, view, reply, note, assign,
claim, release, transfer, edit, close/reopen, new), Tasks, Users and Organizations, Knowledge Base (FAQs, categories,
canned responses) and the Admin Panel (agents, teams, departments, help topics, SLA, banlist, priorities, forms).
What the API cannot do is shown as absent, never faked: see `notes/BACKEND_REQUESTS.md`.

## Run it

You need the backend stack running (`../fast-ticket`: API on http://localhost:8000, osTicket on http://localhost:8080).

```bash
cp .env.example .env.local     # FASTAPI_URL=http://localhost:8000 is the default
npm install
npm run dev -- -p 3100         # http://localhost:3100
```

Log in with an agent of the stack. For the seeded administrator, the credentials are `OSTICKET_ADMIN_USERNAME` and
`OSTICKET_ADMIN_PASSWORD` in the backend's `.env`.

Use `npm run dev`, not a bare `next dev`: the script unsets the AI-agent environment variables so Next does not rewrite
`AGENTS.md`.

### Opening it from another device

Your forwarding decides which address the other device types; the app only needs to know that hostname. `next dev` refuses
to serve its scripts to any origin it was not told about (without this, the page loads but nothing on it works), so set
the hostname or IP, comma-separated, in `.env.local` and restart `npm run dev`:

```
DEV_ALLOWED_ORIGINS=192.168.1.20,laptop.local
```

Only those hostnames are added; every other one is still refused. This is for development. For `npm start` the session
cookie is `Secure`, which a browser only accepts over HTTPS (or on localhost), so put it behind HTTPS.

Production: `npm run build && npm start`. The session cookie is then `Secure`, so serve it over HTTPS.

## How it works

- **Same origin.** The browser only talks to Next.js. `/api/v1/*` is proxied to FastAPI by a route handler that adds the
  access token from an **httpOnly cookie** as `Authorization: Bearer`; the token never reaches page JavaScript and no CORS
  is needed. `/api/session` logs in and out. The API has no refresh tokens, so a 401 sends the agent to the login screen.
- **Types come from the schema.** `openapi/openapi.json` is a committed snapshot of the backend's `/openapi.json`;
  `src/lib/api/schema.d.ts` is generated from it. After a backend API change: `npm run api:pull && npm run api:types`
  and commit the diff.
- **Live updates.** `/api/events` holds the backend WebSocket server-side and streams its events to the page as
  Server-Sent Events, so the token never reaches the browser; an event refetches the queries that read what changed.
- **Writes are asynchronous.** The API answers `202`; `src/lib/queries/commands.ts` waits on
  `GET /commands/{id}?wait=` and shows osTicket's own refusal (`error_message`) when a command fails, with one
  `Idempotency-Key` per user action.
- **The admin screens are configuration-driven** (`src/lib/admin/`): a resource is a config entry plus a menu item.
- **Backend gaps** are recorded in `notes/BACKEND_REQUESTS.md`, never worked around silently.

## Tests

Unit tests (`npm run test:unit`, Vitest) cover the pure pieces. End-to-end tests drive the real stack and compare each screen with osTicket's own page (they log in to `/scp` as the
administrator). They create what they need and delete it again; a sweep in global setup and teardown (`e2e/sweep.ts`) also removes anything a crashed run left, by its `E2E`/`[e2e]` names.

```bash
npx playwright install chromium            # once
npm run seed:dev                           # once: 30 tickets, 8 tasks, a small knowledge base (idempotent)
set -a; . ../fast-ticket/.env; set +a      # the admin credentials, not printed or stored
npm run test:e2e                           # starts its own dev server on :3100 if none is running
```

The non-admin tests use an agent `fe-agent` whose credentials are in `.env.local` (`FE_TEST_AGENT_USERNAME`,
`FE_TEST_AGENT_PASSWORD`, git-ignored). Create it once in the Admin Panel (Agents: non-admin, Support, role 3).
The login route allows 10 attempts a minute per address, so the suite logs in once per account and reuses the session.

## Layout

```
src/app/            routes: (panel)/ is the authenticated shell; api/ is the proxy and session handlers
src/components/     screens and shared pieces (action runner, thread, info table, forms)
src/lib/api/        typed client, generated schema, error types
src/lib/queries/    TanStack Query hooks per resource, the command runner
src/lib/admin/      admin menu and resource configs
e2e/                Playwright specs and the osTicket comparison helpers
notes/              NEXT.md (handoff), BACKEND_REQUESTS.md
scripts/            api-pull, seed-dev
```

osTicket is GPL-2.0. This repo recreates its layout and behaviour; it does not copy its code, CSS or images.
