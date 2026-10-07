# Backend requests

What a screen needs that the API lacks or gets wrong. Raised in the backend repo, never fixed from here. Delete an
entry when the backend fixes it (and re-run `npm run api:pull`).



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


## Custom fields: two leftovers

- **Seen (2026-10-06):** a field added to a form after a ticket existed is missing from that ticket's `custom_fields`
  until the ticket first gets an answer for it; and osTicket's own view pages for a user and an organization do not
  print custom answers (its edit dialog does), so those are checked against the API and the edit dialog.
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
