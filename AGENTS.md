# fast-ticket-frontend — Agent Guide

The web frontend for **fast-ticket**, a FastAPI REST + WebSocket API over osTicket. This is its **own repository**,
separate from the backend (`../fast-ticket`, FastAPI). Framework: **Next.js**; the remaining choices are under
"Decisions made" and "Open decisions" below.

## Goal

**Demonstrate that osTicket's functionality is faithfully implemented by the FastAPI backend.** The UI therefore takes
the shape of osTicket's own staff panel (`/scp`): the same screens, navigation, queues, ticket view with thread, and
Admin Panel pages, so a viewer can compare the two side by side and see the same data and behaviour. Fidelity to
osTicket's *workflow* matters more than pixel-perfection, and a screen is only done when it works against the real
stack, not a mock.

- Reference for layout and fields: the osTicket source at `../osticket/osTicket` — `scp/*.php` (the pages) and
  `include/staff/*.inc.php` (their templates). The reference *stack* for comparison runs at http://localhost:8080/scp,
  the API at http://localhost:8000 (see the backend's `/dev-stack` skill).
- osTicket is GPL-2.0. **Recreate** its layout and behaviour; do not copy its CSS, images, logo or template code into
  this repo.
- Build in the backend's order of value: login → ticket queues and ticket view → reply/note/assign/close → tasks →
  users/organizations → knowledge base/canned → Admin Panel. Show osTicket's behaviour, including its refusals (a
  failed command's `error_message`) — that is what proves the backend.
- What the API cannot do yet (`../fast-ticket/notes/KNOWN_LIMITS.md`: no upload, no export, no custom queues, …) is
  shown as absent or disabled in the UI, never faked.

## Decisions made

- **Next.js** (2026-10-04), TypeScript, App Router.
- **Same-origin through Next.js (option B):** the browser only talks to Next.js. `/api` is proxied to FastAPI
  (rewrite), and route handlers act as a thin backend-for-frontend that logs in, keeps the access token in an
  **httpOnly cookie** (never in `localStorage`/JS), and attaches it to proxied calls. The browser therefore needs no
  CORS and never sees the token. Because the API has no refresh tokens, a 401 sends the agent to the login screen.
- **WebSocket:** Next.js rewrites do not reliably proxy a WebSocket upgrade, and the browser cannot attach a header to
  one. Plan: a route handler returns a short-lived token for the socket and the browser connects straight to
  `/api/v1/ws` with the `["bearer", token]` subprotocol (CORS does not apply to WebSockets). Settle the details when
  the live updates are built; until then the screens refetch.
- **Tailwind CSS** for styling (no component kit): osTicket's look is utilitarian, and recreating it is easier with
  utility classes than by fighting a kit's defaults.
- **npm** as the package manager (already installed here; Node 24).
- **Types come from the schema:** generated from the backend's `/openapi.json`, never hand-written. The schema is a
  **committed snapshot** at `openapi/openapi.json`, refreshed by an npm script (`npm run api:pull`) from a running dev
  backend, and the types are generated from the snapshot (`npm run api:types`, e.g. `openapi-typescript`). Builds
  never need the backend; a backend contract change arrives as a reviewable diff of the snapshot. Pull it whenever
  the backend's API changes, and say so in the commit.

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

- Data-fetching/state approach — recommendation: TanStack Query (the 202 + `GET /commands/{id}?wait=` pattern and
  refetch-on-event fit its mutations and invalidation well).
- Component testing approach (Vitest + Testing Library, and Playwright against the live stack for the demo flows).

## Working agreements

- Local git repository, no remote yet. Atomic commits, `<type>(<scope>): <summary>`.
- Never commit secrets or `.env` files; commit a `.env.example` for any variable the app reads.
- Keep this file current as decisions are made; delete the "Open decisions" entries as they are settled.
