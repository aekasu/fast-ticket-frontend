# Handoff — the frontend is closed out

Last updated 2026-10-07. A fresh session starts here (see `CLAUDE.md` → "Starting a session"). The frontend has adopted
everything in `../fast-ticket/notes/CHANGES_FOR_FRONTEND.md` as of 2026-10-07 (the backend answered all eleven requests
and added the Admin Panel pages; adopted in the commits after `chore(api): pull the schema: statuses, link/unlink, ...`).
What is left on the backend side is in `notes/BACKEND_REQUESTS.md` (short: company profile, email diagnostic, enumerated
setting options, mailbox accounts).

## State

Every screen of osTicket's staff panel exists, each compared with osTicket's own page by the end-to-end suite:

- **Dashboard** (real queue and task counts, the agent's assigned tickets), the **Activity Report** tab (period, grouping,
  per-day chart, table, CSV), **Agent Directory**, **My Profile** (osTicket's profile form: details, preferences,
  signature, vacation mode, password change that ends the session), a header **search** (tickets, users, organizations).
- **Lists** (tickets, tasks, users, organizations): a Columns menu adds custom form fields as columns (`?cols=`, sent as
  `?fields=`).
- **Tickets**: queues with counts, list (search, sort, paging, all in the URL), view with a sanitised thread, New Ticket
  (osTicket's whole staff form: existing or new requester, Cc, source, status, SLA, due date, assign, response with signature,
  note, notice, attachments), reply and note with attachments, a signature choice and a ticket status, canned responses filled in by the API,
  Edit, Reply, Internal Note (with canned responses), Claim, Assign (agent or team), Release, Transfer, Close, Reopen,
  Mass actions (assign, transfer, close, reopen, delete on ticked rows), an "N new tickets" bar from the live stream, Mark Answered/Unanswered, Link/Unlink/Un-merge with a Related Tickets panel, Change Owner, Collaborators, Merge, Refer (with the referral list and remove), Delete, Add Task, edit and resend thread entries,
  custom form fields.
- **Tasks**: queues with counts (Open, Overdue, My Tasks, Completed, from `/tasks/queues`), view, collaborators, create (also from a ticket), edit (title, description, due date), claim, assign,
  transfer, close, reopen, update, note, edit and resend of thread entries, attachments, delete, custom fields.
- **Users and Organizations**: directory (search, sort, status, ticket and user counts, CSV/paste import), add, edit, delete, login accounts (register, lock, reset and activation mail),
  custom fields; organizations also: account manager, auto-assignment, primary contacts, ticket sharing, automated
  collaboration.
- **Knowledge Base**: FAQs (search), categories (counts from the API), canned responses (create, edit, delete), files on FAQs and
  canned responses (show, download, add, remove).
- **Admin Panel** (configuration-driven, `src/lib/admin/`): agents, teams, departments, help topics, SLA, banlist,
  priorities, forms (fields and custom forms), **roles (create, edit, delete with a permission picker)**, API keys, site
  pages, emails, custom lists with items, schedules with entries, email template sets with their messages, ticket filters
  with rules and actions (`admin-filters.tsx`), the eight settings pages (`admin-settings.tsx`, generic by value type),
  system logs, system information and plugins (`admin-system.tsx`), plus editors for team members, extended access, an
  agent's teams and permissions, and a topic's forms. Only Email Diagnostic is dimmed (no endpoint). Custom-list form
  fields are picked from the list's items.
- **Live updates**: the backend's WebSocket relayed as Server-Sent Events (`/api/events`); screens refetch what changed.

**Coverage** was measured 2026-10-06 at 129 of 134 endpoint-and-method pairs; the 81 pairs the backend added on
2026-10-07 have screens (not re-measured). The five with no UI by nature: `POST /auth/login` (the session route), `GET /commands`,
`GET /health`, and `GET /tickets/{id}/collaborators` and `GET /tasks/{id}/collaborators` (the details carry them).

**Verification** (2026-10-07): `npm run test:unit` (40 Vitest tests), `npm run test:e2e` (about 156 Playwright tests against
the dev server; in the last full run 153 passed, 2 failed transiently and passed on rerun, 1 failed for data reasons: the
Overdue queue test, see below), `npm run lint`, `npx tsc --noEmit`, `npm run build`. Run the suite with the backend's `.env`
sourced (`set -a; . ../fast-ticket/.env; set +a`). Which tests fail transiently changes from run to run (custom-list field, mass actions, New Ticket in
three full runs; each passes alone): a full run is slow on the shared dev backend, so look at the command's `error_message`
and rerun the file before suspecting code.

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

**Known failing test (data, not code):** `e2e/tickets.spec.ts` "overdue tickets are marked, and they are the ones
osTicket's Overdue queue lists": the API marks a ticket overdue that osTicket's Overdue queue does not list (osTicket sets
its `isoverdue` flag from cron). Also, a seed ticket ("[seed] Seed ticket 26") is assigned to the admin, so the dashboard
test only checks the empty state when nothing is assigned.

**Needs the backend** — `notes/BACKEND_REQUESTS.md`: company profile and logos, email diagnostic, the options behind the
settings' select-like keys, mailbox/SMTP accounts, print, canned-response files on a reply.

**Small and optional on the frontend side:** a business-hours schedule's holiday links (accepted by the API, not offered in
the form), editing a schedule entry in place (the API replaces it whole; the UI removes and adds), a list's items in a manual
sort order (the sort number is a plain field), a user in "Locked (Pending Activation)" and an Overdue task are not covered
by a test, mass actions exist for tickets only, osTicket's advanced search dialog, the password-change flow has no test (it
would end the test agent's session), and `img-src` blocks remote images in thread HTML on purpose (see `AGENTS.md`).

## Conventions

- Atomic commits, `<type>(<scope>): <summary>`, ending with the attribution lines the session gives.
- Local repo, no remote. Never commit `.env*` or secrets; `.env.example` documents each variable.
- Before ending a session: everything committed, this file current, and say whether the conversation can be cleared.
