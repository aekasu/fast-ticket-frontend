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
   The dev DB is seeded with 30 `[seed]` tickets (`npm run seed:dev`, idempotent) so sort and paging are exercised.
   e2e tests create their own tickets and delete them; a failed run can leave `[e2e]` tickets: delete them.
3. **Ticket view and its actions: built and verified (2026-10-04)** at `/tickets/[id]`
   (`src/components/ticket-view.tsx`, `ticket-actions.tsx`, `safe-html.tsx`): info tables, thread with attachments and
   collaborators, sanitised bodies (DOMPurify), 404 worded like osTicket; toolbar (Claim, Assign to agent/team,
   Release, Mark answered/unanswered, Close/Reopen with a comment) and Post Reply / Post Internal Note, all through
   the 202 pattern (`src/lib/queries/commands.ts`: polling, osTicket's `error_message` on refusal, one
   Idempotency-Key per action). Buttons follow the agent's role in the ticket's department (`can()` in `queries/me.ts`).
   `e2e/ticket-view.spec.ts` and `ticket-actions.spec.ts` confirm each action on osTicket's own page.
   Also built and verified the same day: **New Ticket** (`/tickets/new`, `ticket-new.tsx`: only the fields the API
   creates, with a notice for the rest), **Transfer** (toolbar panel) and **Edit Ticket** (`/tickets/[id]/edit`,
   `ticket-edit.tsx`: PATCH of changed fields only, due date in the browser timezone, SLA field only when the agent
   can list SLAs). `e2e/ticket-new.spec.ts` and `ticket-edit.spec.ts` confirm results on osTicket's own page.
   Lesson: a `<select defaultValue>` mounted before its options exist silently picks the first option; gate forms on
   their reference lists (the "saving without a change" test caught it).
   Not built yet (next in this area, in osTicket's order): Refer, Merge/Link, Change Owner, Collaborators add/remove,
   thread entry edit/resend, Tasks tab, mass actions on the list, the status dropdown beyond close/reopen, signature
   choice on reply, attachment upload (API has none), print, ticket search "advanced".
   Vitest/Testing Library are decided but not set up (nothing has needed a unit test yet).
4. **Tasks: built and verified (2026-10-04)**: `/tasks` (tabs Open / My Tasks / Completed with osTicket's counts,
   search, sort, paging, linked ticket number), `/tasks/[id]` (info, thread, Post Update / Post Internal Note,
   Claim, Assign, Transfer, Edit, Close/Reopen), `/tasks/new` (also from a ticket's "Add Task", `?ticket_id=`).
   `e2e/tasks.spec.ts` compares queues, counts and every action with osTicket's own Tasks page. Shared pieces now live
   in `action-ui.tsx` (runner, notice bar), `thread.tsx`, `queries/actions.ts`. Gaps (BACKEND_REQUESTS.md): no Overdue
   tab, no Collaborators row, "My Tasks" ignores team assignments, no task Delete button yet.
5. **Users and Organizations: built and verified (2026-10-04)**: `/users` (directory with organization filter, Add
   User), `/users/[id]` (info, their tickets, Edit, Delete), `/users/new`, `/users/[id]/edit`, and `/orgs`,
   `/orgs/[id]` (info and members, Edit, Delete), `/orgs/new`, `/orgs/[id]/edit`; gated by `user.dir` / `user.create` /
   `user.edit` / `user.delete` / `org.*` from `/auth/me` (global permissions, `hasGlobal()` in `lib/nav.ts`). Deletes sit
   behind a confirmation (`delete-button.tsx`). `e2e/directory.spec.ts` compares both lists with osTicket's pages and
   runs create / update / delete round trips confirmed on osTicket's pages. Test helpers now also delete the
   requester a ticket created (`deleteTicketAndUser`), so runs leave no users behind.
   Not built: user account management (register, lock, password reset, activation mail; the API has endpoints),
   organization account manager and primary contacts, collaborator defaults, custom user/org form fields, import.
6. **Knowledge Base: built and verified (2026-10-04)**: `/kb` (category sidebar with counts, categories or one
   category's FAQs, Add New FAQ, Edit/Delete Category), `/kb/faqs/[id]` (+ edit, new), `/kb/categories` (+ new, edit),
   `/kb/canned` (+ new, `[id]` edit with Delete). FAQ answers are HTML (sanitised on display). Gated by `faq.manage`
   (global) and `canned.manage` (role in any department); the Canned tab is hidden without it. `e2e/kb.spec.ts`
   compares categories, counts, FAQ lists and canned responses with osTicket's pages and runs category/FAQ/canned round
   trips. Seed: `npm run seed:dev` now adds 3 categories and 6 FAQs. Not built: FAQ search, attachments, FAQ ->
   help topic links, "Print", canned attachments, using a canned response in the reply box (the API has a picker list:
   `GET /canned` filtered by department; wire it into `ticket-actions.tsx`).
7. **Admin Panel: built and verified (2026-10-04)**, configuration-driven: `lib/admin/menu.ts` (osTicket's five groups
   and what the API backs), `lib/admin/resources.ts` (per resource: list columns, detail rows, form fields, read-only
   sections), `components/admin-screens.tsx` (generic list / view / form / delete), routes `/admin`,
   `/admin/[resource]`, `/new`, `/[id]`, `/[id]/edit`. Resources: agents (`staff`), teams, departments, help topics,
   SLA, banlist, priorities (API-only), forms (view and text edit only). Dimmed entries (roles, settings, filters,
   schedules, API keys, pages, lists, plugins, emails, templates, diagnostics, logs, information) show a "no endpoint"
   note. Whole panel is admin-only (404 otherwise). `e2e/admin.spec.ts` compares each list with osTicket's admin page
   and runs add / update / delete round trips for every resource, confirmed on osTicket's pages. To add a resource:
   a config entry plus a menu item. Only the resource key crosses from server pages to client components (the configs
   hold functions).
   Not built: team / department members, an agent's extended access, teams and permissions, a topic's custom forms
   (array fields; the API can), and everything in BACKEND_REQUESTS.md "Admin Panel pages with no API".
8. **Dashboard group: built and verified (2026-10-04)**: `/` (real ticket-queue and task counts that link to their
   queues, the agent's assigned tickets, and a plain note that osTicket's activity report has no endpoint),
   `/directory` (Agent Directory: search, department filter, osTicket's columns), `/profile` (My Profile, read-only).
   `e2e/dashboard.spec.ts` compares counts with the API and osTicket's task tabs, the directory with osTicket's, and
   the profile with osTicket's profile form. Gaps in BACKEND_REQUESTS.md ("No dashboard activity report ...").
   Test lesson: permission-dependent buttons appear only after `/auth/me` loads, so assertions that something is
   *absent* call `settled(page)` first (`e2e/api.ts`).

**Every screen in osTicket's staff menu now exists** (Dashboard, Users, Tasks, Tickets, Knowledge Base, Admin Panel),
each compared with osTicket's own pages by `npm run test:e2e` (89 e2e tests, plus 28 unit tests from `npm run test:unit`). What is left is depth, in this order:
1. ~~README and production build check~~ done (2026-10-04): `README.md`; `npm run build` passes; in a production
   build the cookie is `Secure; HttpOnly; SameSite=Lax`; `next.config.ts` sets X-Frame-Options DENY, nosniff,
   Referrer-Policy and Permissions-Policy and drops X-Powered-By. Not done: a CSP (Next's inline scripts need a nonce
   setup) and serving behind real HTTPS.
1. Ticket depth. Done 2026-10-04: **canned responses in the reply box** (picker, Append, variables filled in by
   `src/lib/canned.ts`, verified equal to osTicket's own `ajax.php/tickets/{id}/canned-resp/{cid}.txt`);
   dates in osTicket's style (`10/4/26 6:45 PM`, `formatDateTime`); **Change Owner, Manage Collaborators (add, alerts,
   active, remove), Merge Tickets, Refer and Delete Ticket** (`components/ticket-people.tsx`), each confirmed on
   osTicket's own ticket page (it records events such as "merged this ticket with Ticket #...", "referred this to Sales",
   "added ... as collaborators"). Not done: a **signature** selector (the API accepts any value and its effect cannot be
   seen), Link Tickets, un-merge, referral list/remove, the status choice beyond Close/Reopen, thread entry edit and
   resend, collaborators from an email that is not yet a user, mass actions on the list, advanced search
   (all in BACKEND_REQUESTS.md where the API is the limit).
2. ~~User accounts~~ done 2026-10-04 (`components/user-account.tsx` on the user page: Guest / Active (Registered) / Pending / Locked as osTicket words them, Register, Manage Account, Lock/Unlock, activation and reset emails; confirmed on osTicket's user page). Still open: organization account manager and primary contacts,
   admin array fields (team and department members, an agent's extended access and permissions, topic forms).
3. Live updates over the WebSocket (design in AGENTS.md; read `../fast-ticket/notes/EVENTS.md` first), then Vitest
   more unit tests. Vitest is set up (`npm run test:unit`, `src/**/*.test.ts`): `canned`, `CommandFailed` parsing and
   `format` are covered; the admin configs and `useActionKey` are not.

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

## Test hygiene (2026-10-04)

`e2e/sweep.ts` runs in global setup and teardown and deletes whatever the tests create, found by its name (`[e2e]`
tickets and tasks, `E2E ...` users, organizations, categories, canned responses, departments, teams, topics, SLAs,
`e2e-...` agents, ban rules and priorities), so a test that dies midway leaves nothing. Any new test that creates a
record must give it one of those names. A test that changes a ticket's owner must delete the original requester itself
(`deleteTicketAndUser` deletes only the current owner). Check by hand: open tickets 31, closed 0, users 20, open tasks 6.

## Custom fields and entity management (2026-10-04)

Done: **custom form fields** on tickets, users, organizations and tasks: shown read-only for everyone
(`CustomFieldsView`, answers from each entity's `custom_fields`, multiple choices shown as labels when the form
definition is readable) and typed in the create and edit forms by administrators (`CustomFieldInputs`, definitions from
`useFormDefinition`, admin-only). Helpers and decoding in `src/lib/custom-fields.ts` (unit-tested). **Admin Forms** now
manages fields (add, edit, remove with or without the answers) and creates and deletes custom forms (type "G");
`components/form-fields.tsx`. **Tasks**: Delete, and editing the description (prefilled from the thread's first entry).
Verified in `e2e/custom-fields.spec.ts` and `admin.spec.ts` against osTicket's pages (its ticket page, user edit dialog,
task page and form builder). Tests that add fields name them `e2e_cf_*` so the sweep removes them.
Open: a non-admin agent cannot type custom answers (form definitions are admin-only: BACKEND_REQUESTS.md); `files`,
list and `info` custom field types are display-only or unsupported; organization account manager and primary contacts;
custom field answers on the list screens (osTicket can add them as columns).

## Admin relation editors (2026-10-04)

`components/admin-relations.tsx`, shown on the detail page of teams, departments, agents and help topics, each saving
only its own field with a PATCH: team members and alert flags; a department's extended-access agents (agent, role id,
alerts) plus its assignment and alerts settings (now form fields); an agent's extended departments, teams and global
permissions (three saves); a help topic's custom forms (the ticket form always stays). `e2e/admin-relations.spec.ts`
checks the stored values, osTicket's page where it shows them, and, for the agent editor, logs in as the edited agent and
confirms `/auth/me` reports the new permissions and departments. The topic test's osTicket check is weak (it falls back
to the API value). Role ids are typed (roles cannot be listed); see BACKEND_REQUESTS.md.
Next: live updates over the WebSocket (read `../fast-ticket/notes/EVENTS.md`, design in AGENTS.md), then organization account
manager and primary contacts, custom answers as list columns, and depth items in BACKEND_REQUESTS.md that need the API.
