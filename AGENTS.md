# fast-ticket-frontend — Agent Guide

The web frontend for **fast-ticket**, a FastAPI REST + WebSocket API over osTicket. This is its **own repository**,
separate from the backend (`../fast-ticket`). Framework: **Next.js** (decided 2026-10-04). The backend is **FastAPI** (`../fast-ticket`). The rest of the stack
is not decided yet — see "Open decisions".

## Boundary with the backend

- The frontend talks to the backend **only through its published HTTP/WebSocket contract**. It never imports backend
  code, reads osTicket's database, or assumes anything the contract does not state.
- The contract is documented in the backend repo; read these before building anything that calls the API:
  - `../fast-ticket/notes/CLIENTS.md` — auth, the 202 command pattern (writes are queued; poll
    `GET /commands/{id}?wait=`), idempotency keys, errors, CORS, deployment.
  - `../fast-ticket/notes/EVENTS.md` — the WebSocket event stream and its delivery limits (no replay: refetch on
    reconnect).
  - `../fast-ticket/notes/KNOWN_LIMITS.md` — what the API does not do yet (no upload, no export, …).
  - The schema itself: `/openapi.json` of a running backend (`http://localhost:8000/openapi.json` in dev).
- Generate the API client's types **from the schema**; do not hand-write request or response types.
- **The backend's rules are not this repo's rules.** Its `AGENTS.md`/`CLAUDE.md` (bridge, osTicket handlers, the
  `make test-e2e` routine, its session protocol) do not apply here.
- If the frontend needs something the API lacks or gets wrong, **do not work around it silently**: record it in
  `notes/BACKEND_REQUESTS.md` here (what the screen needs, what the API gives) so it can be raised in the backend repo.
- The server enforces permissions; the UI only hides what the agent cannot do (`GET /api/v1/auth/me`). A 404 means
  "gone or not yours".

## Open decisions (ask the user, do not guess)

- Next.js specifics: TypeScript (assumed yes), App Router vs Pages Router, package manager, UI library, and the
  data-fetching/state approach (e.g. TanStack Query).
- Whether the browser calls the FastAPI backend directly (needs `CORS_ORIGINS` set to the app's origin) or through
  Next.js (a rewrite/proxy of `/api` makes it same-origin; a route-handler BFF could also hold the token in an
  httpOnly cookie, which the API itself cannot do — it has no cookies and no refresh tokens).
- Where the access token is kept, which follows from the previous point.
- Where the OpenAPI schema is taken from for builds (production turns `/openapi.json` off).

## Working agreements

- Local git repository, no remote yet. Atomic commits, `<type>(<scope>): <summary>`.
- Never commit secrets or `.env` files; commit a `.env.example` for any variable the app reads.
- Keep this file current as decisions are made; delete the "Open decisions" entries as they are settled.
