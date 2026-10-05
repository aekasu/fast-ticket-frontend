# Handoff — the frontend is closed out

Last updated 2026-10-05. A fresh session starts here (see `CLAUDE.md` → "Starting a session"). The frontend has adopted
what the backend offers; what is left is almost all on the backend side (`notes/BACKEND_REQUESTS.md`).

## State

Every screen of osTicket's staff panel exists, each compared with osTicket's own page by the end-to-end suite:

- **Dashboard** (real queue and task counts, the agent's assigned tickets), **Agent Directory**, **My Profile**
  (read-only), a header **search** (tickets, users, organizations).
- **Tickets**: queues with counts, list (search, sort, paging, all in the URL), view with a sanitised thread, New Ticket,
  Edit, Reply, Internal Note (with canned responses), Claim, Assign (agent or team), Release, Transfer, Close, Reopen,
  Mark Answered/Unanswered, Change Owner, Collaborators, Merge, Refer, Delete, Add Task, edit and resend thread entries,
  custom form fields.
- **Tasks**: queues with counts, view, create (also from a ticket), edit (title, description, due date), claim, assign,
  transfer, close, reopen, update, note, delete, custom fields.
- **Users and Organizations**: directory, add, edit, delete, login accounts (register, lock, reset and activation mail),
  custom fields; organizations also: account manager, auto-assignment, primary contacts, ticket sharing, automated
  collaboration.
- **Knowledge Base**: FAQs, categories, canned responses (create, edit, delete).
- **Admin Panel** (configuration-driven, `src/lib/admin/`): agents, teams, departments, help topics, SLA, banlist,
  priorities, forms (fields and custom forms), plus editors for team members, extended access, an agent's teams and
  permissions, a topic's forms. Entries with no API behind them are dimmed with a note.
- **Live updates**: the backend's WebSocket relayed as Server-Sent Events (`/api/events`); screens refetch what changed.

**Coverage, measured 2026-10-05** by logging the API calls the browser makes while the suite runs: **115 of the 121**
endpoint-and-method pairs. The other six have no UI by nature: `POST /auth/login` (the session route), `GET /commands`
(no osTicket screen), `GET /health`, `GET /tickets/{id}/collaborators` (the detail carries it), and the two attachment
downloads (built in `thread.tsx`, but the API cannot upload, so the dev stack has no attachment to test with).

**Verification** (last run 2026-10-05, all green): `npm run test:unit` (34 Vitest tests), `npm run test:e2e` (113
Playwright tests, 1 skipped: the known default-order gap), `npm run lint`, `npx tsc --noEmit`, `npm run build`. In a
production build the session cookie is `Secure; HttpOnly; SameSite=Lax`.

## Running it

See `README.md` (dev stack, `.env.local`, seeds, tests, opening it from another device). The dev server is
`npm run dev -- -p 3100`; the e2e suite starts its own if none is running. Admin credentials are in
`../fast-ticket/.env` (source it in a command, never print it); the non-admin test agent `fe-agent` is in `.env.local`.

## Dev stack baseline

`npm run seed:dev` (idempotent) adds 30 tickets, 8 tasks, 3 KB categories and 6 FAQs, all tagged `[seed]`. Expected
counts after a clean run: open tickets 32, closed 0, users 22, organizations 1, open tasks 8, KB 3 categories / 6 FAQs /
4 canned responses, staff 3, teams 1, departments 3, topics 4, SLAs 1, forms 6, banlist 1. The extras beyond the seed are
records the project owner made by hand on 2026-10-05 (the ticket "this is an issue summary" by Shubham Sharma, the user
Parth Sachdeva, the task "This is a task", and seed task 640 reopened): not test data, leave them. A test that fails
midway can leave records named `E2E ...` or `[e2e] ...`; `e2e/sweep.ts` removes those at the next run's setup and teardown.

## Lessons worth keeping

- **Compare with osTicket's own page, not with what you expect.** Most real findings came from that: its wording
  ("Completed", "Internal", "Guest"), its date format, its default order, its refusals, what its pages do not print.
  `e2e/osticket.ts` has the helpers. The reference is the Docker stack's osTicket on :8080, never `/osticket` on :80.
- **A refusal is a feature.** Show `error_message` as osTicket words it (`CommandFailed` unpacks its JSON field errors).
- **A test that needs a stale page must cut the event stream**: `page.route("**/api/events", (r) => r.abort())`.
- **A permission-dependent control appears only after `/auth/me` loads**: assert one is absent only after `settled(page)`.
- **A context made with `request.newContext` inside a test inherits the file's `storageState`**: pass an empty one for an
  anonymous client.
- A test that creates a record gives it an `E2E`/`[e2e]` (or `e2e_cf_*` for a custom field) name so the sweep finds it, and
  one that changes a ticket's owner deletes the original requester itself (`deleteTicketAndUser` deletes only the current).
- **Zsh here aliases `run`**: name shell helper functions something else. `pkill -f` matches its own command line: kill by
  port (`ss -ltnp`) or pid.
- Next 16: read `node_modules/next/dist/docs/` before using an API you are unsure of; only plain data (not functions)
  crosses from a server page to a client component; a bodiless 401 on a kept-alive connection never ends (give it a body).

## What is left

**Needs the backend** — all in `notes/BACKEND_REQUESTS.md` (20 entries). The ones that would change the UI most: a list
of roles (role ids are typed by hand), osTicket's `lastupdate` and the effective due date / overdue flag, search and
counts on the user, organization, KB and task lists, the default queue order, the fields osTicket's "New Ticket" has,
form definitions readable by non-admins (so they can type custom answers), attachment upload, typed custom answers, and a
global search that matches a ticket's requester. After a backend change: `npm run api:pull && npm run api:types`, read
the diff, then remove the request that was met.

**Small and optional on the frontend side:** mass actions on the lists (checkboxes), osTicket's advanced search dialog, a
Content-Security-Policy (needs a nonce setup for Next's inline scripts), a stronger osTicket check in the help-topic forms
test, custom answers as list columns (waiting on the API), a toast or "N new tickets" bar for live updates.

## Conventions

- Atomic commits, `<type>(<scope>): <summary>`, ending with the attribution lines the session gives.
- Local repo, no remote. Never commit `.env*` or secrets; `.env.example` documents each variable.
- Before ending a session: everything committed, this file current, and say whether the conversation can be cleared.
