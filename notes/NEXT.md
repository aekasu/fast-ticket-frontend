# Next steps — handoff

Last updated 2026-10-04. Overwrite this file when the direction changes; delete finished items. A fresh session starts
here (see `CLAUDE.md` → "Starting a session"). Nothing is built yet: the repo holds only this guidance.

## Do first: scaffold the app, then the login screen

1. **Scaffold** Next.js (TypeScript, App Router, Tailwind, ESLint, `src/` layout, npm) in this directory. Keep the
   existing `AGENTS.md`, `CLAUDE.md`, `.gitignore` and `notes/`. Commit the scaffold on its own.
2. **Schema pipeline.** Add `npm run api:pull` (fetch `http://localhost:8000/openapi.json` into
   `openapi/openapi.json`, pretty-printed and key-stable so diffs are small) and `npm run api:types` (generate
   TypeScript types from the snapshot, e.g. `openapi-typescript`). Commit the snapshot and the generated types.
   Check the snapshot's size and that `/openapi.json` is really served by the dev backend first.
3. **Proxy + BFF.** `next.config` rewrite of `/api/v1/*` to the backend (`FASTAPI_URL` env, `.env.example` documents
   it). Route handlers under `src/app/api/session/…`: `POST` login (forwards the form-encoded credentials to
   `/api/v1/auth/login`, stores the token in an **httpOnly, SameSite=Lax cookie** with `Max-Age = expires_in`,
   `Secure` outside dev, returns no token to the browser), `DELETE` logout, and a way to attach the cookie's token as
   `Authorization: Bearer` on proxied calls (a catch-all route handler that proxies instead of a plain rewrite is
   the simplest way to do that). Surface `X-Login-Error` as a readable message; a 429 shows its `Retry-After`; a 401
   from any call clears the cookie and goes to login.
4. **Login screen** that looks like osTicket's staff login (`/scp/login.php` on http://localhost:8080), then a minimal
   authenticated shell (header, navigation like osTicket's: Dashboard, Tickets, Tasks, Users, Organizations,
   Knowledge Base, Admin Panel) whose menu follows `GET /api/v1/auth/me` (admin-only entries hidden for non-admins).
5. **Verify against the live stack**, not mocks: log in as the seeded admin, as a non-admin agent, with a wrong
   password (`invalid_credentials`), and check that no token is reachable from page JavaScript. Credentials for the
   stack are in the backend's `.env` (the user permitted reading it there; never print or copy the values into this
   repo).

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
- Component and end-to-end tests: decide the approach with the user once the first screens exist.
- A project skill for "port an osTicket screen" — write it after two or three screens, so it reflects what was done.
- Data-fetching library (recommendation: TanStack Query) — confirm with the user when the first list screen is built.

## Conventions

- Atomic commits, `<type>(<scope>): <summary>`, ending with
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Local repo, no remote yet.
- Never commit `.env` files or secrets; `.env.example` documents each variable.
- Before ending a session: everything committed, this file current, and say whether the conversation can be cleared.
