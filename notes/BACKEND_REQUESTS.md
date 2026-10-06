# Backend requests

What a screen needs that the API lacks or gets wrong. Raised in the backend repo, never fixed from here. Delete an
entry when the backend fixes it (and re-run `npm run api:pull`).

## The default queue order: the tie-break uses `updated`, osTicket's uses `lastupdate`

- **Needs:** osTicket's default queue sort, "Priority + Most Recently Updated": most urgent first, and within a priority the
  ticket with the latest `lastupdate` (the API's `last_activity`) first.
- **Gives (observed 2026-10-06):** `sort=priority&descending=false` orders the priorities correctly and now breaks ties by
  most recently *updated*, but by the row's `updated`, which also moves on a note, an edit or a task linked to the ticket.
  Ticket 613600 (last message 12:58, row updated later) sorts first among the Emergency tickets here and last on
  osTicket's page.
- **Ask:** break the `priority` tie by `last_activity` (osTicket's own sort), so the first page matches osTicket's.
- **Meanwhile:** `e2e/tickets.spec.ts` has a `test.fixme` for the exact order; the set of tickets on each page matches.

## Ticket create: status and attachments

- **Needs (osTicket's staff form, `ticket-open.inc.php`):** the initial Ticket Status choice (the API takes `status_id`
  but has no list of statuses to offer) and attachments on the first message.
- **Gives (observed 2026-10-06):** everything else on the form is adopted (requester, Cc, source, SLA, due date, assign,
  response, note, signature, notice). Attachments exist on replies and notes only.
- **Meanwhile:** the New Ticket screen says status and attachments are not offered.

## Task pages

- **Gives (observed 2026-10-06):** closed tasks are named "Closed" where osTicket's UI says "Completed" (the frontend
  shows "Completed"). (Collaborators, thread edit/resend, `ticket_number`, `is_overdue`, `queue=` and `/tasks/queues` are
  adopted.) A task's collaborators can be added but not changed or removed: osTicket has no such action either.

## Knowledge base: attachments

- **Needs:** the FAQ's attachments (`KNOWN_LIMITS.md`: FAQ and canned attachments are not exposed).
- **Meanwhile:** none are shown. (Category counts, `category_id` filter and FAQ search are adopted.)
- **For reference:** osTicket calls an unpublished FAQ "Internal"; the UI uses its word. osTicket's directory lists a
  user's ticket count only when it is above zero (the UI does the same), and `users.php?org_id=` ignores the filter
  (an organization's members are shown on `orgs.php?id=`); phone numbers are stored as digits.

## Admin Panel pages with no API behind them, and thin admin lists

- **No endpoint at all (osTicket page):** settings (`settings.php?t=` company, system, tickets,
  tasks, agents, users, knowledgebase), ticket filters, schedules, API keys, pages, custom lists, plugins, emails,
  email settings, email templates, email diagnostic, system logs, system information. The Admin Panel shows each as
  a dimmed entry with a note, and the Dashboard group has nothing to show.
- **Roles are list-only:** `GET /roles` feeds the pickers and a read-only Roles page; creating, editing and deleting a
  role (osTicket's `roles.php`) has no endpoint, and a role has no created/updated dates or per-record read.
- **List items carry less than osTicket's columns** (the list screens say which): agents lack Last Login; departments
  lack Status, Agents count, Email Address and Manager; teams lack Members count and Team Lead; help topics lack
  Priority, Department and the parent path (osTicket shows "Report a Problem / Access Issue"); forms lack field counts.
  Filling them in costs one request per row, so they are left out.
- **Forms (corrected 2026-10-04):** an earlier version of this note said the API could not manage form fields; it can
  (`POST/PATCH/DELETE /forms/{id}/fields`, `POST /forms`, `DELETE /forms/{id}`), and the Admin Panel now uses them.
  Still missing: field types beyond those listed (lists, files), `min`/`max` options of date fields.
- **Exposed by the frontend (2026-10-04):** team members, a department's extended-access agents, an agent's extended
  department access, teams and permissions, and a help topic's custom forms (`components/admin-relations.tsx`).

## No dashboard activity report and no self-service profile

- **Needs (osTicket's Dashboard menu):** (1) the activity report of `dashboard.php`: per department, help topic and
  agent over a period, the tickets opened, assigned, overdue, closed, reopened and deleted, with service and
  response times (and its export); (2) `profile.php`: an agent editing their own name, phone, signature, password,
  vacation mode and preferences (page size, auto-refresh, default queue, thread order, paper size, redirect).
- **Gives (observed 2026-10-04):** nothing for (1); for (2) `GET /auth/me` is read-only and `PATCH /staff/{id}` is
  admin-only.
- **Meanwhile:** the landing page shows the agent's own ticket and task counts and their assigned tickets (real data,
  labelled as such) and says the activity report is missing; My Profile is read-only with a note.

## Ticket relations and statuses osTicket offers that the API does not

- **Needs (osTicket's ticket "More" menu and status control):** Link Tickets (and unlink), un-merge, the ticket status choice (Open / Resolved / Closed and custom statuses) on a reply or from the
  menu, and Print.
- **Gives (observed 2026-10-04):** `merge` (children are closed and hidden from the queues, as osTicket does), `refer`
  (osTicket records an internal note "Referral" and an event; the list and remove are adopted), `close` and `reopen` only. The
  `ticket.link` permission exists but no route uses it.
- **Meanwhile:** the toolbar has Merge Tickets and Refer (with the referral list and remove); there is no Link and no
  status choice beyond Close / Reopen.

## Custom fields: two leftovers

- **Seen (2026-10-06):** a field added to a form after a ticket existed is missing from that ticket's `custom_fields`
  until the ticket first gets an answer for it; and osTicket's own view pages for a user and an organization do not
  print custom answers (its edit dialog does), so those are checked against the API and the edit dialog.
- **Not writable yet:** a custom-list field's answer (`KNOWN_LIMITS.md`); the UI shows it read-only.
- (Typed answers and `GET /forms/for/{kind}` are adopted.)

## Custom answers cannot be list columns

- **Needs:** osTicket lets a queue show custom form fields as columns (and sort by them).
- **Gives (observed 2026-10-05):** list items (tickets, tasks, users, organizations) carry no custom answers; only the
  detail endpoints do, and the API has no custom queues or per-queue columns (`KNOWN_LIMITS.md`). Showing a custom answer
  per row would cost one request per row, so it is not done.
- **Ask:** `custom_fields` on the list items, optionally limited with `?fields=` to the variable names a screen wants.

## Notes on thread entries

- Editing an entry gives it a new id and hides the old one (as the API documents), and a ticket's thread then shows one
  entry where it showed one: the UI relies on the refetch after the command, not on the old id.
- `PATCH` and `resend` apply to customer messages, replies and notes alike; osTicket's own rule (your post, a
  manager, `thread.edit`) decides, and its refusal is shown as worded.
- Category creation needs a description (osTicket refuses without one); the form now marks it required.
## A plain-text message loses its line breaks

- **Needs:** a multi-line reply, note or message to keep its lines, as osTicket's own editor does (it stores `<br>` or
  paragraphs).
- **Gives (observed 2026-10-06):** `message` "msg line1\nmsg line2" is stored and returned (format `html`) as
  "msg line1 msg line2": the newline is flattened to a space. Markup typed into the message (`<b>`) is kept as HTML and `&`
  becomes `&amp;`, so the API treats the text as HTML.
- **Ask:** convert newlines to `<br>` (or `<p>`) when storing a plain-text message, or accept `format: "text"`.
- **Meanwhile:** the reply and note boxes send what was typed; a thread shows it by its `format`, so entities decode and
  markup renders (sanitised), but typed line breaks are gone.
