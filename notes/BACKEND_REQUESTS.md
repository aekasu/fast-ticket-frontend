# Backend requests

What a screen needs that the API lacks or gets wrong. Raised in the backend repo, never fixed from here. Delete an
entry when the backend fixes it (and re-run `npm run api:pull`).

## `GET /api/v1/auth/me` has no response schema

- **Needs:** typed `staff_id`, `username`, `name`, `email`, `is_admin`, `assigned_only`, `global_permissions`
  (string list), `roles` (department id -> permission list), plus `department_ids` and `team_ids`.
- **Gives:** an empty `{}` response schema in `/openapi.json`, so `openapi-typescript` generates `unknown`.
- **Meanwhile:** `src/lib/api/me.ts` holds a small hand-written `Me` type, marked as temporary. Replace it with the
  generated type once the schema exists.

## Login 429 carries no `Retry-After` and a different body

- **Needs:** the `Retry-After` header `CLIENTS.md` promises on a locked-out login, so the screen can say when to retry.
- **Gives (observed 2026-10-04):** after 5 failures the BFF got 429; the backend's own 429 answers
  `{"error":"Rate limit exceeded: 10 per 1 minute"}` with no `Retry-After` header. The login screen therefore says
  "Try again later" with no number. (It shows the number if the header ever appears.)
