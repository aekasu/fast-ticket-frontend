# Backend requests

What a screen needs that the API lacks or gets wrong. Raised in the backend repo, never fixed from here. Delete an
entry when the backend fixes it (and re-run `npm run api:pull`).

All eleven requests of 2026-10-06 were met by the backend on 2026-10-07 and adopted (see the git log from `chore(api):
pull the schema: statuses, link/unlink, profile, ...`). What is left:

## Admin Panel: what osTicket's pages hold and the API does not

- **Company profile and logos** (`settings.php?t=pages`): the Company entry shows only the landing/offline/thank-you
  page choice (`/settings/pages`). The company name, address, website, phone, logo and backdrop have no endpoint.
- **Email Diagnostic** (`emailtest.php`) has no endpoint (it needs a live mail connection).
- **Mailbox and SMTP accounts** of an email address are listed (status only, never credentials); creating or editing
  one stays in osTicket (`KNOWN_LIMITS.md`).
- **Select-like values in the settings pages** (`client_registration`, `agent_name_format`, password policies, the
  default queue/status ids, ...) are osTicket's own strings and numbers, and the API does not enumerate them. The settings
  screens therefore show them as plain text/number inputs; a refused value comes back with osTicket's wording. Ask: the
  allowed options per key.
- **A business-hours schedule's holiday links** (`holiday_schedule_ids`) are accepted on create/update but the UI does
  not offer them yet (frontend side, not a backend gap).
- **Forms:** field types beyond the common ones (files), `min`/`max` of date fields, a custom list's per-item
  property fields.

## Ticket pages

- **Print** (the ticket's "More" menu) has no endpoint; the user's browser can print the page.
- **The default queue's "Closed today / this week" sub-queues and custom queues** are not exposed (`KNOWN_LIMITS.md`).
- **A canned response's files** are named on `GET /tickets/{id}/canned/{canned_id}` (`files`), but there is no way to
  attach them to the reply they fill: the reply box lists their names and says they are not added.
- **A field added to a form after a ticket existed** is missing from that ticket's `custom_fields` until the ticket first
  gets an answer for it.

## For reference (not requests)

- osTicket calls an unpublished FAQ "Internal"; the UI uses its word. osTicket's directory lists a user's ticket count
  only when it is above zero (the UI does the same), and `users.php?org_id=` ignores the filter (an organization's
  members are shown on `orgs.php?id=`); phone numbers are stored as digits and shown formatted.
- osTicket's own view pages for a user and an organization do not print custom answers (its edit dialog does), so those
  are checked against the API and the edit dialog.
- A task's collaborators can be added but not changed or removed: osTicket has no such action either.
- Editing a thread entry gives it a new id and hides the old one (as the API documents); the UI relies on the refetch
  after the command. `PATCH` and `resend` apply to customer messages, replies and notes alike; osTicket's own rule decides
  and its refusal is shown as worded.
- Category creation needs a description (osTicket refuses without one); the form marks it required.
- osTicket's validator refuses the dev admin's `admin@example.local` address ("Valid email is required"), so saving the
  admin's own profile is refused as osTicket's own page would refuse it. The profile test uses the non-admin agent.
- The Overdue queue test (`e2e/tickets.spec.ts`) was already failing before this round: the API marks a ticket overdue
  (`is_overdue`) that osTicket's Overdue queue does not list (osTicket sets `isoverdue` from its cron).
