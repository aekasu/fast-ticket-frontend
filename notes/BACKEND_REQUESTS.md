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
