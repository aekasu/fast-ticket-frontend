# Backend requests

What a screen needs that the API lacks or gets wrong. Raised in the backend repo, never fixed from here. Delete an
entry when the backend fixes it (and re-run `npm run api:pull`).

## `GET /api/v1/auth/me` has no response schema

- **Needs:** typed `staff_id`, `username`, `name`, `email`, `is_admin`, `assigned_only`, `global_permissions`
  (string list), `roles` (department id -> permission list), plus `department_ids` and `team_ids`.
- **Gives:** an empty `{}` response schema in `/openapi.json`, so `openapi-typescript` generates `unknown`.
- **Meanwhile:** `src/lib/api/me.ts` holds a small hand-written `Me` type, marked as temporary. Replace it with the
  generated type once the schema exists.

## The generic rate limiter's 429 has no `Retry-After`

- **Needs:** a `Retry-After` header on every 429, as `CLIENTS.md` says ("A locked-out account/address pair gets `429`
  with `Retry-After`"), so a client can say when to retry.
- **Gives (observed 2026-10-04):** the per-account lockout (5 failures) is correct: 429, `Retry-After: 300`, and a
  `detail` message. The per-address limiter (login route: 10 a minute) answers
  `{"error":"Rate limit exceeded: 10 per 1 minute"}` with no `Retry-After`, and uses `error` where other errors use
  `detail`. The login screen then says "Try again later" with no number.

## Timestamps carry no timezone

- **Needs:** an unambiguous instant (ISO 8601 with `Z` or an offset) for `created`, `updated`, `closed`, `due_date`.
- **Gives (observed 2026-10-04):** naive strings such as `"2026-10-03T18:18:02"`. `KNOWN_LIMITS.md` says due dates are
  UTC, so the frontend treats all of them as UTC (`src/lib/format.ts`) and shows them in the browser's timezone.
  osTicket shows its own configured timezone, so a time on screen can differ from osTicket's page by the offset.

## The ticket list cannot reproduce osTicket's default queue order

- **Needs:** osTicket's default queue sort, "Priority + Most Recently Updated" (queue sort `queue_sort.yaml`): most
  urgent priority first, and within one priority the most recently updated first.
- **Gives (observed 2026-10-04, 31 open tickets):** a single sort key. `sort=priority&descending=false` orders the
  priorities correctly (Emergency first; the key is osTicket's urgency number, so `descending=true` puts Low first),
  but breaks ties by oldest update first, the reverse of osTicket. The first 25 rows therefore differ from osTicket's
  first page once a priority group straddles the page edge.
- **Ask:** either break `priority` ties by `updated` descending, or accept a named default sort
  (`sort=default`, or the three "Priority + …" sorts osTicket offers: updated / created / due date).
- **Meanwhile:** the list defaults to `sort=priority&descending=false`; `e2e/tickets.spec.ts` has a `test.fixme`
  for the exact order.

## Thread entries do not say whether the body is HTML or text

- **Needs:** a `format` (`html` / `text`) on each thread entry, as osTicket stores it, so a client renders it
  correctly without guessing.
- **Gives (observed 2026-10-04):** `body` as a string only; the installer's welcome message is HTML, an agent's note
  is plain text. The frontend tells them apart by shape (`src/components/safe-html.tsx`) and always sanitises HTML
  with DOMPurify, since bodies come from customers and email.

## Ticket create takes fewer fields than osTicket's "Open a New Ticket"

- **Needs (osTicket's staff form, `ticket-open.inc.php`):** ticket source, SLA plan, due date, assign-to, Cc
  collaborators, and a first Response and Internal Note on the same submit (plus attachments).
- **Gives:** `POST /tickets/` takes name, email, phone, dept, topic, priority, subject, message and custom fields.
  The new-ticket screen offers only those and says so; assign-on-create is already in `KNOWN_LIMITS.md`.
- **Meanwhile:** source/SLA/due date can be changed after creation only where `PATCH /tickets/{id}` allows it.

## The effective (SLA-estimated) due date and the overdue flag are not exposed

- **Needs:** osTicket's "Due Date" is the manual due date when set, otherwise the SLA's estimated due date
  (`getEstDueDate()`, computed from the plan's grace period and the business-hours schedule); `isOverdue()` drives
  the Overdue queue and the red row styling. A screen needs both to look like osTicket's.
- **Gives (observed 2026-10-04):** `due_date` is only the manual override. Ticket 1 (Default SLA, 18 h grace,
  created 09/29) shows 10/2/26 8:00 AM on osTicket's page and `due_date: null` in the API, yet it is in the Overdue
  queue. After clearing a manual due date the API says `null` while osTicket shows the estimate.
- **Ask:** `est_due_date` (or an `effective_due_date`) and `is_overdue` on the ticket list item and detail.
- **Meanwhile:** the ticket page's "Due Date" shows `due_date` only, so it is blank where osTicket shows an estimate.

## Task lists lack what osTicket's Tasks page shows

- **Needs:** (1) the linked ticket's *number* on a task (osTicket's Ticket column shows `530890`, not the id);
  (2) an overdue flag and count (osTicket's Overdue tab and red rows); (3) team assignments in "My Tasks" (osTicket
  counts tasks assigned to the agent or their teams); (4) the task's collaborators (osTicket's "Collaborators" row);
  (5) queue counts in one call, as `GET /tickets/queues` does for tickets.
- **Gives (observed 2026-10-04):** `ticket_id` only; no overdue data; an `assignee_staff_id` filter only; no
  collaborators on `TaskDetail`; no counts endpoint. Task status names closed tasks "Closed" where osTicket's UI says
  "Completed" (the frontend shows "Completed" for the closed state).
- **Meanwhile:** the Ticket column looks each number up through `GET /tickets/{id}` (one request per distinct ticket,
  cached); the tab counts are three filtered list calls (`total` with `page_size=1`); there is no Overdue tab and
  no Collaborators row. The Open and Completed counts and every queue's contents match osTicket's on the dev data.

## The user and organization lists are thinner than osTicket's directory

- **Needs (osTicket's User Directory and Organizations pages):** a text search (`query`), sorting, a `total`, each
  user's ticket count and registration status (Guest / Registered / Locked, from the account), and each
  organization's member count; on a user's page, their tickets (a `user_id` filter on `GET /tickets/`).
- **Gives (observed 2026-10-04):** `GET /users` takes only `org_id`, `page`, `page_size`; `GET /orgs` only paging.
  Neither returns a `total`. The user list item's `status` is the integer 0 for everyone (not the account state).
- **Meanwhile:** the lists have no search or sort and page by "a full page may have a next"; the Status and ticket-count
  columns are left out (a note under the table says so); a user's Tickets table searches tickets by the user's email
  and keeps the rows whose `user_id` matches. The Organization filter on the user list works.
- **For reference (osTicket, not a gap):** its `users.php?org_id=` ignores the filter and an organization's members
  are shown on `orgs.php?id=`; phone numbers are stored as digits (`555-0100` comes back as `5550100`).

## Knowledge base lists have no search or counts

- **Needs (osTicket's kb.php and categories.php):** a FAQ search, each category's FAQ count, and the FAQ's
  attachments; on the canned-response picker, the same variables expansion osTicket offers.
- **Gives (observed 2026-10-04):** `GET /kb/faqs` filters only by `category_id`; no search, no per-category count,
  no `total`; FAQ and canned attachments are not exposed (`KNOWN_LIMITS.md`).
- **Meanwhile:** the KB screens read the whole (small) lists, up to 200 each, and count and filter on the client;
  there is no search box (a note says so). If a helpdesk has more than 200 FAQs the counts would be wrong.
- **For reference:** osTicket calls an unpublished FAQ "Internal"; the UI uses its word.

## Admin Panel pages with no API behind them, and thin admin lists

- **No endpoint at all (osTicket page):** roles (`roles.php`), settings (`settings.php?t=` company, system, tickets,
  tasks, agents, users, knowledgebase), ticket filters, schedules, API keys, pages, custom lists, plugins, emails,
  email settings, email templates, email diagnostic, system logs, system information. The Admin Panel shows each as
  a dimmed entry with a note, and the Dashboard group has nothing to show.
- **Roles are needed even for what is built:** `POST /staff` requires a `role_id`, and department access takes role
  ids, but roles cannot be listed. The agent form takes a number and says so.
- **List items carry less than osTicket's columns** (the list screens say which): agents lack Last Login; departments
  lack Status, Agents count, Email Address and Manager; teams lack Members count and Team Lead; help topics lack
  Priority, Department and the parent path (osTicket shows "Report a Problem / Access Issue"); forms lack field counts.
  Filling them in costs one request per row, so they are left out.
- **Forms:** `POST /forms` needs a `type` and the API edits only a form's title, instructions and notes: custom forms
  cannot be created or their fields edited from the Admin Panel, nor deleted.
- **Not exposed by the frontend yet (the API can):** team and department members, an agent's extended department
  access, teams and permissions, a help topic's custom forms.

## No dashboard activity report and no self-service profile

- **Needs (osTicket's Dashboard menu):** (1) the activity report of `dashboard.php`: per department, help topic and
  agent over a period, the tickets opened, assigned, overdue, closed, reopened and deleted, with service and
  response times (and its export); (2) `profile.php`: an agent editing their own name, phone, signature, password,
  vacation mode and preferences (page size, auto-refresh, default queue, thread order, paper size, redirect).
- **Gives (observed 2026-10-04):** nothing for (1); for (2) `GET /auth/me` is read-only and `PATCH /staff/{id}` is
  admin-only.
- **Meanwhile:** the landing page shows the agent's own ticket and task counts and their assigned tickets (real data,
  labelled as such) and says the activity report is missing; My Profile is read-only with a note.
