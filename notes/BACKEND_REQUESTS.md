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
