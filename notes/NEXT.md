# Handoff — the frontend is closed out

Last updated 2026-10-06. A fresh session starts here (see `CLAUDE.md` → "Starting a session"). The frontend has adopted
what the backend offers, including everything in `../fast-ticket/notes/CHANGES_FOR_FRONTEND.md` as of 2026-10-06 (adopted in
five rounds, commits b82e74b to the last `feat(...)` after it); what is left is almost all on the backend side
(`notes/BACKEND_REQUESTS.md`, 11 entries). Everything in it is adopted (KB categories are nested by `parent_id`).

## State

Every screen of osTicket's staff panel exists, each compared with osTicket's own page by the end-to-end suite:

- **Dashboard** (real queue and task counts, the agent's assigned tickets), **Agent Directory**, **My Profile**
  (read-only), a header **search** (tickets, users, organizations).
- **Tickets**: queues with counts, list (search, sort, paging, all in the URL), view with a sanitised thread, New Ticket
  (osTicket's whole staff form: existing or new requester, Cc, source, SLA, due date, assign, response with signature,
  note, notice), reply and note with attachments and a signature choice, canned responses filled in by the API,
  Edit, Reply, Internal Note (with canned responses), Claim, Assign (agent or team), Release, Transfer, Close, Reopen,
  Mass actions (assign, transfer, close, reopen, delete on ticked rows), an "N new tickets" bar from the live stream, Mark Answered/Unanswered, Change Owner, Collaborators, Merge, Refer (with the referral list and remove), Delete, Add Task, edit and resend thread entries,
  custom form fields.
- **Tasks**: queues with counts (Open, Overdue, My Tasks, Completed, from `/tasks/queues`), view, collaborators, create (also from a ticket), edit (title, description, due date), claim, assign,
  transfer, close, reopen, update, note, edit and resend of thread entries, attachments, delete, custom fields.
- **Users and Organizations**: directory (search, sort, status, ticket and user counts, CSV/paste import), add, edit, delete, login accounts (register, lock, reset and activation mail),
  custom fields; organizations also: account manager, auto-assignment, primary contacts, ticket sharing, automated
  collaboration.
- **Knowledge Base**: FAQs (search), categories (counts from the API), canned responses (create, edit, delete).
- **Admin Panel** (configuration-driven, `src/lib/admin/`): agents, teams, departments, help topics, SLA, banlist,
  priorities, forms (fields and custom forms), roles (list only), plus editors for team members, extended access, an agent's teams and
  permissions, a topic's forms. Entries with no API behind them are dimmed with a note.
- **Live updates**: the backend's WebSocket relayed as Server-Sent Events (`/api/events`); screens refetch what changed.

**Coverage, measured 2026-10-06** by logging the API calls the browser makes while the suite runs: **129 of the 134**
endpoint-and-method pairs. The other five have no UI by nature: `POST /auth/login` (the session route), `GET /commands`,
`GET /health`, and `GET /tickets/{id}/collaborators` and `GET /tasks/{id}/collaborators` (the details carry them).

**Verification** (last run 2026-10-06, all green): `npm run test:unit` (38 Vitest tests), `npm run test:e2e` (138
Playwright tests passed against `next build && next start` with the CSP, 1 skipped: the known default-order gap), `npm run lint`, `npx tsc --noEmit`, `npm run build`. One
run of 133 showed a single transient failure in the collaborator test that passed on its own: if it recurs, look at the
command's `error_message` first. In a production build the session cookie is `Secure; HttpOnly; SameSite=Lax`.

## Running it

See `README.md` (dev stack, `.env.local`, seeds, tests, opening it from another device). The dev server is
`npm run dev -- -p 3100`; the e2e suite starts its own if none is running. Admin credentials are in
`../fast-ticket/.env` (source it in a command, never print it); the non-admin test agent `fe-agent` is in `.env.local`.

## Dev stack baseline

`npm run seed:dev` (idempotent) adds 30 tickets, 8 tasks, 3 KB categories and 6 FAQs, all tagged `[seed]`. Counts observed
2026-10-06 (they drift: the backend's own test runs add "Oracle ..." users, staff and departments, and the project owner
added a few records by hand): open tickets 38, closed 1, overdue 1; tasks open 8 / my 3 / completed 1; users 32;
organizations 1; KB 3 categories / 6 FAQs; staff 14; teams 2; departments 5; topics 4; SLAs 1; forms 6; banlist 1; roles 4.
Tests compare with osTicket's own pages rather than fixed numbers, so drift does not break them. A test that fails midway
can leave records named `E2E ...` or `[e2e] ...`; `e2e/sweep.ts` removes those at the next run's setup and teardown.

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

**Needs the backend** — all in `notes/BACKEND_REQUESTS.md` (11 entries): the default queue order's tie-break (`last_activity`),
a plain-text message losing its line breaks, an initial status list and attachments on ticket create, FAQ attachments,
role create/edit and the Admin Panel pages with no endpoint (settings, filters, emails, …), the dashboard activity report and
self-service profile, ticket Link/un-merge and a status choice, custom answers as list columns, writing a custom-list
answer. After a backend change: `npm run api:pull && npm run api:types`, read the diff, then remove the request that was met.

**Small and optional on the frontend side:** a user in "Locked (Pending Activation)" is not covered by a test (the dev data
has none), an Overdue task is not covered either (needs a past due date, which the API refuses), mass actions exist for
tickets only (not for tasks or users), osTicket's advanced search dialog, a stronger osTicket check in the help-topic forms
test, and `img-src` blocks remote images in thread HTML on purpose (see `AGENTS.md`).

## Conventions

- Atomic commits, `<type>(<scope>): <summary>`, ending with the attribution lines the session gives.
- Local repo, no remote. Never commit `.env*` or secrets; `.env.example` documents each variable.
- Before ending a session: everything committed, this file current, and say whether the conversation can be cleared.
