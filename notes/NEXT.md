# Next steps — handoff

Last updated 2026-10-04. Overwrite this file when the direction changes; delete finished items. A fresh session starts
here (see `CLAUDE.md` → "Starting a session"). The scaffold, schema pipeline, BFF and login shell exist.

## Do first: finish verifying login, then ticket queues

Built and verified live on 2026-10-04 (admin account): scaffold, schema pipeline (`npm run api:pull`, `api:types`),
BFF (`/api/session` login/logout, `/api/v1/*` catch-all proxy attaching the httpOnly cookie token, `/logout`,
`src/proxy.ts` optimistic redirect), login screen, and the panel shell with osTicket's menu.
Checked: wrong password -> 401 `invalid_credentials`; login sets `ft_token` HttpOnly, SameSite=Lax, Max-Age=1800;
proxied `/auth/me` works with the cookie and gives 401 without; the token does not appear in the page HTML; logout
redirects to login.

1. **Non-admin verified (2026-10-04):** a throwaway agent `fe-agent` (non-admin, Support dept, role 3) was created in the
   dev DB through `POST /staff`; its credentials are in the gitignored `.env.local`
   (`FE_TEST_AGENT_USERNAME`/`FE_TEST_AGENT_PASSWORD`) for tests. For it the menu hides Users and Admin Panel and
   `/admin`, `/users` are 404; the admin sees both. The account lockout message works end to end (`Retry-After: 300` reaches the screen);
   the generic per-address limiter sends no `Retry-After` (see `BACKEND_REQUESTS.md`). Not yet checked: the `Secure` cookie flag in a production build.
   Note: the login route allows 10 attempts a minute per address (all accounts share it), and 5 failures lock
   one account/address pair for 300 s; tests must log in once and reuse the session (Playwright `storageState`).
2. **Ticket queues: built and verified (2026-10-04)** at `/tickets` (`src/components/ticket-queues.tsx`,
   `ticket-list.tsx`, hooks in `src/lib/queries/tickets.ts`): osTicket's tabs and sub-queues with counts, its six
   default columns, search, sort and paging, all in the URL. `e2e/tickets.spec.ts` compares every queue with
   osTicket's own page (`e2e/osticket.ts` logs in to `/scp`) and checks a non-admin agent. Run it with
   `set -a; . ../fast-ticket/.env; set +a; npm run test:e2e` (it starts the dev server itself).
   Gaps, deliberately not faked: no mass-action checkboxes and no "New Ticket" tab yet; no "Closed today / this
   week" sub-queues (API has none, `KNOWN_LIMITS.md`); no per-column customisation; overdue rows are not tinted
   (the list item has no overdue flag, only `due_date`).
   **Weak spot:** the dev DB holds one ticket, so sorting order, paging and search ranking are not really exercised.
   Seed tickets through the API (`POST /tickets/`, mind the 202 pattern and cleanup) before the next list screens.
3. **Ticket view** (`/tickets/[id]`): thread with attachments, then reply / note / assign / close. osTicket:
   `include/staff/ticket-view.inc.php`, compared at http://localhost:8080/scp/tickets.php?id=1. The list already
   links to it (currently a 404).
4. Dashboard (`scp/index.php`) is a placeholder; osTicket's shows ticket activity reports. Decide what the API can
   back.

Lessons from this session: Playwright's `baseURL` plus a path with a leading `/` drops the base path (use a trailing
slash and relative paths); FastAPI's collection routes end in `/` and the proxy must keep it (`skipTrailingSlashRedirect`).

Run the app with `npm run dev` (it unsets the agent env vars so Next does not rewrite `AGENTS.md`). Log in with the
backend's seeded admin: source `../fast-ticket/.env` inside a command, never print it.

Then continue in the order set in `AGENTS.md` → Goal: **ticket queues** (`GET /tickets/queues`, list with search,
sort, counts) → **ticket view** with thread and attachments → reply/note/assign/close → tasks → users/orgs → KB and
canned → Admin Panel. For each screen: open osTicket's own page at http://localhost:8080/scp next to it, read its
source in `../osticket/osTicket` (`scp/*.php`, `include/staff/*.inc.php`), map each field and action to an endpoint
in the schema, build it, and compare against osTicket on the same data.

## Read first, every session

- `AGENTS.md` (this repo's rules and decisions).
- The backend's contract: `../fast-ticket/notes/CLIENTS.md` (auth, the 202 command pattern, idempotency, errors),
  `../fast-ticket/notes/EVENTS.md` (WebSocket), `../fast-ticket/notes/KNOWN_LIMITS.md` (what the API lacks).
- Writes are asynchronous: a `202` means queued. Wait with `GET /api/v1/commands/{id}?wait=30`, then show osTicket's
  `error_message` on `failed`. A fresh `Idempotency-Key` per user action, created when the user clicks.

## The stack to develop against

Run from `../fast-ticket` (see its `/dev-stack` skill; `docker compose ps` there, and `docker compose up -d db` if
the db exited after a WSL restart): API http://localhost:8000 (`/docs`), osTicket http://localhost:8080/scp, MySQL on
13306. Both answered on 2026-10-04. The browser must only ever talk to Next.js (option B), so the backend's
`CORS_ORIGINS` needs no change.

## Backend gaps to expect (record, do not work around)

Known: no file upload, no ticket export, no custom queues, list search ignores message bodies, team and SLA lists are
admin-only, 2FA accounts cannot log in, no event replay. Anything new goes in `notes/BACKEND_REQUESTS.md` (create it
on first use): what the screen needs, what the API gives. Backend changes are made in `../fast-ticket` in a session
there, never from here.

## Deferred

- Live updates over the WebSocket (design in `AGENTS.md` → Decisions made; until then screens refetch).
- Component and end-to-end tests: approach decided (Vitest + Testing Library; Playwright against the live stack); set them up with the first list screen.
- A project skill for "port an osTicket screen" — write it after two or three screens, so it reflects what was done.

## Conventions

- Atomic commits, `<type>(<scope>): <summary>`, ending with
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Local repo, no remote yet.
- Never commit `.env` files or secrets; `.env.example` documents each variable.
- Before ending a session: everything committed, this file current, and say whether the conversation can be cleared.
