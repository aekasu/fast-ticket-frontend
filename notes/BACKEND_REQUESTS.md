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

## Ticket create takes fewer fields than osTicket's "Open a New Ticket"

- **Needs (osTicket's staff form, `ticket-open.inc.php`):** ticket source, SLA plan, due date, assign-to, Cc
  collaborators, and a first Response and Internal Note on the same submit (plus attachments).
- **Gives:** `POST /tickets/` takes name, email, phone, dept, topic, priority, subject, message and custom fields.
  The new-ticket screen offers only those and says so; assign-on-create is already in `KNOWN_LIMITS.md`.
- **Meanwhile:** source/SLA/due date can be changed after creation only where `PATCH /tickets/{id}` allows it.

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
- **Forms (corrected 2026-10-04):** an earlier version of this note said the API could not manage form fields; it can
  (`POST/PATCH/DELETE /forms/{id}/fields`, `POST /forms`, `DELETE /forms/{id}`), and the Admin Panel now uses them.
  Still missing: field types beyond those listed (lists, files), `min`/`max` options of date fields.
- **Exposed by the frontend (2026-10-04):** team members, a department's extended-access agents, an agent's extended
  department access, teams and permissions, and a help topic's custom forms (`components/admin-relations.tsx`).
- **Still needed for those editors:** a list of roles (their ids are typed in, with the ones agents already use offered),
  and the permission keys as data: the 12 keys in `PERMISSIONS` are the ones the administrator holds, the schema only says
  "see app/core/permissions.py".

## No dashboard activity report and no self-service profile

- **Needs (osTicket's Dashboard menu):** (1) the activity report of `dashboard.php`: per department, help topic and
  agent over a period, the tickets opened, assigned, overdue, closed, reopened and deleted, with service and
  response times (and its export); (2) `profile.php`: an agent editing their own name, phone, signature, password,
  vacation mode and preferences (page size, auto-refresh, default queue, thread order, paper size, redirect).
- **Gives (observed 2026-10-04):** nothing for (1); for (2) `GET /auth/me` is read-only and `PATCH /staff/{id}` is
  admin-only.
- **Meanwhile:** the landing page shows the agent's own ticket and task counts and their assigned tickets (real data,
  labelled as such) and says the activity report is missing; My Profile is read-only with a note.

## Reply signature: accepted, undocumented, effect not observable

- **Needs:** osTicket's reply form offers a signature (None, My Signature, Department Signature).
- **Gives (observed 2026-10-04):** `POST /tickets/{id}/reply` takes a free `signature` string; `none`, `dept`, `mine`
  and even `bogus` are all accepted and none changes the stored thread (osTicket appends the signature to the outgoing
  email only). The accepted values are not in the schema.
- **Ask:** document the accepted values (an enum in the schema) and reject others.
- **Meanwhile:** the reply box has no signature selector, since its effect cannot be verified.

## Canned responses are returned as raw templates

- **Needs:** osTicket fills `%{ticket.name.first}`-style variables from the ticket when an agent picks a response
  (`ajax.php/tickets/{id}/canned-resp/{cid}.txt`).
- **Gives:** `GET /canned/{id}` returns the stored template.
- **Meanwhile:** the frontend fills in the variables it can resolve (`src/lib/canned.ts`, unit-tested; verified equal
  to osTicket's own expansion for the dev responses), leaves the others as written and says which. An endpoint such as
  `GET /tickets/{id}/canned/{cid}` would remove that duplication of osTicket's variable list.

## Ticket relations and statuses osTicket offers that the API does not

- **Needs (osTicket's ticket "More" menu and status control):** Link Tickets (and unlink), un-merge, Manage Referrals
  (list and remove), the ticket status choice (Open / Resolved / Closed and custom statuses) on a reply or from the
  menu, and Print.
- **Gives (observed 2026-10-04):** `merge` (children are closed and hidden from the queues, as osTicket does), `refer`
  (create only; osTicket records an internal note "Referral" and an event), `close` and `reopen` only. The
  `ticket.link` permission exists but no route uses it.
- **Meanwhile:** the toolbar has Merge Tickets and Refer; there is no Link, no referral list, and no status choice
  beyond Close / Reopen. The referral panel says referrals cannot be listed or removed.

## Custom fields: the form definition is admin-only, and answers come in two shapes

- **Needs:** a non-admin agent who may edit a ticket, user, organization or task must be able to read the *definition*
  (field names, types, choices, required mode) of the ticket, user, organization and task forms, to type answers.
- **Gives (observed 2026-10-04):** `GET /forms` and `GET /forms/{id}` are admin-only (`KNOWN_LIMITS.md`). An agent
  therefore sees a custom field's answers (every entity's `custom_fields` list) but gets no inputs for them.
- **Answer formats the frontend decodes (`src/lib/custom-fields.ts`):** a single choice is JSON `{"a":"Alpha"}` (key to
  label), a multiple choice is JSON `["x","z"]` (keys only), a bool is `"1"` or `"0"`, text and memo as typed.
  Typed values (an object with the field's type and the key list) would remove the decoding.
- **Also seen:** a field added to a form after a ticket existed is missing from that ticket's `custom_fields` until the
  ticket first gets an answer for it; and osTicket's own view pages for a user and an organization do not print
  custom answers (its edit dialog does), so those are checked against the API and the edit dialog.

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
