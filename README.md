# fast-ticket-frontend

Web frontend for **fast-ticket**, a FastAPI REST and WebSocket API over [osTicket](https://osticket.com). It recreates
osTicket's staff panel (`/scp`) screen by screen, so the two can be compared side by side to show that the backend
implements osTicket's behaviour, including its refusals.

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, TanStack Query. Node 24, npm.

## Scope

Login, dashboard and search; tickets (queues, view, create, edit, reply and notes, assignment, transfer, close and
reopen, merge, link, refer, collaborators, forms, print and ZIP export); tasks; users and organizations; knowledge base
and canned responses; the Admin Panel (agents, teams, departments, help topics, SLA, schedules, filters, forms, lists,
roles, emails and templates, ticket statuses, settings, logs, plugins); CSV export of the lists; live updates.

Anything the API cannot do is shown as absent, not faked. Gaps are listed in `notes/BACKEND_REQUESTS.md`.

## Setup

The backend must be running: the API on http://localhost:8000 and osTicket (the reference for comparison) on
http://localhost:8080. It lives in the sibling repository
[aekasu/fast-ticket](https://github.com/aekasu/fast-ticket), expected at `../fast-ticket`.

```bash
cp .env.example .env.local     # FASTAPI_URL defaults to http://localhost:8000
npm install
npm run dev -- -p 3100         # http://localhost:3100
```

Log in with an agent of the stack. The seeded administrator's credentials are `OSTICKET_ADMIN_USERNAME` and
`OSTICKET_ADMIN_PASSWORD` in the backend's `.env`.

Use `npm run dev`, not a bare `next dev`: the script unsets AI-agent environment variables so Next does not rewrite
`AGENTS.md`.

Production: `npm run build && npm start`. The session cookie is `Secure`, so serve it over HTTPS.

### Opening the dev server from another device

`next dev` refuses to serve scripts to origins it does not know. Add the hostname or IP the device uses to `.env.local`
(comma-separated) and restart:

```
DEV_ALLOWED_ORIGINS=192.168.1.20,laptop.local
```

On Windows with WSL2 in mirrored networking, the Hyper-V firewall also blocks inbound connections to WSL until a rule
allows the port. In an elevated PowerShell (allows 3100 from the LAN only; adjust the address range):

```powershell
New-NetFirewallHyperVRule -Name "fast-ticket-frontend-3100" -DisplayName "WSL fast-ticket frontend" `
  -Direction Inbound -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -Protocol TCP -LocalPorts 3100 `
  -Action Allow -RemoteAddresses 192.168.1.0/24
```

Only the frontend's port is needed; the app proxies the API itself.

## Architecture

- **Same origin.** The browser only talks to Next.js. `/api/v1/*` is proxied to FastAPI by a route handler that adds
  the access token from an httpOnly cookie as a bearer header, so the token never reaches page JavaScript and no CORS is
  needed. `/api/session` logs in and out. The API has no refresh tokens, so a 401 returns the agent to the login screen.
- **Types come from the schema.** `openapi/openapi.json` is a committed snapshot of the backend's `/openapi.json`, and
  `src/lib/api/schema.d.ts` is generated from it. After a backend API change run `npm run api:pull && npm run api:types`
  and commit the diff.
- **Writes are asynchronous.** The API answers `202`; `src/lib/queries/commands.ts` waits on
  `GET /commands/{id}?wait=` and shows osTicket's own refusal (`error_message`) when a command fails, with one
  `Idempotency-Key` per user action.
- **Live updates.** `/api/events` holds the backend WebSocket server-side and relays events to the page as
  Server-Sent Events; an event refetches the queries that read what changed.
- **Downloads** (print, ZIP, CSV) are fetched through the proxy and saved as a blob, so API refusals are shown as text.
- **Admin screens are configuration-driven** (`src/lib/admin/`): a resource is a config entry plus a menu item.
- **Content-Security-Policy** uses a per-request nonce (`src/proxy.ts`), so every page is rendered per request.

```
src/app/            routes: (panel)/ is the authenticated shell; api/ holds the proxy and session handlers
src/components/     screens and shared pieces
src/lib/api/        typed client, generated schema, error types
src/lib/queries/    TanStack Query hooks per resource, the command runner
src/lib/admin/      Admin Panel menu and resource configs
e2e/                Playwright specs and the osTicket comparison helpers
notes/              NEXT.md (handoff), BACKEND_REQUESTS.md
scripts/            api-pull, seed-dev
```

Design decisions and working rules are in `AGENTS.md`.

## Tests

```bash
npm run test:unit                          # Vitest, pure logic
npx playwright install chromium            # once
npm run seed:dev                           # once: sample tickets, tasks and knowledge base (idempotent)
set -a; . ../fast-ticket/.env; set +a      # admin credentials for the comparison helpers
npm run test:e2e                           # starts its own dev server on :3100 if none is running
npm run lint && npx tsc --noEmit
```

The end-to-end suite drives the real stack and compares each screen with osTicket's own page. It creates what it needs
and removes it again; a sweep in global setup and teardown (`e2e/sweep.ts`) clears anything a crashed run left, by its
`E2E` / `[e2e]` names. The non-admin tests use an agent `fe-agent` whose credentials go in `.env.local`
(`FE_TEST_AGENT_USERNAME`, `FE_TEST_AGENT_PASSWORD`); create it once in the Admin Panel (non-admin, Support, role 3).

## Status and handoff

All screens above exist and are covered by the suite. Last full run: 164 of 166 passing. One failure is a known data
mismatch (the Overdue queue test: the API flags a ticket overdue that osTicket's queue does not list, because osTicket
sets that flag from cron). The other is transient on the shared dev backend and passes when rerun alone.

- `notes/NEXT.md` is the working handoff: current state, open items, and lessons learned.
- `notes/BACKEND_REQUESTS.md` lists what the frontend needs from the API and does not get yet: company profile and
  logos, email diagnostic, mailbox/SMTP accounts.
- Backend changes are announced in `../fast-ticket/notes/CHANGES_FOR_FRONTEND.md`; adopt them, then pull the schema.
- Optional frontend work: holiday links on business-hours schedules, editing a schedule entry in place, mass actions on
  lists other than tickets, osTicket's advanced search dialog.

## License

osTicket is GPL-2.0. This project recreates its layout and behaviour and does not copy its code, CSS or images. No
license has been chosen for this repository yet.
