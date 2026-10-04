# Backend requests

What a screen needs that the API lacks or gets wrong. Raised in the backend repo, never fixed from here. Delete an
entry when the backend fixes it (and re-run `npm run api:pull`).

## `GET /api/v1/auth/me` has no response schema

- **Needs:** typed `staff_id`, `username`, `name`, `email`, `is_admin`, `assigned_only`, `global_permissions`
  (string list), `roles` (department id -> permission list), plus `department_ids` and `team_ids`.
- **Gives:** an empty `{}` response schema in `/openapi.json`, so `openapi-typescript` generates `unknown`.
- **Meanwhile:** `src/lib/api/me.ts` holds a small hand-written `Me` type, marked as temporary. Replace it with the
  generated type once the schema exists.
